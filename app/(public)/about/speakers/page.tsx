import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getWPPageContent, sanitizeWPContent } from '@/lib/wordpress/content';
import { WPContentPage } from '@/components/wordpress/wp-content-page';

export const metadata: Metadata = {
  title: 'Speakers Bureau',
  description: 'Republican Liberty Caucus speakers available for events and presentations.',
};

export default async function SpeakersPage() {
  const page = await getWPPageContent('speakers-bureau');
  if (!page?.content) notFound();

  return (
    <WPContentPage
      title="Speakers Bureau"
      subtitle="RLC speakers available for your events"
      content={sanitizeWPContent(page.content)}
    />
  );
}
