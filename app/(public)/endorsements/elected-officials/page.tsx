import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getWPPageContent, sanitizeWPContent } from '@/lib/wordpress/content';
import { WPContentPage } from '@/components/wordpress/wp-content-page';

export const metadata: Metadata = {
  title: 'Elected Officials',
  description: 'RLC-endorsed elected officials currently serving in office.',
};

export default async function ElectedOfficialsPage() {
  const page = await getWPPageContent('elected-officials');
  if (!page?.content) notFound();

  return (
    <WPContentPage
      title="Elected Officials"
      subtitle="RLC-endorsed office holders"
      content={sanitizeWPContent(page.content)}
    />
  );
}
