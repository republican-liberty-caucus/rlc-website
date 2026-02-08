import { Metadata } from 'next';
import { MainNav } from '@/components/navigation/main-nav';
import { Footer } from '@/components/layout/footer';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Republican Liberty Caucus terms of service.',
};

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <MainNav />

      <section className="bg-rlc-blue py-16 text-white">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-bold">Terms of Service</h1>
          <p className="mt-4 text-xl text-white/90">Last updated: February 2026</p>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="prose prose-lg mx-auto max-w-3xl">
            <h2>Acceptance of Terms</h2>
            <p>
              By accessing and using the Republican Liberty Caucus (&quot;RLC&quot;) website, you
              accept and agree to be bound by these Terms of Service. If you do not agree to these
              terms, please do not use our website.
            </p>

            <h2>Use of Website</h2>
            <p>You agree to use this website only for lawful purposes and in a manner that does not:</p>
            <ul>
              <li>Infringe the rights of any third party</li>
              <li>Restrict or inhibit anyone else&apos;s use of the website</li>
              <li>Violate any applicable local, state, national, or international law</li>
              <li>Attempt to gain unauthorized access to any part of the website</li>
            </ul>

            <h2>Membership</h2>
            <p>
              RLC membership is subject to our bylaws and organizational rules. Membership benefits,
              dues, and requirements are described on our membership pages and may be updated from
              time to time.
            </p>

            <h2>Donations</h2>
            <p>
              All donations to the Republican Liberty Caucus are voluntary contributions. Donations
              are processed securely through Stripe. The RLC is a 527 political organization;
              contributions are not tax-deductible as charitable donations.
            </p>

            <h2>Intellectual Property</h2>
            <p>
              All content on this website, including text, graphics, logos, and images, is the
              property of the Republican Liberty Caucus unless otherwise noted. You may not reproduce,
              distribute, or create derivative works from this content without our written permission.
            </p>

            <h2>User Content</h2>
            <p>
              By submitting content to our website (such as comments or forum posts), you grant the
              RLC a non-exclusive, royalty-free license to use, display, and distribute that content
              in connection with our organizational activities.
            </p>

            <h2>Disclaimer</h2>
            <p>
              This website is provided &quot;as is&quot; without warranties of any kind, either
              express or implied. The RLC does not warrant that the website will be uninterrupted or
              error-free.
            </p>

            <h2>Limitation of Liability</h2>
            <p>
              The Republican Liberty Caucus shall not be liable for any indirect, incidental, special,
              or consequential damages arising from the use of this website.
            </p>

            <h2>Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms of Service at any time. Changes will be
              effective immediately upon posting to the website. Your continued use of the website
              constitutes acceptance of the modified terms.
            </p>

            <h2>Contact</h2>
            <p>
              For questions about these Terms of Service, please contact us at{' '}
              <a href="mailto:info@rlc.org">info@rlc.org</a>.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
