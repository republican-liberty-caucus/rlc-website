'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AnimatedCounterProps {
  value: number;
  label: string;
  suffix?: string;
  className?: string;
  valueClassName?: string;
  labelClassName?: string;
  duration?: number;
  steps?: number;
}

export function AnimatedCounter({
  value,
  label,
  suffix = '',
  className,
  valueClassName = 'block font-heading text-3xl font-bold sm:text-4xl',
  labelClassName = 'mt-1 block text-sm text-white/70',
  duration = 1200,
  steps = 30,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView || !value || value <= 0) return;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [isInView, value, duration, steps]);

  return (
    <div ref={ref} className={cn('text-center', className)}>
      <span className={valueClassName}>
        {count.toLocaleString()}{suffix}
      </span>
      <span className={labelClassName}>{label}</span>
    </div>
  );
}
