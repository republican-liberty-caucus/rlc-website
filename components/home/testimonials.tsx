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

        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-2">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="relative rounded-lg border-t-4 border-t-rlc-red bg-card p-8 shadow-sm"
            >
              <Quote className="mb-4 h-8 w-8 fill-rlc-red/10 text-rlc-red" />
              <blockquote className="mb-6 text-lg leading-relaxed text-muted-foreground">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <div className="flex items-center gap-3 border-t pt-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rlc-blue text-sm font-bold text-white">
                  {t.initials}
                </div>
                <div>
                  <p className="font-semibold leading-tight">{t.name}</p>
                  <p className="text-sm text-muted-foreground">{t.title}</p>
                </div>
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
