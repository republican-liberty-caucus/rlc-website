import type { Metadata } from 'next';
import { Inter, Oswald } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';

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
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://rlc.org',
    siteName: 'Republican Liberty Caucus',
    title: 'Republican Liberty Caucus',
    description:
      'Advancing the principles of individual rights, limited government and free markets within the Republican Party.',
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={`${inter.variable} ${oswald.variable} font-sans antialiased`}>
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
