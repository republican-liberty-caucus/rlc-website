'use client';

import { Megaphone, Users, Vote, Calendar } from 'lucide-react';
import { AnimatedCounter } from '@/components/ui/animated-counter';

interface ImpactSummaryProps {
  campaignsActedOn: number;
  repsContacted: number;
  eventsAttended: number;
  totalActions: number;
}

export function ImpactSummary({
  campaignsActedOn,
  repsContacted,
  eventsAttended,
  totalActions,
}: ImpactSummaryProps) {
  const stats = [
    {
      icon: <Megaphone className="h-5 w-5 text-rlc-red" />,
      value: campaignsActedOn,
      label: 'Campaigns',
      bg: 'bg-rlc-red/10',
    },
    {
      icon: <Users className="h-5 w-5 text-rlc-blue" />,
      value: repsContacted,
      label: 'Reps Contacted',
      bg: 'bg-rlc-blue/10',
    },
    {
      icon: <Calendar className="h-5 w-5 text-green-600" />,
      value: eventsAttended,
      label: 'Events',
      bg: 'bg-green-100',
    },
    {
      icon: <Vote className="h-5 w-5 text-purple-600" />,
      value: totalActions,
      label: 'Total Actions',
      bg: 'bg-purple-100',
    },
  ];

  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="mb-1 font-heading text-lg font-semibold">Your Impact</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        {totalActions > 0
          ? "Here's the difference you've made as an RLC member."
          : 'Take your first action to start building your impact.'}
      </p>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col items-center rounded-lg border p-4 text-center">
            <div className={`mb-2 flex h-10 w-10 items-center justify-center rounded-full ${stat.bg}`}>
              {stat.icon}
            </div>
            <AnimatedCounter
              value={stat.value}
              label={stat.label}
              valueClassName="block font-heading text-2xl font-bold"
              labelClassName="mt-0.5 block text-xs text-muted-foreground"
              duration={800}
              steps={20}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
