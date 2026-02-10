'use client';

import { useState, useEffect, type ReactNode } from 'react';

export interface ScorecardTab {
  id: string;
  label: string;
  content: ReactNode;
}

interface ScorecardTabsProps {
  tabs: ScorecardTab[];
  defaultTab?: string;
}

export function ScorecardTabs({ tabs, defaultTab }: ScorecardTabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id || '');

  // Sync with URL hash on mount
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && tabs.some((t) => t.id === hash)) {
      setActiveTab(hash);
    }
  }, [tabs]);

  function handleTabClick(tabId: string) {
    setActiveTab(tabId);
    window.history.replaceState(null, '', `#${tabId}`);
  }

  const active = tabs.find((t) => t.id === activeTab);

  return (
    <div>
      {/* Tab buttons */}
      <div className="mb-8 flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active tab content */}
      {active && <div>{active.content}</div>}
    </div>
  );
}
