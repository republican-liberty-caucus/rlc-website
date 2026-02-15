import { NextResponse } from 'next/server';
import { analyzeBill } from '@/lib/ai/analyze-bill';
import { logger } from '@/lib/logger';
import { requireAdminApi } from '@/lib/admin/route-helpers';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string; billId: string }> }
) {
  const result = await requireAdminApi();
  if (result.error) return result.error;
  const { supabase } = result;

  const { billId } = await params;

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
    const analysis = await analyzeBill(bill.title, bill.description || '');

    const { error: updateError } = await supabase
      .from('rlc_scorecard_bills')
      .update({
        ai_suggested_position: analysis.suggestedPosition,
        ai_analysis: analysis.analysis,
        category: analysis.category,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', billId);

    if (updateError) {
      logger.error('Error saving AI analysis:', updateError);
      return NextResponse.json({ error: 'Analysis succeeded but save failed' }, { status: 500 });
    }

    return NextResponse.json({ analysis });
  } catch (err) {
    logger.error('AI analysis failed:', err);
    return NextResponse.json({ error: 'AI analysis failed' }, { status: 500 });
  }
}
