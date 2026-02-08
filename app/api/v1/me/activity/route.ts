import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServerClient, getMemberByClerkId } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const member = await getMemberByClerkId(userId);
  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  const supabase = createServerClient();

  try {
    // Fetch recent campaign participations
    const { data: participations, error: partErr } = await supabase
      .from('rlc_campaign_participations')
      .select('id, action, created_at, campaign:rlc_action_campaigns(title, slug)')
      .eq('member_id', member.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (partErr) logger.error('Error fetching participations:', partErr);

    // Fetch recent contributions
    const { data: contributions, error: contribErr } = await supabase
      .from('rlc_contributions')
      .select('id, contribution_type, amount, created_at')
      .eq('member_id', member.id)
      .eq('payment_status', 'completed')
      .order('created_at', { ascending: false })
      .limit(10);

    if (contribErr) logger.error('Error fetching contributions:', contribErr);

    // Fetch recent event registrations
    const { data: registrations, error: regErr } = await supabase
      .from('rlc_event_registrations')
      .select('id, created_at, event:rlc_events(title, slug)')
      .eq('member_id', member.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (regErr) logger.error('Error fetching registrations:', regErr);

    // Merge and sort by timestamp
    type ActivityEntry = {
      id: string;
      type: 'campaign' | 'contribution' | 'event';
      title: string;
      description: string;
      timestamp: string;
      href?: string;
    };

    type ParticipationRow = {
      id: string;
      action: string;
      created_at: string;
      campaign: { title: string; slug: string } | null;
    };
    type ContributionRow = {
      id: string;
      contribution_type: string;
      amount: number;
      created_at: string;
    };
    type RegistrationRow = {
      id: string;
      created_at: string;
      event: { title: string; slug: string } | null;
    };

    const typedParticipations = (participations || []) as ParticipationRow[];
    const typedContributions = (contributions || []) as ContributionRow[];
    const typedRegistrations = (registrations || []) as RegistrationRow[];

    const activities: ActivityEntry[] = [];

    for (const p of typedParticipations) {
      activities.push({
        id: p.id,
        type: 'campaign',
        title: p.campaign?.title || 'Campaign Action',
        description: `You ${p.action || 'took action'}`,
        timestamp: p.created_at,
        href: p.campaign?.slug ? `/action-center/contact?campaign=${p.campaign.slug}` : undefined,
      });
    }

    const typeLabels: Record<string, string> = {
      membership: 'Membership payment',
      donation: 'Donation',
      event_registration: 'Event registration fee',
      merchandise: 'Merchandise purchase',
    };

    for (const c of typedContributions) {
      activities.push({
        id: c.id,
        type: 'contribution',
        title: typeLabels[c.contribution_type] || 'Contribution',
        description: `$${(c.amount / 100).toFixed(2)}`,
        timestamp: c.created_at,
        href: '/contributions',
      });
    }

    for (const r of typedRegistrations) {
      activities.push({
        id: r.id,
        type: 'event',
        title: r.event?.title || 'Event Registration',
        description: 'Registered for event',
        timestamp: r.created_at,
        href: r.event?.slug ? `/events/${r.event.slug}` : undefined,
      });
    }

    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({ data: activities.slice(0, 20) });
  } catch (err) {
    logger.error('Error fetching member activity:', err);
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 });
  }
}
