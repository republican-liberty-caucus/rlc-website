import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ctx = await getAdminContext(userId);
  if (!ctx) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
  const offset = (page - 1) * limit;
  const chapterId = searchParams.get('chapterId');
  const status = searchParams.get('status');
  const contributionId = searchParams.get('contributionId');

  if (chapterId && ctx.visibleChapterIds !== null && !ctx.visibleChapterIds.includes(chapterId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createServerClient();

  let query = supabase
    .from('rlc_split_ledger_entries')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  // Filters
  if (chapterId) {
    query = query.eq('recipient_chapter_id', chapterId);
  } else if (ctx.visibleChapterIds !== null) {
    query = query.in('recipient_chapter_id', ctx.visibleChapterIds);
  }

  if (status) {
    query = query.eq('status', status);
  }

  if (contributionId) {
    query = query.eq('contribution_id', contributionId);
  }

  const { data: entries, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch audit trail' }, { status: 500 });
  }

  // Enrich with chapter names
  const rows = (entries || []) as Record<string, unknown>[];
  const chapterIds = [...new Set(rows.map((r) => r.recipient_chapter_id as string))];

  let chapterNameMap = new Map<string, string>();
  if (chapterIds.length > 0) {
    const { data: chapters } = await supabase
      .from('rlc_chapters')
      .select('id, name')
      .in('id', chapterIds);

    chapterNameMap = new Map((chapters || []).map((c: { id: string; name: string }) => [c.id, c.name]));
  }

  const enriched = rows.map((r) => ({
    ...r,
    chapter_name: chapterNameMap.get(r.recipient_chapter_id as string) || 'Unknown',
  }));

  return NextResponse.json({
    data: enriched,
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  });
}
