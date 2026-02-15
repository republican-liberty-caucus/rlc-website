import { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';
import { ShareKitEditor } from '@/components/admin/share-kit-editor';
import type { ShareKit } from '@/types';

export const metadata: Metadata = {
  title: 'Edit Share Kit - Admin',
};

interface ShareKitEditPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminShareKitEditPage({ params }: ShareKitEditPageProps) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const ctx = await getAdminContext(userId);
  if (!ctx) redirect('/dashboard?error=unauthorized');

  const { id } = await params;
  const supabase = createServerClient();

  const { data: kit, error } = await supabase
    .from('rlc_share_kits')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !kit) notFound();

  // Get share stats
  const { data: links } = await supabase
    .from('rlc_share_links')
    .select('id')
    .eq('share_kit_id', id);

  const linkIds = (links || []).map((l: { id: string }) => l.id);

  let shareCount = 0;
  let clickCount = 0;

  if (linkIds.length > 0) {
    const { count: shares } = await supabase
      .from('rlc_share_events')
      .select('id', { count: 'exact', head: true })
      .in('share_link_id', linkIds);
    shareCount = shares || 0;

    const { count: clicks } = await supabase
      .from('rlc_link_clicks')
      .select('id', { count: 'exact', head: true })
      .in('share_link_id', linkIds);
    clickCount = clicks || 0;
  }

  return (
    <div>
      <div className="mb-8">
        <Link href="/admin/share-kits" className="text-sm text-muted-foreground hover:underline">
          &larr; Back to Share Kits
        </Link>
        <h1 className="mt-2 text-3xl font-bold">Edit Share Kit</h1>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Status</p>
          <p className="text-lg font-semibold capitalize">{(kit as ShareKit).status}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Type</p>
          <p className="text-lg font-semibold capitalize">{(kit as ShareKit).content_type}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Shares</p>
          <p className="text-lg font-semibold">{shareCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Clicks</p>
          <p className="text-lg font-semibold">{clickCount}</p>
        </div>
      </div>

      <ShareKitEditor kit={kit as ShareKit} />
    </div>
  );
}
