import { NextResponse } from 'next/server';
import { getRoleWeight } from '@/lib/admin/permissions';
import { splitConfigUpdateWithValidation } from '@/lib/validations/split-config';
import { logger } from '@/lib/logger';
import { requireAdminApi } from '@/lib/admin/route-helpers';
import { apiError, ApiErrorCode, validationError } from '@/lib/api/errors';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdminApi();
  if (result.error) return result.error;
  const { ctx, supabase } = result;

  const { id: charterId } = await params;

  if (ctx.visibleCharterIds !== null && !ctx.visibleCharterIds.includes(charterId)) {
    return apiError('Forbidden', ApiErrorCode.FORBIDDEN, 403);
  }

  // Get config
  const { data: config } = await supabase
    .from('rlc_charter_split_configs')
    .select('id, disbursement_model, is_active, updated_by_id, created_at, updated_at')
    .eq('charter_id', charterId)
    .single();

  if (!config) {
    return NextResponse.json({
      config: null,
      rules: [],
    });
  }

  const configRow = config as { id: string; disbursement_model: string; is_active: boolean; updated_by_id: string | null; created_at: string; updated_at: string };

  // Get rules
  const { data: rules } = await supabase
    .from('rlc_charter_split_rules')
    .select('id, recipient_charter_id, percentage, sort_order, is_active')
    .eq('config_id', configRow.id)
    .order('sort_order', { ascending: true });

  // Enrich rules with charter names
  const enrichedRules = [];
  if (rules && rules.length > 0) {
    const ruleRows = rules as { id: string; recipient_charter_id: string; percentage: number; sort_order: number; is_active: boolean }[];
    const charterIds = ruleRows.map((r) => r.recipient_charter_id);
    const { data: charters } = await supabase
      .from('rlc_charters')
      .select('id, name, charter_level')
      .in('id', charterIds);

    const charterMap = new Map((charters || []).map((c: { id: string; name: string; charter_level: string }) => [c.id, c]));

    for (const rule of ruleRows) {
      const charter = charterMap.get(rule.recipient_charter_id);
      enrichedRules.push({
        ...rule,
        charter_name: charter?.name || 'Unknown',
        charter_level: charter?.charter_level || 'unknown',
      });
    }
  }

  return NextResponse.json({
    config: configRow,
    rules: enrichedRules,
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const result = await requireAdminApi();
  if (result.error) return result.error;
  const { ctx, supabase } = result;

  // Require state_chair or higher
  if (getRoleWeight(ctx.highestRole) < getRoleWeight('state_chair')) {
    return apiError('Forbidden: state_chair role required', ApiErrorCode.FORBIDDEN, 403);
  }

  const { id: charterId } = await params;

  if (ctx.visibleCharterIds !== null && !ctx.visibleCharterIds.includes(charterId)) {
    return apiError('Forbidden', ApiErrorCode.FORBIDDEN, 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError('Invalid JSON', ApiErrorCode.INVALID_JSON, 400);
  }

  const parseResult = splitConfigUpdateWithValidation.safeParse(body);
  if (!parseResult.success) {
    return validationError(parseResult.error);
  }

  const input = parseResult.data;

  // Upsert config
  const { data: config, error: configError } = await supabase
    .from('rlc_charter_split_configs')
    .upsert({
      charter_id: charterId,
      disbursement_model: input.disbursementModel,
      is_active: input.isActive,
      updated_by_id: ctx.member.id,
    } as never, { onConflict: 'charter_id' })
    .select('id')
    .single();

  if (configError || !config) {
    logger.error(`Failed to upsert split config for ${charterId}:`, configError);
    return apiError('Failed to save config', ApiErrorCode.INTERNAL_ERROR, 500);
  }

  const configId = (config as { id: string }).id;

  // Update rules if provided
  if (input.rules) {
    // Delete existing rules and recreate
    const { error: deleteError } = await supabase
      .from('rlc_charter_split_rules')
      .delete()
      .eq('config_id', configId);

    if (deleteError) {
      logger.error(`Failed to delete existing split rules for config ${configId}:`, deleteError);
      return apiError('Failed to update rules', ApiErrorCode.INTERNAL_ERROR, 500);
    }

    if (input.rules.length > 0) {
      const ruleInserts = input.rules.map((r, i) => ({
        config_id: configId,
        recipient_charter_id: r.recipientCharterId,
        percentage: r.percentage,
        sort_order: r.sortOrder ?? i,
        is_active: r.isActive ?? true,
      }));

      const { error: rulesError } = await supabase
        .from('rlc_charter_split_rules')
        .insert(ruleInserts as never);

      if (rulesError) {
        logger.error(`Failed to insert split rules for config ${configId}:`, rulesError);
        return apiError('Failed to save rules', ApiErrorCode.INTERNAL_ERROR, 500);
      }
    }
  }

  return NextResponse.json({ success: true, configId });
}
