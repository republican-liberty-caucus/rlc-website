import type { Charter, CharterLevel } from '@/types';

// --- Charter tree helpers ---

/** Walk the charter tree downward from a root, returning [rootId, ...descendantIds]. */
export function getDescendantIds(
  charterId: string,
  charters: Pick<Charter, 'id' | 'parent_charter_id'>[]
): string[] {
  const childrenMap = new Map<string, string[]>();
  for (const ch of charters) {
    if (ch.parent_charter_id) {
      const siblings = childrenMap.get(ch.parent_charter_id) || [];
      siblings.push(ch.id);
      childrenMap.set(ch.parent_charter_id, siblings);
    }
  }

  const result: string[] = [];
  const stack = [charterId];
  const visited = new Set<string>();
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    result.push(current);
    for (const child of childrenMap.get(current) || []) {
      if (!visited.has(child)) {
        stack.push(child);
      }
    }
  }
  return result;
}

// --- Charter dropdown helpers ---

export interface CharterOption {
  id: string;
  name: string;
  charter_level: CharterLevel;
  indent: number;
}

const CHARTER_LEVEL_DEPTH: Record<CharterLevel, number> = {
  national: 0,
  multi_state_region: 1,
  state: 2,
  intra_state_region: 3,
  county: 4,
};

/** Build hierarchical dropdown options for the charter selector. */
export function buildCharterOptions(
  charters: Pick<Charter, 'id' | 'name' | 'charter_level' | 'parent_charter_id'>[],
  visibleIds: string[] | null
): CharterOption[] {
  const visibleSet = visibleIds ? new Set(visibleIds) : null;

  // Filter to visible charters
  const filtered = charters.filter(
    (ch) => visibleSet === null || visibleSet.has(ch.id)
  );

  // Sort by hierarchy depth then name
  return filtered
    .map((ch) => ({
      id: ch.id,
      name: ch.name,
      charter_level: ch.charter_level,
      indent: CHARTER_LEVEL_DEPTH[ch.charter_level] ?? 0,
    }))
    .sort((a, b) => a.indent - b.indent || a.name.localeCompare(b.name));
}

// --- Period-over-period helpers ---

export function computePreviousPeriod(
  startDate: Date,
  endDate: Date
): { prevStart: Date; prevEnd: Date } {
  const durationMs = endDate.getTime() - startDate.getTime();
  const prevEnd = new Date(startDate.getTime() - 1); // 1ms before current start
  const prevStart = new Date(prevEnd.getTime() - durationMs);
  return { prevStart, prevEnd };
}

export type GrowthDirection = 'up' | 'down' | 'neutral';

export function computeGrowthPercent(
  current: number,
  previous: number
): { value: number; direction: GrowthDirection } {
  if (previous === 0 && current === 0) {
    return { value: 0, direction: 'neutral' };
  }
  if (previous === 0) {
    return { value: 100, direction: 'up' };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  const direction: GrowthDirection =
    pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral';
  return { value: Math.abs(pct), direction };
}

// --- State aggregation ---

export interface StateAggregate {
  stateCode: string;
  stateName: string;
  count: number;
}

const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina',
  ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee',
  TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia',
};

/**
 * Group member counts by state, using charter state_code.
 * membersByCharter: map of charterId → member count
 * charters: full charter records with state_code
 */
export function aggregateByState(
  membersByCharter: Record<string, number>,
  charters: Pick<Charter, 'id' | 'state_code'>[]
): StateAggregate[] {
  const byState: Record<string, number> = {};
  const charterStateMap = new Map(
    charters.map((ch) => [ch.id, ch.state_code])
  );

  for (const [charterId, count] of Object.entries(membersByCharter)) {
    const stateCode = charterStateMap.get(charterId);
    if (stateCode) {
      byState[stateCode] = (byState[stateCode] || 0) + count;
    }
  }

  return Object.entries(byState)
    .map(([stateCode, count]) => ({
      stateCode,
      stateName: STATE_NAMES[stateCode] || stateCode,
      count,
    }))
    .sort((a, b) => b.count - a.count);
}
