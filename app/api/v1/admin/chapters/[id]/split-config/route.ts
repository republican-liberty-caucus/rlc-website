import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext, getRoleWeight } from '@/lib/admin/permissions';
import { splitConfigUpdateWithValidation } from '@/lib/validations/split-config';
import { logger } from '@/lib/logger';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ctx = await getAdminContext(userId);
  if (!ctx) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: chapterId } = await params;

  if (ctx.visibleChapterIds !== null && !ctx.visibleChapterIds.includes(chapterId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createServerClient();

  // Get config
  const { data: config } = await supabase
    .from('rlc_chapter_split_configs')
    .select('id, disbursement_model, is_active, updated_by_id, created_at, updated_at')
    .eq('chapter_id', chapterId)
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
    .from('rlc_chapter_split_rules')
    .select('id, recipient_chapter_id, percentage, sort_order, is_active')
    .eq('config_id', configRow.id)
    .order('sort_order', { ascending: true });

  // Enrich rules with chapter names
  const enrichedRules = [];
  if (rules && rules.length > 0) {
    const ruleRows = rules as { id: string; recipient_chapter_id: string; percentage: number; sort_order: number; is_active: boolean }[];
    const chapterIds = ruleRows.map((r) => r.recipient_chapter_id);
    const { data: chapters } = await supabase
      .from('rlc_chapters')
      .select('id, name, chapter_level')
      .in('id', chapterIds);

    const chapterMap = new Map((chapters || []).map((c: { id: string; name: string; chapter_level: string }) => [c.id, c]));

    for (const rule of ruleRows) {
      const chapter = chapterMap.get(rule.recipient_chapter_id);
      enrichedRules.push({
        ...rule,
        chapter_name: chapter?.name || 'Unknown',
        chapter_level: chapter?.chapter_level || 'unknown',
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
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ctx = await getAdminContext(userId);
  if (!ctx) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Require state_chair or higher
  if (getRoleWeight(ctx.highestRole) < getRoleWeight('state_chair')) {
    return NextResponse.json({ error: 'Forbidden: state_chair role required' }, { status: 403 });
  }

  const { id: chapterId } = await params;

  if (ctx.visibleChapterIds !== null && !ctx.visibleChapterIds.includes(chapterId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parseResult = splitConfigUpdateWithValidation.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const input = parseResult.data;
  const supabase = createServerClient();

  // Upsert config
  const { data: config, error: configError } = await supabase
    .from('rlc_chapter_split_configs')
    .upsert({
      chapter_id: chapterId,
      disbursement_model: input.disbursementModel,
      is_active: input.isActive,
      updated_by_id: ctx.member.id,
    } as never, { onConflict: 'chapter_id' })
    .select('id')
    .single();

  if (configError || !config) {
    logger.error(`Failed to upsert split config for ${chapterId}:`, configError);
    return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
  }

  const configId = (config as { id: string }).id;

  // Update rules if provided
  if (input.rules) {
    // Delete existing rules and recreate
    await supabase
      .from('rlc_chapter_split_rules')
      .delete()
      .eq('config_id', configId);

    if (input.rules.length > 0) {
      const ruleInserts = input.rules.map((r, i) => ({
        config_id: configId,
        recipient_chapter_id: r.recipientChapterId,
        percentage: r.percentage,
        sort_order: r.sortOrder ?? i,
        is_active: r.isActive ?? true,
      }));

      const { error: rulesError } = await supabase
        .from('rlc_chapter_split_rules')
        .insert(ruleInserts as never);

      if (rulesError) {
        logger.error(`Failed to insert split rules for config ${configId}:`, rulesError);
        return NextResponse.json({ error: 'Failed to save rules' }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ success: true, configId });
}
