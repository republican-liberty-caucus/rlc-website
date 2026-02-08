import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getWPPageContent, sanitizeWPContent } from '@/lib/wordpress/content';
import { WPContentPage } from '@/components/wordpress/wp-content-page';

export const metadata: Metadata = {
  title: 'Committees',
  description: 'Committee structure of the Republican Liberty Caucus.',
};

export default async function CommitteesPage() {
  const page = await getWPPageContent('committees');
  if (!page?.content) notFound();

  return (
    <WPContentPage
      title="Committees"
      subtitle="RLC committee structure and membership"
      content={sanitizeWPContent(page.content)}
    />
  );
}
