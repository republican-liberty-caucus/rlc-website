import { Metadata } from 'next';
import { MainNav } from '@/components/navigation/main-nav';
import { Footer } from '@/components/layout/footer';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Republican Liberty Caucus privacy policy.',
};

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <MainNav />

      <section className="bg-rlc-blue py-16 text-white">
        <div className="container mx-auto px-4">
          <h1 className="text-2xl font-bold sm:text-3xl md:text-4xl">Privacy Policy</h1>
          <p className="mt-4 text-xl text-white/90">Last updated: February 2026</p>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="prose prose-lg mx-auto max-w-3xl">
            <h2>Introduction</h2>
            <p>
              The Republican Liberty Caucus (&quot;RLC,&quot; &quot;we,&quot; &quot;us,&quot; or
              &quot;our&quot;) is committed to protecting the privacy of our members, supporters, and
              website visitors. This Privacy Policy describes how we collect, use, and safeguard your
              personal information.
            </p>

            <h2>Information We Collect</h2>
            <p>We may collect the following types of information:</p>
            <ul>
              <li>
                <strong>Contact information</strong> such as name, email address, phone number, and
                mailing address when you join, donate, or contact us.
              </li>
              <li>
                <strong>Membership information</strong> including membership level, charter
                affiliation, and renewal dates.
              </li>
              <li>
                <strong>Payment information</strong> processed securely through our third-party
                payment processor (Stripe). We do not store credit card numbers on our servers.
              </li>
              <li>
                <strong>Usage data</strong> such as pages visited, browser type, and device
                information collected through standard web analytics.
              </li>
            </ul>

            <h2>How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul>
              <li>Process memberships and donations</li>
              <li>Send organizational updates, newsletters, and action alerts</li>
              <li>Coordinate with state and local charters</li>
              <li>Improve our website and services</li>
              <li>Comply with legal obligations</li>
            </ul>

            <h2>Information Sharing</h2>
            <p>
              We do not sell or rent your personal information to third parties. We may share limited
              information with:
            </p>
            <ul>
              <li>RLC state charters relevant to your membership</li>
              <li>Service providers who assist with our operations (payment processing, email delivery)</li>
              <li>Legal authorities when required by law</li>
            </ul>

            <h2>Data Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect your personal
              information against unauthorized access, alteration, disclosure, or destruction.
            </p>

            <h2>Your Rights</h2>
            <p>You have the right to:</p>
            <ul>
              <li>Access the personal information we hold about you</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your information</li>
              <li>Opt out of marketing communications</li>
            </ul>

            <h2>Cookies</h2>
            <p>
              Our website uses cookies and similar technologies to enhance your browsing experience
              and analyze site usage. You can control cookie preferences through your browser
              settings.
            </p>

            <h2>Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy or wish to exercise your rights, please
              contact us at{' '}
              <a href="mailto:info@rlc.org">info@rlc.org</a>.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
