import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getWPPageContent, sanitizeWPContent } from '@/lib/wordpress/content';
import { WPContentPage } from '@/components/wordpress/wp-content-page';

export const metadata: Metadata = {
  title: 'Statement of Principles & Positions',
  description: 'The Republican Liberty Caucus statement of principles and policy positions.',
};

export default async function PrinciplesPage() {
  const page = await getWPPageContent('statement-of-principles-positions');
  if (!page?.content) notFound();

  return (
    <WPContentPage
      title="Statement of Principles & Positions"
      subtitle="Our core platform and policy positions"
      content={sanitizeWPContent(page.content)}
    />
  );
}
