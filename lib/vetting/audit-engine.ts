/**
 * Digital Presence Audit Engine — Orchestrator
 *
 * Chains discovery → classification → confidence → scoring → risks
 * into a single audit run. Stores results in Supabase.
 */

import { createServerClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { discoverPlatforms, discoverOpponentPlatforms } from './audit/discovery';
import { classifyUrl } from './audit/platform-classifier';
import { calculateConfidence } from './audit/confidence';
import { scorePlatform, scoreOverall } from './audit/scoring';
import { assessRisks } from './audit/risks';
import type {
  AuditInput,
  PlatformResult,
  OpponentAuditResult,
  DiscoveredUrl,
} from './audit/types';

/**
 * Run a full digital presence audit for a vetting record.
 * Creates/updates CandidateDigitalAudit and CandidateAuditPlatform rows.
 * Pre-populates the digital_presence_audit report section with AI draft data.
 * Advances stage from auto_audit → assigned on success.
 */
export async function runAudit(
  vettingId: string,
  auditId: string,
  _triggeredById: string | null,
): Promise<void> {
  const supabase = createServerClient();

  // 1. Mark audit as running
  await supabase
    .from('rlc_candidate_digital_audits')
    .update({
      status: 'running',
      started_at: new Date().toISOString(),
    } as never)
    .eq('id', auditId);

  try {
    // 2. Load vetting data
    const { data: rawVetting, error: vError } = await supabase
      .from('rlc_candidate_vettings')
      .select('id, candidate_name, candidate_state, candidate_office, candidate_district, candidate_party, stage')
      .eq('id', vettingId)
      .single();

    if (vError || !rawVetting) {
      const errorDetail = vError
        ? `Database error: ${vError.message} (code: ${vError.code})`
        : 'Vetting record returned null — may have been deleted';
      logger.error('[Audit] Failed to load vetting record:', { auditId, vettingId, error: vError });
      throw new Error(errorDetail);
    }

    const vetting = rawVetting as {
      id: string;
      candidate_name: string;
      candidate_state: string | null;
      candidate_office: string | null;
      candidate_district: string | null;
      candidate_party: string | null;
      stage: string;
    };

    // Load opponents
    const { data: rawOpponents } = await supabase
      .from('rlc_candidate_vetting_opponents')
      .select('name, party')
      .eq('vetting_id', vettingId);

    const opponents = (rawOpponents ?? []) as { name: string; party: string | null }[];

    const auditInput: AuditInput = {
      candidateName: vetting.candidate_name,
      state: vetting.candidate_state,
      office: vetting.candidate_office,
      district: vetting.candidate_district,
      party: vetting.candidate_party,
      knownUrls: [],
      opponents: opponents.map((o) => ({ name: o.name, party: o.party })),
    };

    // 3. Discovery
    logger.info(`[Audit] Starting discovery for "${vetting.candidate_name}"`);
    const discovery = await discoverPlatforms(auditInput);
    logger.info(`[Audit] Discovered ${discovery.urls.length} URLs across ${discovery.totalSearches} searches`);

    // 4. Classify, score confidence, and score each platform
    const candidatePlatforms = processPlatforms(
      discovery.urls,
      'candidate',
      vetting.candidate_name,
      auditInput,
    );

    // 5. Calculate overall score
    // (opponent audits computed next, but we pass empty array first for candidate-only scoring)
    const opponentAudits: OpponentAuditResult[] = [];

    // 6. Opponent mini-audits
    for (const opponent of auditInput.opponents) {
      try {
        const oppUrls = await discoverOpponentPlatforms(
          opponent.name,
          auditInput.state,
          auditInput.office,
        );
        const oppPlatforms = processPlatforms(
          oppUrls,
          'opponent',
          opponent.name,
          { ...auditInput, candidateName: opponent.name },
        );

        const oppAvgScore = oppPlatforms.length > 0
          ? Math.round(oppPlatforms.reduce((s, p) => s + (p.totalScore ?? 0), 0) / oppPlatforms.length)
          : null;

        opponentAudits.push({
          name: opponent.name,
          party: opponent.party,
          platformCount: oppPlatforms.length,
          overallScore: oppAvgScore,
          grade: null,
          platforms: oppPlatforms,
        });
      } catch (err) {
        logger.warn(`[Audit] Opponent audit failed for "${opponent.name}":`, {
          opponentName: opponent.name,
          error: err instanceof Error ? err.message : String(err),
        });
        opponentAudits.push({
          name: opponent.name,
          party: opponent.party,
          platformCount: 0,
          overallScore: null,
          grade: null,
          platforms: [],
          auditFailed: true,
          failureReason: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    // 7. Final scoring with opponent data
    const scoreBreakdown = scoreOverall(candidatePlatforms, opponentAudits);

    // 8. Risk assessment
    const riskAssessment = assessRisks(candidatePlatforms);

    // 9. Store platform rows
    const allPlatforms = [
      ...candidatePlatforms,
      ...opponentAudits.flatMap((o) => o.platforms),
    ];

    if (allPlatforms.length > 0) {
      const platformRows = allPlatforms.map((p) => ({
        audit_id: auditId,
        entity_type: p.entityType,
        entity_name: p.entityName,
        platform_name: p.platformName,
        platform_url: p.platformUrl,
        confidence_score: p.confidenceScore,
        discovery_method: p.discoveryMethod,
        activity_status: p.activityStatus,
        last_activity_date: p.lastActivityDate,
        followers: p.followers,
        engagement_rate: p.engagementRate,
        score_presence: p.scorePresence,
        score_consistency: p.scoreConsistency,
        score_quality: p.scoreQuality,
        score_accessibility: p.scoreAccessibility,
        total_score: p.totalScore,
        grade: p.grade,
        contact_methods: p.contactMethods,
      }));

      const { error: platErr } = await supabase
        .from('rlc_candidate_audit_platforms')
        .insert(platformRows as never);

      if (platErr) {
        logger.error('[Audit] Failed to insert platform rows:', {
          auditId,
          vettingId,
          platformCount: allPlatforms.length,
          error: platErr,
        });
        throw new Error(`Platform insert failed: ${platErr.message}`);
      }
    }

    // 10. Pre-populate digital_presence_audit report section
    const aiDraftData = {
      overallScore: scoreBreakdown.total,
      grade: scoreBreakdown.grade,
      scoreBreakdown,
      riskAssessment: {
        overallScore: riskAssessment.overallScore,
        overallSeverity: riskAssessment.overallSeverity,
        risks: riskAssessment.risks,
      },
      platformCount: candidatePlatforms.length,
      opponentCount: opponentAudits.length,
      generatedAt: new Date().toISOString(),
    };

    const { error: sectionErr } = await supabase
      .from('rlc_candidate_vetting_report_sections')
      .update({ ai_draft_data: aiDraftData } as never)
      .eq('vetting_id', vettingId)
      .eq('section', 'digital_presence_audit');

    if (sectionErr) {
      logger.error('[Audit] Failed to pre-populate report section:', {
        auditId,
        vettingId,
        error: sectionErr,
      });
      throw new Error(`Report section update failed: ${sectionErr.message}`);
    }

    // 11. Update audit record to completed
    await supabase
      .from('rlc_candidate_digital_audits')
      .update({
        status: 'audit_completed',
        completed_at: new Date().toISOString(),
        candidate_overall_score: scoreBreakdown.total,
        candidate_grade: scoreBreakdown.grade,
        candidate_score_breakdown: scoreBreakdown as unknown as Record<string, unknown>,
        candidate_risks: riskAssessment.risks as unknown as Record<string, unknown>[],
        opponent_audits: opponentAudits as unknown as Record<string, unknown>[],
        discovery_log: discovery as unknown as Record<string, unknown>,
      } as never)
      .eq('id', auditId);

    // 12. If stage is auto_audit, advance to assigned
    if (vetting.stage === 'auto_audit') {
      await supabase
        .from('rlc_candidate_vettings')
        .update({ stage: 'assigned' } as never)
        .eq('id', vettingId)
        .eq('stage', 'auto_audit'); // optimistic concurrency
    }

    logger.info(`[Audit] Completed for "${vetting.candidate_name}" — score ${scoreBreakdown.total} (${scoreBreakdown.grade})`);
  } catch (err) {
    logger.error(`[Audit] Failed for vetting ${vettingId}:`, err);

    await supabase
      .from('rlc_candidate_digital_audits')
      .update({
        status: 'audit_failed',
        completed_at: new Date().toISOString(),
        error_message: err instanceof Error ? err.message : String(err),
      } as never)
      .eq('id', auditId);

    // Do NOT advance stage on failure
  }
}

// ─── Internal Helpers ─────────────────────────────────────────────

function processPlatforms(
  urls: DiscoveredUrl[],
  entityType: 'candidate' | 'opponent',
  entityName: string,
  input: AuditInput,
): PlatformResult[] {
  const results: PlatformResult[] = [];

  for (const discovered of urls) {
    const classification = classifyUrl(discovered.url);
    if (!classification) continue;

    const { score: confidenceScore } = calculateConfidence(
      discovered.url,
      discovered.title,
      input.candidateName,
      input.office,
      input.state,
    );

    // Basic platform scoring (heuristic — no page content analysis yet)
    const platformScores = scorePlatform({
      hasProfile: true,
      isActive: false, // can't verify without page crawl
      lastActivityRecent: false, // can't verify without page crawl
      namingConsistent: confidenceScore > 0.5,
      messagingConsistent: confidenceScore > 0.4,
      hasLogo: false, // can't determine without screenshot
      contentQuality: confidenceScore > 0.6 ? 'good' : 'fair',
      professionalPresentation: confidenceScore > 0.5,
      hasContactInfo: false,
      hasEmail: false,
      hasPhone: false,
      hasWebsite: false,
    });

    results.push({
      entityType,
      entityName,
      platformName: classification.platformName,
      platformUrl: discovered.url,
      confidenceScore: Math.round(confidenceScore * 100) / 100,
      discoveryMethod: discovered.discoveryMethod,
      activityStatus: 'unknown',
      lastActivityDate: null,
      followers: null,
      engagementRate: null,
      scorePresence: platformScores.presence,
      scoreConsistency: platformScores.consistency,
      scoreQuality: platformScores.quality,
      scoreAccessibility: platformScores.accessibility,
      totalScore: platformScores.total,
      grade: platformScores.grade,
      contactMethods: null,
    });
  }

  return results;
}
