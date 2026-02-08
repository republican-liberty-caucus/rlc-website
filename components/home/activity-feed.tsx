'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity } from 'lucide-react';

interface ActivityItem {
  id: string;
  first_name: string;
  state: string | null;
  campaign_title: string;
  action: string;
  created_at: string;
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function actionLabel(action: string): string {
  switch (action) {
    case 'contacted_rep':
      return 'contacted their rep on';
    case 'signed_petition':
      return 'signed a petition for';
    case 'shared':
      return 'shared';
    default:
      return 'took action on';
  }
}

export function ActivityFeed() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    async function fetchActivity() {
      try {
        const res = await fetch('/api/v1/activity', { signal: controller.signal });
        if (res.ok && mounted) {
          const data = await res.json();
          setItems(data.data || []);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error('[ActivityFeed] fetch failed:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchActivity();
    const interval = setInterval(fetchActivity, 60000);
    return () => {
      mounted = false;
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <section className="bg-muted/30 py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Activity className="h-4 w-4 animate-pulse" />
            <span className="text-sm">Loading activity...</span>
          </div>
        </div>
      </section>
    );
  }

  if (items.length === 0) return null;

  return (
    <section className="border-y bg-muted/30 py-6">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-3 mb-3">
          <Activity className="h-4 w-4 text-rlc-red" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Live Activity
          </h2>
        </div>
        <div className="space-y-2 max-h-48 overflow-hidden">
          <AnimatePresence mode="popLayout">
            {items.slice(0, 5).map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-2 text-sm"
              >
                <span className="h-2 w-2 rounded-full bg-green-500 flex-shrink-0" />
                <span>
                  <strong>{item.first_name}</strong>
                  {item.state && <span className="text-muted-foreground"> from {item.state}</span>}
                  {' '}{actionLabel(item.action)}{' '}
                  <strong>{item.campaign_title}</strong>
                </span>
                <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
                  {formatTimeAgo(item.created_at)}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
