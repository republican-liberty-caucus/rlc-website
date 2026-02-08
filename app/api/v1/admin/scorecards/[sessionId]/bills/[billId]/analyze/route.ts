import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';
import { analyzeBill } from '@/lib/ai/analyze-bill';
import { logger } from '@/lib/logger';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string; billId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ctx = await getAdminContext(userId);
  if (!ctx) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { billId } = await params;
  const supabase = createServerClient();

  const { data: billData, error: billError } = await supabase
    .from('rlc_scorecard_bills')
    .select('id, title, description')
    .eq('id', billId)
    .single();

  if (billError || !billData) {
    return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
  }

  const bill = billData as { id: string; title: string; description: string | null };

  try {
    const result = await analyzeBill(bill.title, bill.description || '');

    const { error: updateError } = await supabase
      .from('rlc_scorecard_bills')
      .update({
        ai_suggested_position: result.suggestedPosition,
        ai_analysis: result.analysis,
        category: result.category,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', billId);

    if (updateError) {
      logger.error('Error saving AI analysis:', updateError);
      return NextResponse.json({ error: 'Analysis succeeded but save failed' }, { status: 500 });
    }

    return NextResponse.json({ analysis: result });
  } catch (err) {
    logger.error('AI analysis failed:', err);
    return NextResponse.json({ error: 'AI analysis failed' }, { status: 500 });
  }
}
