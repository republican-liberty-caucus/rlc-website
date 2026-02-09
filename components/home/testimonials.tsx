import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Quote } from 'lucide-react';

const testimonials = [
  {
    quote:
      "The RLC was instrumental in my decision to run for public office and helping to get me elected. I don't know if I would be where I am today without their support over the years.",
    name: 'Rand Paul',
    title: 'U.S. Senator, Kentucky',
    initials: 'RP',
  },
  {
    quote:
      "If you are serious about it and want to get elected and you want to move the needle, you need to run as a Republican, and that's why the Republican Liberty Caucus is in the sweet spot right now.",
    name: 'Thomas Massie',
    title: 'U.S. Representative, Kentucky',
    initials: 'TM',
  },
];

export function Testimonials() {
  return (
    <section className="bg-muted/50 py-16">
      <div className="container mx-auto px-4">
        <h2 className="mb-12 text-center font-heading text-3xl font-bold">
          What Leaders Are Saying
        </h2>

        <div className="mx-auto max-w-4xl space-y-12">
          {testimonials.map((t, i) => (
            <div
              key={t.name}
              className={`flex flex-col items-center gap-6 md:flex-row ${
                i % 2 !== 0 ? 'md:flex-row-reverse' : ''
              }`}
            >
              <div className="flex shrink-0 flex-col items-center gap-2">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rlc-blue text-xl font-bold text-white">
                  {t.initials}
                </div>
                <div className="text-center">
                  <p className="font-semibold">{t.name}</p>
                  <p className="text-sm text-muted-foreground">{t.title}</p>
                </div>
              </div>

              <div className="relative rounded-lg border bg-card p-6">
                <Quote className="absolute -top-3 left-4 h-6 w-6 fill-rlc-red/20 text-rlc-red" />
                <blockquote className="text-lg italic text-muted-foreground">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Button
            asChild
            size="lg"
            className="bg-rlc-red text-white hover:bg-rlc-red/90 font-semibold text-base px-8"
          >
            <Link href="/join">Join the RLC Today!</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
