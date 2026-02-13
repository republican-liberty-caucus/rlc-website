import type { Metadata } from 'next';
import Script from 'next/script';
import { Inter, Oswald } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { BASE_URL } from '@/lib/constants';
import './globals.css';

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const oswald = Oswald({
  subsets: ['latin'],
  variable: '--font-heading',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: {
    default: 'Republican Liberty Caucus',
    template: '%s | RLC',
  },
  description:
    'The Republican Liberty Caucus is a grassroots organization working to advance the principles of individual rights, limited government and free markets within the Republican Party.',
  keywords: [
    'Republican Liberty Caucus',
    'RLC',
    'liberty',
    'limited government',
    'free markets',
    'individual rights',
    'Republican Party',
  ],
  authors: [{ name: 'Republican Liberty Caucus' }],
  metadataBase: new URL(BASE_URL),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: BASE_URL,
    siteName: 'Republican Liberty Caucus',
    title: 'Republican Liberty Caucus',
    description:
      'Advancing the principles of individual rights, limited government and free markets within the Republican Party.',
  },
  alternates: {
    types: {
      'application/rss+xml': `${BASE_URL}/feed.xml`,
    },
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Republican Liberty Caucus',
    description:
      'Advancing the principles of individual rights, limited government and free markets within the Republican Party.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

const organizationJsonLd = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Republican Liberty Caucus',
  url: BASE_URL,
  logo: `${BASE_URL}/images/rlc-logo-200.png`,
  sameAs: [
    'https://twitter.com/rlcnational',
    'https://facebook.com/republicanlibertycaucus',
  ],
  description:
    'The Republican Liberty Caucus is a grassroots organization working to advance the principles of individual rights, limited government and free markets within the Republican Party.',
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={`${inter.variable} ${oswald.variable} font-sans antialiased`}>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: organizationJsonLd }}
          />
          {GA_ID && (
            <>
              <Script
                src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
                strategy="afterInteractive"
              />
              <Script id="ga4-init" strategy="afterInteractive">
                {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}
              </Script>
            </>
          )}
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
