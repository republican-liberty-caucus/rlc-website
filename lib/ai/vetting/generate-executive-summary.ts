import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { formatCandidateName } from '@/lib/utils';
import type { ExecutiveSummaryInput, ExecutiveSummaryOutput } from './types';

const SYSTEM_PROMPT = `You are a senior political analyst for the Republican Liberty Caucus (RLC). Your role is to synthesize all available vetting research into a concise executive summary for the endorsement committee.

The RLC evaluates candidates against core principles:
1. Individual Liberty — personal freedom, privacy, due process
2. Limited Government — smaller government, fiscal responsibility
3. Free Markets — free enterprise, deregulation, property rights
4. Second Amendment — gun rights
5. Constitutional Governance — federalism, rule of law

Given the collected research data from multiple sections, provide:
1. Summary — a concise 2-3 paragraph overview of the candidate
2. Overall Assessment — how well the candidate aligns with RLC principles
3. Strengths — key strengths from a liberty perspective
4. Concerns — areas of concern or deviation from liberty principles
5. Recommendation — a suggested endorsement posture (endorse, conditional endorse, do not endorse, or needs more information)

Respond ONLY in valid JSON format:
{
  "summary": "string",
  "overallAssessment": "string",
  "strengths": ["string"],
  "concerns": ["string"],
  "recommendation": "string"
}

Be balanced and evidence-based. Reference specific data from the research sections. This is a draft for human review, not a final decision.`;

const MIN_SECTIONS_FOR_SUMMARY = 3;

export async function generateExecutiveSummary(input: ExecutiveSummaryInput): Promise<ExecutiveSummaryOutput> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  // Only generate when sufficient data is available
  const populatedSections = Object.entries(input.allSectionData).filter(
    ([key, value]) => key !== 'executive_summary' && value != null && Object.keys(value).length > 0
  );

  if (populatedSections.length < MIN_SECTIONS_FOR_SUMMARY) {
    throw new Error(
      `Executive summary requires at least ${MIN_SECTIONS_FOR_SUMMARY} completed sections. Currently have ${populatedSections.length}.`
    );
  }

  const parts: string[] = [
    `Candidate: ${formatCandidateName(input.candidateFirstName, input.candidateLastName)}`,
  ];
  if (input.office) parts.push(`Office: ${input.office}`);
  if (input.state) parts.push(`State: ${input.state}`);
  if (input.party) parts.push(`Party: ${input.party}`);
  parts.push('', 'Available Research Data:');

  for (const [sectionType, data] of populatedSections) {
    parts.push(`\n--- ${sectionType.replace(/_/g, ' ').toUpperCase()} ---`);
    parts.push(JSON.stringify(data, null, 2));
  }

  const { text } = await generateText({
    model: anthropic('claude-sonnet-4-5-20250929'),
    system: SYSTEM_PROMPT,
    prompt: `Synthesize an executive summary from this vetting research:\n\n${parts.join('\n')}`,
    maxOutputTokens: 1500,
    temperature: 0.3,
  });

  const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();

  let result: Record<string, unknown>;
  try {
    result = JSON.parse(cleaned);
  } catch {
    throw new Error(`AI returned invalid JSON. Response: ${cleaned.slice(0, 200)}`);
  }

  return {
    summary: String(result.summary || ''),
    overallAssessment: String(result.overallAssessment || ''),
    strengths: Array.isArray(result.strengths) ? result.strengths.map(String) : [],
    concerns: Array.isArray(result.concerns) ? result.concerns.map(String) : [],
    recommendation: String(result.recommendation || ''),
  };
}
