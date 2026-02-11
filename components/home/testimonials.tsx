import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Quote } from 'lucide-react';

const testimonials = [
  {
    quote:
      "The RLC was instrumental in my decision to run for public office and helping to get me elected. I don't know if I would be where I am today without their support over the years.",
    name: 'Rand Paul',
    title: 'U.S. Senator, Kentucky',
    image: '/images/testimonials/rand-paul.jpg',
  },
  {
    quote:
      "If you are serious about it and want to get elected and you want to move the needle, you need to run as a Republican, and that's why the Republican Liberty Caucus is in the sweet spot right now.",
    name: 'Thomas Massie',
    title: 'U.S. Representative, Kentucky',
    image: '/images/testimonials/thomas-massie.jpg',
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
              <Quote className="absolute right-6 top-6 h-10 w-10 fill-rlc-red/5 text-rlc-red/20" />
              <div className="mb-5 flex items-center gap-4">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full ring-2 ring-rlc-red/20">
                  <Image
                    src={t.image}
                    alt={t.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div>
                  <p className="text-lg font-bold leading-tight">{t.name}</p>
                  <p className="text-sm text-muted-foreground">{t.title}</p>
                </div>
              </div>
              <blockquote className="text-lg leading-relaxed text-muted-foreground">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
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
