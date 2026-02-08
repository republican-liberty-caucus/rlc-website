import Link from 'next/link';
import Image from 'next/image';

const footerLinks = {
  organization: [
    { href: '/about', label: 'About Us' },
    { href: '/chapters', label: 'State Chapters' },
    { href: '/scorecards', label: 'Liberty Scorecards' },
    { href: '/action-center', label: 'Action Center' },
    { href: '/events', label: 'Events' },
    { href: '/blog', label: 'News & Blog' },
  ],
  getInvolved: [
    { href: '/join', label: 'Become a Member' },
    { href: '/donate', label: 'Donate' },
    { href: '/action-center', label: 'Take Action' },
    { href: '/chapters', label: 'Find Your Chapter' },
  ],
  resources: [
    { href: '/about', label: 'Our Platform' },
    { href: '/about', label: 'Resolutions' },
    { href: '/scorecards', label: 'Endorsements' },
    { href: '/blog', label: 'Press & Media' },
  ],
};

function FooterLinkSection({ title, links }: { title: string; links: Array<{ href: string; label: string }> }) {
  return (
    <div>
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider">{title}</h3>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.href + link.label}>
            <Link
              href={link.href}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="border-t bg-muted/50">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center space-x-2">
              <Image
                src="/images/rlc-logo-200.png"
                alt="Republican Liberty Caucus"
                width={160}
                height={45}
                className="h-10 w-auto"
              />
            </Link>
            <p className="mt-4 text-sm text-muted-foreground">
              The Republican Liberty Caucus is a grassroots organization working to advance the
              principles of individual rights, limited government, and free markets within the
              Republican Party.
            </p>
            {/* Social Media */}
            <div className="mt-4 flex space-x-4">
              <a
                href="https://twitter.com/rlcnational"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
                aria-label="Follow RLC on X (Twitter)"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href="https://facebook.com/republicanlibertycaucus"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
                aria-label="Follow RLC on Facebook"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>
            </div>
          </div>

          <FooterLinkSection title="Organization" links={footerLinks.organization} />
          <FooterLinkSection title="Get Involved" links={footerLinks.getInvolved} />
          <FooterLinkSection title="Resources" links={footerLinks.resources} />
        </div>

        <div className="mt-8 border-t pt-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Republican Liberty Caucus. All rights reserved.
            </p>
            <div className="flex space-x-6">
              <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
