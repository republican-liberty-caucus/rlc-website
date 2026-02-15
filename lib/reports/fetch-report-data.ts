import { createServerClient } from '@/lib/supabase/server';
import { rpc } from '@/lib/supabase/rpc';
import { logger } from '@/lib/logger';
import type { AdminContext } from '@/lib/admin/permissions';
import {
  getDescendantIds,
  buildCharterOptions,
  computePreviousPeriod,
  computeGrowthPercent,
  aggregateByState,
  type CharterOption,
  type StateAggregate,
  type GrowthDirection,
} from '@/lib/admin/report-helpers';
import type { Charter } from '@/types';

export interface ExpiringMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  membership_expiry_date: string | null;
}

export interface DecliningCharter {
  name: string;
  currentCount: number;
  prevCount: number;
}

export type ViewMode = 'multi_charter' | 'single_charter';

export interface ReportData {
  viewMode: ViewMode;
  hasDateFilter: boolean;
  isNational: boolean;
  headerTitle: string;
  headerDescription: string;
  charterOptions: CharterOption[];

  totalMembers: number;
  newMembersCurrent: number;
  memberGrowth: { value: number; direction: GrowthDirection };
  totalContributions: number;
  totalContribCount: number;
  contribGrowth: { value: number; direction: GrowthDirection };
  retentionRate: number;
  retainedCount: number;
  lapsedCount: number;

  membersByTier: Record<string, number>;
  membersByStatus: Record<string, number>;
  contribByType: Record<string, { count: number; total: number }>;
  membersByCharter: Record<string, { name: string; count: number }>;

  stateAggregates: StateAggregate[];

  decliningCharters: DecliningCharter[];
  zeroGrowthCharters: string[];
  totalExpiringCount: number;

  expiringMembers: ExpiringMember[];
}

const LEVEL_LABELS: Record<string, string> = {
  national: 'National',
  multi_state_region: 'Multi-State Region',
  state: 'State',
  intra_state_region: 'Intra-State Region',
  county: 'County',
};

function scopeByCharter<T extends { in: (col: string, vals: string[]) => T }>(
  query: T,
  charterIds: string[] | null,
  column: string = 'primary_charter_id',
): T {
  if (charterIds !== null && charterIds.length > 0) {
    return query.in(column, charterIds);
  }
  return query;
}

type CharterIdResult = { data: { primary_charter_id: string }[] | null };

/** Count rows by primary_charter_id from a Supabase query result. */
function countByCharter(result: CharterIdResult): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of result.data || []) {
    counts[row.primary_charter_id] = (counts[row.primary_charter_id] || 0) + 1;
  }
  return counts;
}

interface FetchParams {
  ctx: AdminContext;
  start?: string;
  end?: string;
  charterParam?: string;
}

export async function fetchReportData({
  ctx,
  start,
  end,
  charterParam,
}: FetchParams): Promise<ReportData> {
  const supabase = createServerClient();

  // --- Validate date inputs ---
  if (start && isNaN(new Date(start).getTime())) {
    throw new Error(`Invalid start date: "${start}"`);
  }
  if (end && isNaN(new Date(end).getTime())) {
    throw new Error(`Invalid end date: "${end}"`);
  }

  // --- Date range ---
  const hasDateFilter = !!(start || end);
  const endDate = end ? new Date(end) : new Date();
  const startDate = start
    ? new Date(start)
    : hasDateFilter
      ? new Date(new Date().setFullYear(endDate.getFullYear() - 1))
      : new Date('2000-01-01');

  const startISO = startDate.toISOString();
  const endISO = endDate.toISOString();
  const { prevStart, prevEnd } = computePreviousPeriod(startDate, endDate);
  const prevStartISO = prevStart.toISOString();
  const prevEndISO = prevEnd.toISOString();

  // --- Fetch all charters for dropdown + state grouping ---
  const { data: allChartersRaw, error: chartersError } = await supabase
    .from('rlc_charters')
    .select('id, name, charter_level, parent_charter_id, state_code, status')
    .order('name');

  if (chartersError) {
    throw new Error(`Failed to fetch charters: ${chartersError.message}`);
  }

  const allCharters = (allChartersRaw || []) as Pick<
    Charter,
    'id' | 'name' | 'charter_level' | 'parent_charter_id' | 'state_code' | 'status'
  >[];

  // --- Compute effective charter IDs (narrowed by charter param) ---
  let effectiveCharterIds = ctx.visibleCharterIds;

  if (charterParam) {
    const descendants = getDescendantIds(charterParam, allCharters);
    if (ctx.visibleCharterIds === null) {
      effectiveCharterIds = descendants;
    } else {
      const visibleSet = new Set(ctx.visibleCharterIds);
      effectiveCharterIds = descendants.filter((id) => visibleSet.has(id));
      if (effectiveCharterIds.length === 0) {
        effectiveCharterIds = ctx.visibleCharterIds;
      }
    }
  }

  // --- Determine view mode ---
  const viewMode: ViewMode =
    charterParam || effectiveCharterIds?.length === 1
      ? 'single_charter'
      : 'multi_charter';

  // Convert null (national admin) to undefined so RPC uses SQL DEFAULT NULL
  const rpcCharterIds = effectiveCharterIds ?? undefined;

  /** Query members expiring within the next 30 days. */
  function queryExpiringMembers() {
    const now = new Date();
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);
    return scopeByCharter(
      supabase
        .from('rlc_contacts')
        .select('id, first_name, last_name, email, phone, membership_expiry_date')
        .in('membership_status', ['current', 'expiring'])
        .gte('membership_expiry_date', now.toISOString())
        .lte('membership_expiry_date', in30Days.toISOString())
        .order('membership_expiry_date', { ascending: true })
        .limit(20),
      effectiveCharterIds,
    );
  }

  /** Query new members grouped by charter for a given date range. */
  function queryNewMembersByCharter(rangeStart: string, rangeEnd: string) {
    return scopeByCharter(
      supabase
        .from('rlc_contacts')
        .select('primary_charter_id')
        .not('primary_charter_id', 'is', null)
        .not('membership_join_date', 'is', null)
        .gte('membership_join_date', rangeStart)
        .lte('membership_join_date', rangeEnd)
        .limit(50000),
      effectiveCharterIds,
    );
  }

  // --- Parallel queries using RPC functions (no 1000-row limit) ---
  const [
    membersByTierResult,
    membersByStatusResult,
    membersByCharterResult,
    contributionsResult,
    newMembersResult,
    prevNewMembersResult,
    prevContributionsResult,
    expiringMembersResult,
    ...perCharterResults
  ] = await Promise.all([
    rpc(supabase, 'get_members_by_tier', { p_charter_ids: rpcCharterIds }),
    rpc(supabase, 'get_members_by_status', { p_charter_ids: rpcCharterIds }),
    rpc(supabase, 'get_members_by_charter', { p_charter_ids: rpcCharterIds }),
    rpc(supabase, 'get_contribution_summary', {
      p_start_date: startISO,
      p_end_date: endISO,
      p_charter_ids: rpcCharterIds,
    }),
    rpc(supabase, 'get_new_members_count', {
      p_start_date: startISO,
      p_end_date: endISO,
      p_charter_ids: rpcCharterIds,
    }),
    rpc(supabase, 'get_new_members_count', {
      p_start_date: prevStartISO,
      p_end_date: prevEndISO,
      p_charter_ids: rpcCharterIds,
    }),
    rpc(supabase, 'get_contribution_summary', {
      p_start_date: prevStartISO,
      p_end_date: prevEndISO,
      p_charter_ids: rpcCharterIds,
    }),
    // Expiring members (single-charter only)
    ...(viewMode === 'single_charter'
      ? [queryExpiringMembers()]
      : [Promise.resolve({ data: null, count: null, error: null })]),
    // Per-charter new members current + previous period (multi-charter only)
    ...(viewMode === 'multi_charter'
      ? [
          queryNewMembersByCharter(startISO, endISO),
          queryNewMembersByCharter(prevStartISO, prevEndISO),
        ]
      : []),
  ]);

  // --- Check for RPC/query errors ---
  const rpcErrors = [
    { name: 'members_by_tier', result: membersByTierResult },
    { name: 'members_by_status', result: membersByStatusResult },
    { name: 'members_by_charter', result: membersByCharterResult },
    { name: 'contribution_summary', result: contributionsResult },
    { name: 'new_members_count', result: newMembersResult },
    { name: 'prev_new_members_count', result: prevNewMembersResult },
    { name: 'prev_contribution_summary', result: prevContributionsResult },
  ].filter(({ result }) => result.error);

  if (rpcErrors.length > 0) {
    const details = rpcErrors.map((e) => `${e.name}: ${e.result.error!.message}`).join('; ');
    logger.error('Report data fetch errors:', details);
    throw new Error(`Failed to fetch report data: ${details}`);
  }

  // Check expiring members query (single-charter)
  if (viewMode === 'single_charter' && expiringMembersResult?.error) {
    logger.error('Expiring members query error:', expiringMembersResult.error.message);
    throw new Error(`Failed to fetch expiring members: ${expiringMembersResult.error.message}`);
  }

  // Check per-charter queries (multi-charter)
  if (viewMode === 'multi_charter' && perCharterResults.length >= 2) {
    const perCharterErrors = perCharterResults
      .map((r, i) => ({ name: `per_charter_${i}`, result: r as { error?: { message: string } | null } }))
      .filter(({ result }) => result.error);
    if (perCharterErrors.length > 0) {
      const details = perCharterErrors.map((e) => `${e.name}: ${e.result.error!.message}`).join('; ');
      logger.error('Per-charter query errors:', details);
      throw new Error(`Failed to fetch per-charter data: ${details}`);
    }
  }

  // --- Aggregate: membership by tier ---
  const membersByTier: Record<string, number> = {};
  for (const row of (membersByTierResult.data || []) as { membership_tier: string; count: number }[]) {
    membersByTier[row.membership_tier] = Number(row.count);
  }

  // --- Aggregate: membership by status ---
  const membersByStatus: Record<string, number> = {};
  for (const row of (membersByStatusResult.data || []) as { membership_status: string; count: number }[]) {
    membersByStatus[row.membership_status] = Number(row.count);
  }

  // --- Aggregate: members by charter ---
  const membersByCharter: Record<string, { name: string; count: number }> = {};
  for (const row of (membersByCharterResult.data || []) as {
    charter_id: string;
    charter_name: string;
    count: number;
  }[]) {
    membersByCharter[row.charter_id] = { name: row.charter_name, count: Number(row.count) };
  }

  // --- Aggregate: contributions ---
  const contribRows = (contributionsResult.data || []) as {
    contribution_type: string;
    count: number;
    total_amount: number;
  }[];
  const totalContributions = contribRows.reduce((sum, c) => sum + Number(c.total_amount), 0);
  const totalContribCount = contribRows.reduce((sum, c) => sum + Number(c.count), 0);
  const contribByType: Record<string, { count: number; total: number }> = {};
  for (const c of contribRows) {
    contribByType[c.contribution_type] = { count: Number(c.count), total: Number(c.total_amount) };
  }

  // --- Aggregate: retention ---
  const retainedCount = (membersByStatus['current'] || 0) + (membersByStatus['grace'] || 0);
  const lapsedCount = (membersByStatus['expired'] || 0) + (membersByStatus['cancelled'] || 0);
  const retentionTotal = retainedCount + lapsedCount;
  const retentionRate = retentionTotal > 0 ? Math.round((retainedCount / retentionTotal) * 100) : 0;

  // --- Aggregate: new members + growth ---
  const newMembersCurrent = Number(newMembersResult.data) || 0;
  const newMembersPrevious = Number(prevNewMembersResult.data) || 0;
  const memberGrowth = computeGrowthPercent(newMembersCurrent, newMembersPrevious);

  const prevContribRows = (prevContributionsResult.data || []) as { total_amount: number }[];
  const prevContribTotal = prevContribRows.reduce((sum, c) => sum + Number(c.total_amount), 0);
  const contribGrowth = computeGrowthPercent(totalContributions, prevContribTotal);

  // --- Expiring members (single-charter view) ---
  const expiringMembers: ExpiringMember[] =
    viewMode === 'single_charter' ? ((expiringMembersResult?.data || []) as ExpiringMember[]) : [];

  // --- Declining charters + expiring count (multi-charter view) ---
  const decliningCharters: DecliningCharter[] = [];
  const zeroGrowthCharters: string[] = [];
  let totalExpiringCount = 0;

  if (viewMode === 'multi_charter' && perCharterResults.length >= 2) {
    const [currentPerCharterResult, prevPerCharterResult] = perCharterResults;

    const currentCounts = countByCharter(currentPerCharterResult as CharterIdResult);
    const prevCounts = countByCharter(prevPerCharterResult as CharterIdResult);

    const allCharterIds = new Set([...Object.keys(currentCounts), ...Object.keys(prevCounts)]);
    for (const chId of allCharterIds) {
      const curr = currentCounts[chId] || 0;
      const prev = prevCounts[chId] || 0;
      const charterName =
        membersByCharter[chId]?.name || allCharters.find((c) => c.id === chId)?.name || 'Unknown';

      if (prev > 0 && curr < prev) {
        decliningCharters.push({ name: charterName, currentCount: curr, prevCount: prev });
      }
      if (curr === 0 && prev === 0) {
        if (membersByCharter[chId]?.count) {
          zeroGrowthCharters.push(charterName);
        }
      } else if (curr === 0) {
        zeroGrowthCharters.push(charterName);
      }
    }
    decliningCharters.sort(
      (a, b) => b.prevCount - b.currentCount - (a.prevCount - a.currentCount),
    );

    // Expiring members count across all visible charters
    const now = new Date();
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);
    const { count: expiringCount, error: expiringCountError } = await scopeByCharter(
      supabase
        .from('rlc_contacts')
        .select('*', { count: 'exact', head: true })
        .in('membership_status', ['current', 'expiring'])
        .gte('membership_expiry_date', now.toISOString())
        .lte('membership_expiry_date', in30Days.toISOString()),
      effectiveCharterIds,
    );
    if (expiringCountError) {
      logger.error('Expiring count query error:', expiringCountError.message);
      throw new Error(`Failed to fetch expiring member count: ${expiringCountError.message}`);
    }
    totalExpiringCount = expiringCount || 0;
  }

  // --- State aggregation (national multi-charter only) ---
  const memberCountByCharterId = Object.fromEntries(
    Object.entries(membersByCharter).map(([id, { count }]) => [id, count]),
  );
  const stateAggregates =
    ctx.isNational && viewMode === 'multi_charter'
      ? aggregateByState(memberCountByCharterId, allCharters)
      : [];
  // --- Computed totals ---
  const totalMembers = Object.values(membersByTier).reduce((a, b) => a + b, 0);

  // --- Header ---
  const selectedCharter = charterParam
    ? allCharters.find((ch) => ch.id === charterParam)
    : null;

  let headerTitle: string;
  let headerDescription: string;

  if (selectedCharter) {
    headerTitle = `${selectedCharter.name} Report`;
    headerDescription = LEVEL_LABELS[selectedCharter.charter_level] || selectedCharter.charter_level;
  } else if (ctx.isNational) {
    headerTitle = 'National Membership Report';
    headerDescription = 'All charters';
  } else {
    const topRole = ctx.roles.find((r) => r.charter_id);
    const topCharter = topRole ? allCharters.find((c) => c.id === topRole.charter_id) : null;
    if (topCharter) {
      headerTitle = `${topCharter.name} Report`;
      const childCount = effectiveCharterIds?.length || 0;
      headerDescription =
        childCount > 1
          ? `${childCount} charters in your ${LEVEL_LABELS[topCharter.charter_level]?.toLowerCase() || 'scope'}`
          : 'Your charter';
    } else {
      headerTitle = 'Reports';
      headerDescription = `${effectiveCharterIds?.length || 0} charters`;
    }
  }

  headerDescription += ` \u2014 ${startDate.toLocaleDateString()} \u2013 ${endDate.toLocaleDateString()}`;

  // --- Charter dropdown options ---
  const charterOptions = buildCharterOptions(allCharters, ctx.visibleCharterIds);

  return {
    viewMode,
    hasDateFilter,
    isNational: ctx.isNational,
    headerTitle,
    headerDescription,
    charterOptions,
    totalMembers,
    newMembersCurrent,
    memberGrowth,
    totalContributions,
    totalContribCount,
    contribGrowth,
    retentionRate,
    retainedCount,
    lapsedCount,
    membersByTier,
    membersByStatus,
    contribByType,
    membersByCharter,
    stateAggregates,
    decliningCharters,
    zeroGrowthCharters,
    totalExpiringCount,
    expiringMembers,
  };
}
