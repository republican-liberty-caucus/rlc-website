import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getWPPageContent, sanitizeWPContent } from '@/lib/wordpress/content';
import { WPContentPage } from '@/components/wordpress/wp-content-page';

export const metadata: Metadata = {
  title: 'Endorsements',
  description: 'Republican Liberty Caucus national endorsements for liberty-minded candidates.',
};

export default async function EndorsementsPage() {
  const page = await getWPPageContent('endorsements');
  if (!page?.content) notFound();

  return (
    <WPContentPage
      title="Endorsements"
      subtitle="RLC-endorsed candidates for office"
      content={sanitizeWPContent(page.content)}
    />
  );
}
