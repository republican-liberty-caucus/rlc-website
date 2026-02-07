import Link from 'next/link';

const footerLinks = {
  organization: [
    { href: '/about', label: 'About Us' },
    { href: '/chapters', label: 'State Chapters' },
    { href: '/events', label: 'Events' },
    { href: '/blog', label: 'News & Blog' },
  ],
  getInvolved: [
    { href: '/join', label: 'Become a Member' },
    { href: '/donate', label: 'Donate' },
    { href: '/volunteer', label: 'Volunteer' },
    { href: '/contact', label: 'Contact Us' },
  ],
  resources: [
    { href: '/platform', label: 'Platform' },
    { href: '/resolutions', label: 'Resolutions' },
    { href: '/endorsements', label: 'Endorsements' },
    { href: '/press', label: 'Press' },
  ],
};

export function Footer() {
  return (
    <footer className="border-t bg-muted/50">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center space-x-2">
              <span className="text-xl font-bold text-rlc-red">RLC</span>
            </Link>
            <p className="mt-4 text-sm text-muted-foreground">
              The Republican Liberty Caucus is a grassroots organization working to advance the
              principles of individual rights, limited government, and free markets within the
              Republican Party.
            </p>
          </div>

          {/* Organization */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider">Organization</h3>
            <ul className="space-y-2">
              {footerLinks.organization.map((link) => (
                <li key={link.href}>
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

          {/* Get Involved */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider">Get Involved</h3>
            <ul className="space-y-2">
              {footerLinks.getInvolved.map((link) => (
                <li key={link.href}>
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

          {/* Resources */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider">Resources</h3>
            <ul className="space-y-2">
              {footerLinks.resources.map((link) => (
                <li key={link.href}>
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
