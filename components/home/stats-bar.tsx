import { AnimatedCounter } from '@/components/ui/animated-counter';

interface Stat {
  value: number;
  label: string;
  suffix?: string;
}

interface StatsBarProps {
  stats: Stat[];
}

const gridColsClass: Record<number, string> = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
};

export function StatsBar({ stats }: StatsBarProps) {
  const cols = Math.min(stats.length, 4);

  return (
    <section className="bg-rlc-blue py-12 text-white">
      <div className="container mx-auto px-4">
        <div className={`grid gap-8 grid-cols-2 ${gridColsClass[cols] || 'md:grid-cols-4'}`}>
          {stats.map((stat) => (
            <AnimatedCounter key={stat.label} {...stat} />
          ))}
        </div>
      </div>
    </section>
  );
}
