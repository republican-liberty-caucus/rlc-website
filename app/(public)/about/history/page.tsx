import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getWPPageContent, sanitizeWPContent } from '@/lib/wordpress/content';
import { WPContentPage } from '@/components/wordpress/wp-content-page';

export const metadata: Metadata = {
  title: 'History of the RLC',
  description: 'The founding and history of the Republican Liberty Caucus.',
};

export default async function HistoryPage() {
  const page = await getWPPageContent('history-of-the-rlc');
  if (!page?.content) notFound();

  return (
    <WPContentPage
      title="History of the RLC"
      subtitle="Our founding story and journey"
      content={sanitizeWPContent(page.content)}
    />
  );
}
