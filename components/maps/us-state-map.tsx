'use client';

import { useState, useCallback, useMemo, useRef, memo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ComposableMap,
  Geographies,
  Geography,
} from 'react-simple-maps';

// Self-hosted to avoid external CDN dependency
const GEO_URL = '/data/us-states-10m.json';

export interface CharterMapData {
  slug: string;
  name: string;
  state_code: string;
  status: 'active' | 'forming';
  contact_email: string | null;
  leadership: Record<string, string> | null;
}

interface USStateMapProps {
  charters: CharterMapData[];
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  stateName: string;
  charter: CharterMapData | null;
}

// FIPS code to state abbreviation mapping
const FIPS_TO_STATE: Record<string, string> = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA',
  '08': 'CO', '09': 'CT', '10': 'DE', '11': 'DC', '12': 'FL',
  '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN',
  '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME',
  '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS',
  '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH',
  '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND',
  '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
  '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT',
  '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI',
  '56': 'WY', '72': 'PR',
};

const STATUS_COLORS = {
  active: { default: '#ce1c22', hover: '#a31519' },
  forming: { default: '#e88a8d', hover: '#ce1c22' },
  none: { default: '#d1d5db', hover: '#9ca3af' },
} as const;

function getLeaderName(charter: CharterMapData | null): string | null {
  if (!charter?.leadership) return null;
  const l = charter.leadership;
  return l.chair || l.chairman || l.president || l.coordinator || Object.values(l)[0] || null;
}

function USStateMapInner({ charters }: USStateMapProps) {
  const router = useRouter();
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false, x: 0, y: 0, stateName: '', charter: null,
  });
  const lastHoveredState = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const chartersByState = useMemo(
    () => new Map(charters.map((ch) => [ch.state_code, ch])),
    [charters]
  );

  const getStatus = useCallback(
    (stateCode: string): keyof typeof STATUS_COLORS => {
      const ch = chartersByState.get(stateCode);
      if (!ch) return 'none';
      return ch.status === 'active' ? 'active' : ch.status === 'forming' ? 'forming' : 'none';
    },
    [chartersByState]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent, stateCode: string, stateName: string) => {
      // Only update tooltip content when hovering a new state
      if (lastHoveredState.current === stateCode) return;
      lastHoveredState.current = stateCode;

      const svg = (e.target as SVGElement).closest('svg');
      if (!svg) return;
      const svgRect = svg.getBoundingClientRect();
      const containerWidth = containerRef.current?.offsetWidth ?? svgRect.width;

      // Clamp tooltip position to stay within container bounds
      const rawX = e.clientX - svgRect.left;
      const clampedX = Math.max(80, Math.min(rawX, containerWidth - 80));
      const rawY = e.clientY - svgRect.top - 12;
      const flipped = rawY < 50;

      setTooltip({
        visible: true,
        x: clampedX,
        y: flipped ? rawY + 24 : rawY,
        stateName,
        charter: chartersByState.get(stateCode) || null,
      });
    },
    [chartersByState]
  );

  const handleMouseLeave = useCallback(() => {
    lastHoveredState.current = null;
    setTooltip((prev) => ({ ...prev, visible: false }));
  }, []);

  const handleClick = useCallback(
    (stateCode: string) => {
      const ch = chartersByState.get(stateCode);
      if (ch) {
        router.push(`/charters/${ch.slug}`);
      } else {
        router.push('/contact');
      }
    },
    [chartersByState, router]
  );

  return (
    <div ref={containerRef} className="relative w-full">
      <ComposableMap
        projection="geoAlbersUsa"
        projectionConfig={{ scale: 1000 }}
        width={800}
        height={500}
        className="w-full h-auto"
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const fips = geo.id as string;
              const stateCode = FIPS_TO_STATE[fips];
              const stateName = geo.properties.name as string;
              if (!stateCode) return null;

              const status = getStatus(stateCode);
              const colors = STATUS_COLORS[status];
              const charter = chartersByState.get(stateCode);

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  onMouseMove={(e) => handleMouseMove(e as unknown as React.MouseEvent, stateCode, stateName)}
                  onMouseLeave={handleMouseLeave}
                  onClick={() => handleClick(stateCode)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleClick(stateCode);
                    }
                  }}
                  aria-label={`${stateName}${charter ? ` - ${charter.name}` : ' - No charter yet'}`}
                  style={{
                    default: {
                      fill: colors.default,
                      stroke: '#ffffff',
                      strokeWidth: 0.75,
                      cursor: 'pointer',
                    },
                    hover: {
                      fill: colors.hover,
                      stroke: '#ffffff',
                      strokeWidth: 1,
                      cursor: 'pointer',
                    },
                    pressed: {
                      fill: colors.hover,
                      stroke: '#ffffff',
                      strokeWidth: 1,
                      cursor: 'pointer',
                    },
                  }}
                  className="outline-none focus-visible:stroke-[#233d93] focus-visible:stroke-[2]"
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>

      {/* Tooltip */}
      {tooltip.visible && (
        <div
          className="pointer-events-none absolute z-10 max-w-xs rounded-lg border bg-popover px-3 py-2 text-sm shadow-md"
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
            transform: tooltip.y < 50
              ? 'translate(-50%, 0)'
              : 'translate(-50%, -100%)',
          }}
        >
          <p className="font-semibold">{tooltip.stateName}</p>
          {tooltip.charter ? (
            <>
              <p className="text-xs text-muted-foreground">{tooltip.charter.name}</p>
              {tooltip.charter.status === 'forming' && (
                <p className="text-xs font-medium text-amber-600">Forming</p>
              )}
              {getLeaderName(tooltip.charter) && (
                <p className="text-xs text-muted-foreground">
                  Contact: {getLeaderName(tooltip.charter)}
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Click to start a charter</p>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: STATUS_COLORS.active.default }} />
          <span className="text-muted-foreground">Active Charter</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: STATUS_COLORS.forming.default }} />
          <span className="text-muted-foreground">Forming</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: STATUS_COLORS.none.default }} />
          <span className="text-muted-foreground">Start a Charter</span>
        </div>
      </div>
    </div>
  );
}

export const USStateMap = memo(USStateMapInner);
