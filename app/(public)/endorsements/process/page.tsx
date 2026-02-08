import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getWPPageContent, sanitizeWPContent } from '@/lib/wordpress/content';
import { WPContentPage } from '@/components/wordpress/wp-content-page';

export const metadata: Metadata = {
  title: 'Endorsement Process',
  description: 'How the Republican Liberty Caucus endorsement process works for candidates.',
};

export default async function EndorsementProcessPage() {
  const page = await getWPPageContent('candidates');
  if (!page?.content) notFound();

  return (
    <WPContentPage
      title="Endorsement Process"
      subtitle="How RLC endorsements work"
      content={sanitizeWPContent(page.content)}
    />
  );
}
