'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { AnimatedCounter } from '@/components/ui/animated-counter';

interface HeroSectionProps {
  memberCount: number;
  charterCount: number;
}

export function HeroSection({ memberCount, charterCount }: HeroSectionProps) {
  const yearsFighting = new Date().getFullYear() - 1991;
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-rlc-blue via-rlc-blue to-rlc-red py-20 text-white sm:py-28">
      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 opacity-5">
        <div
          className="h-full w-full"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <div className="container relative mx-auto px-4">
        <div className="mx-auto max-w-4xl text-center">
          <motion.h1
            className="mb-6 font-heading text-4xl font-bold uppercase tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            Defending Liberty
            <br />
            <span className="text-white">Within the GOP</span>
          </motion.h1>
          <motion.p
            className="mx-auto mb-10 max-w-2xl text-lg text-white/90 sm:text-xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            The Republican Liberty Caucus is a grassroots army advancing individual rights,
            limited government, and free markets. Every action you take moves the needle.
          </motion.p>
          <motion.div
            className="flex flex-col justify-center gap-4 sm:flex-row"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Button
              asChild
              size="lg"
              className="bg-white text-rlc-red hover:bg-white/90 font-semibold text-base px-8"
            >
              <Link href="/action-center">Take Action Now</Link>
            </Button>
            <Button
              asChild
              size="lg"
              className="border-2 border-white bg-transparent text-white hover:bg-white/15 font-semibold text-base px-8"
            >
              <Link href="/join">Join the Movement</Link>
            </Button>
          </motion.div>
        </div>

        {/* Live stat counters */}
        <motion.div
          className="mx-auto mt-16 grid max-w-2xl grid-cols-3 gap-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <AnimatedCounter
            value={memberCount}
            label="Members"
            suffix="+"
            valueClassName="block font-heading text-4xl font-bold sm:text-5xl"
            labelClassName="mt-1 block text-sm uppercase tracking-wider text-white/70"
            duration={1500}
            steps={40}
          />
          <AnimatedCounter
            value={charterCount}
            label="State Charters"
            valueClassName="block font-heading text-4xl font-bold sm:text-5xl"
            labelClassName="mt-1 block text-sm uppercase tracking-wider text-white/70"
            duration={1500}
            steps={40}
          />
          <AnimatedCounter
            value={yearsFighting}
            label="Years Fighting"
            suffix="+"
            valueClassName="block font-heading text-4xl font-bold sm:text-5xl"
            labelClassName="mt-1 block text-sm uppercase tracking-wider text-white/70"
            duration={1500}
            steps={40}
          />
        </motion.div>
      </div>
    </section>
  );
}
