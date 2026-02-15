import { Metadata } from 'next';
import Link from 'next/link';
import { MainNav } from '@/components/navigation/main-nav';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { Mail, Phone, MapPin } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Get in touch with the Republican Liberty Caucus. Find contact information for the national office and your state charter.',
};

export default function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <MainNav />

      <section className="bg-rlc-blue py-16 text-white">
        <div className="container mx-auto px-4 text-center">
          <h1 className="font-heading text-2xl font-bold sm:text-3xl md:text-4xl">Contact Us</h1>
          <p className="mx-auto mt-4 max-w-2xl text-xl text-white/90">
            Have a question or want to get involved? We&apos;d love to hear from you.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl">
            <div className="grid gap-8 md:grid-cols-3">
              <div className="rounded-lg border bg-card p-6 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rlc-red/10">
                  <Mail className="h-6 w-6 text-rlc-red" />
                </div>
                <h3 className="font-heading font-semibold">Email</h3>
                <a
                  href="mailto:info@rlc.org"
                  className="mt-2 block text-sm text-rlc-blue hover:underline"
                >
                  info@rlc.org
                </a>
              </div>

              <div className="rounded-lg border bg-card p-6 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rlc-red/10">
                  <Phone className="h-6 w-6 text-rlc-red" />
                </div>
                <h3 className="font-heading font-semibold">Phone</h3>
                <a
                  href="tel:+12028211776"
                  className="mt-2 block text-sm text-rlc-blue hover:underline"
                >
                  (202) 821-1776
                </a>
              </div>

              <div className="rounded-lg border bg-card p-6 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rlc-red/10">
                  <MapPin className="h-6 w-6 text-rlc-red" />
                </div>
                <h3 className="font-heading font-semibold">Mailing Address</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  PO Box 10168<br />
                  Arlington, VA 22210
                </p>
              </div>
            </div>

            <div className="mt-12 rounded-lg border bg-card p-8 text-center">
              <h2 className="font-heading text-2xl font-bold">Want to Get Involved?</h2>
              <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
                Whether you want to volunteer, start a charter, or simply learn more about the RLC,
                we&apos;re here to help you take the next step for liberty.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button asChild className="bg-rlc-red hover:bg-rlc-red/90">
                  <Link href="/join">Become a Member</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/charters">Find Your Charter</Link>
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
