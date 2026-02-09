import { Metadata } from 'next';
import Link from 'next/link';
import { MainNav } from '@/components/navigation/main-nav';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { HandHeart, Users, Megaphone, Calendar } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Volunteer',
  description: 'Volunteer with the Republican Liberty Caucus. Help advance the cause of individual liberty within the Republican Party.',
};

export default function VolunteerPage() {
  const opportunities = [
    {
      icon: <Users className="h-6 w-6" />,
      title: 'Charter Leadership',
      description: 'Start or lead an RLC charter in your state or county. Organize local events and recruit new members.',
    },
    {
      icon: <Megaphone className="h-6 w-6" />,
      title: 'Advocacy Campaigns',
      description: 'Help run our advocacy campaigns by contacting legislators and spreading the word on key liberty bills.',
    },
    {
      icon: <Calendar className="h-6 w-6" />,
      title: 'Event Support',
      description: 'Help organize conventions, town halls, and educational events in your area.',
    },
    {
      icon: <HandHeart className="h-6 w-6" />,
      title: 'Outreach',
      description: 'Help us reach more Republicans who believe in limited government, individual rights, and free markets.',
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <MainNav />

      <section className="bg-gradient-to-br from-rlc-red to-rlc-red/80 py-16 text-white">
        <div className="container mx-auto px-4 text-center">
          <h1 className="font-heading text-4xl font-bold">Volunteer for Liberty</h1>
          <p className="mx-auto mt-4 max-w-2xl text-xl text-white/90">
            Your time and talent can make a real difference. Join fellow liberty-minded
            Republicans in advancing the cause of individual freedom.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-8 text-center font-heading text-2xl font-bold">
              Ways to Get Involved
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              {opportunities.map((opp) => (
                <div key={opp.title} className="rounded-lg border bg-card p-6">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-rlc-red/10 text-rlc-red">
                    {opp.icon}
                  </div>
                  <h3 className="font-heading text-lg font-semibold">{opp.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{opp.description}</p>
                </div>
              ))}
            </div>

            <div className="mt-12 rounded-lg border bg-muted/30 p-8 text-center">
              <h2 className="font-heading text-2xl font-bold">Ready to Volunteer?</h2>
              <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
                The best way to start is by joining the RLC and connecting with your local charter.
                Our charter leaders will help you find the best way to contribute.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button asChild className="bg-rlc-red hover:bg-rlc-red/90">
                  <Link href="/join">Join the RLC</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/charters">Find Your Charter</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/contact">Contact Us</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
