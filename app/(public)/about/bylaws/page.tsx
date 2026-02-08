import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getWPPageContent, sanitizeWPContent } from '@/lib/wordpress/content';
import { WPContentPage } from '@/components/wordpress/wp-content-page';

export const metadata: Metadata = {
  title: 'Bylaws & Rules',
  description: 'Official bylaws and rules of the Republican Liberty Caucus.',
};

export default async function BylawsPage() {
  const page = await getWPPageContent('bylaws-rules');
  if (!page?.content) notFound();

  return (
    <WPContentPage
      title="Bylaws & Rules"
      subtitle="Official governing documents of the Republican Liberty Caucus"
      content={sanitizeWPContent(page.content)}
    />
  );
}
