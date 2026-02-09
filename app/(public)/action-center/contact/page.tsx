import { Suspense } from 'react';
import { Metadata } from 'next';
import { MainNav } from '@/components/navigation/main-nav';
import { Footer } from '@/components/layout/footer';
import { AddressLookup } from '@/components/action-center/address-lookup';

export const metadata: Metadata = {
  title: 'Contact Your Representatives',
  description: 'Find and contact your elected officials.',
};

export default function ContactRepPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <MainNav />

      <section className="bg-gradient-to-br from-rlc-blue to-rlc-blue/80 py-12 text-white">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl font-bold">Contact Your Representatives</h1>
          <p className="mt-2 text-white/90">
            Enter your address below to find your elected officials and their contact information.
          </p>
        </div>
      </section>

      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl">
            <Suspense fallback={<div className="h-12 animate-pulse rounded-md bg-muted" />}>
              <AddressLookup showResults />
            </Suspense>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
