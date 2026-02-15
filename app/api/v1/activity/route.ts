import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export const revalidate = 30;

export async function GET() {
  try {
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('rlc_campaign_participations')
      .select(`
        id,
        action,
        created_at,
        member:rlc_contacts(first_name, state),
        campaign:rlc_action_campaigns(title)
      `)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('[activity API] Supabase error:', error.message);
      return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 });
    }

    type ParticipationRow = {
      id: string;
      action: string;
      created_at: string;
      member: { first_name: string; state: string | null } | null;
      campaign: { title: string } | null;
    };

    const items = ((data || []) as ParticipationRow[]).map((row) => ({
      id: row.id,
      first_name: row.member?.first_name || 'A member',
      state: row.member?.state || null,
      campaign_title: row.campaign?.title || 'a campaign',
      action: row.action,
      created_at: row.created_at,
    }));

    return NextResponse.json({ data: items });
  } catch (err) {
    console.error('[activity API] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
