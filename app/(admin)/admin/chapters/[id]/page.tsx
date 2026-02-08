import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';
import { formatDate } from '@/lib/utils';
import { ChapterDetailForm } from '@/components/admin/chapter-detail-form';
import { ArrowLeft } from 'lucide-react';
import type { Chapter } from '@/types';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServerClient();
  const { data } = await supabase
    .from('rlc_chapters')
    .select('name')
    .eq('id', id)
    .single();

  const chapter = data as { name: string } | null;
  return {
    title: chapter ? `${chapter.name} - Admin` : 'Chapter - Admin',
  };
}

export default async function AdminChapterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  const ctx = await getAdminContext(userId);
  if (!ctx) redirect('/dashboard?error=unauthorized');

  const { id } = await params;

  // Check chapter visibility
  if (ctx.visibleChapterIds !== null && !ctx.visibleChapterIds.includes(id)) {
    redirect('/admin/chapters?error=forbidden');
  }

  const supabase = createServerClient();

  // Fetch chapter
  const { data: chapterData, error: chapterError } = await supabase
    .from('rlc_chapters')
    .select('*')
    .eq('id', id)
    .single();

  if (chapterError || !chapterData) notFound();
  const chapter = chapterData as Chapter;

  // Fetch sub-chapters, member preview, parent, and member count in parallel
  const [subChaptersRes, membersRes, parentRes, memberCountRes] = await Promise.all([
    supabase
      .from('rlc_chapters')
      .select('id, name, status, state_code')
      .eq('parent_chapter_id', id)
      .order('name'),
    supabase
      .from('rlc_members')
      .select('id, first_name, last_name, email, membership_status')
      .eq('primary_chapter_id', id)
      .order('last_name')
      .limit(10),
    chapter.parent_chapter_id
      ? supabase
          .from('rlc_chapters')
          .select('id, name')
          .eq('id', chapter.parent_chapter_id)
          .single()
      : Promise.resolve({ data: null }),
    supabase
      .from('rlc_members')
      .select('*', { count: 'exact', head: true })
      .eq('primary_chapter_id', id),
  ]);

  const subChapters = (subChaptersRes.data || []) as { id: string; name: string; status: string; state_code: string | null }[];
  const members = (membersRes.data || []) as { id: string; first_name: string; last_name: string; email: string; membership_status: string }[];
  const parentChapter = parentRes.data as { id: string; name: string } | null;
  const memberCount = memberCountRes.count;

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-800',
    forming: 'bg-yellow-100 text-yellow-800',
  };

  const memberStatusColors: Record<string, string> = {
    current: 'bg-green-100 text-green-800',
    grace: 'bg-yellow-100 text-yellow-800',
    expired: 'bg-red-100 text-red-800',
    new_member: 'bg-blue-100 text-blue-800',
  };

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/chapters"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Chapters
        </Link>
      </div>

      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{chapter.name}</h1>
          <div className="mt-2 flex items-center gap-3">
            <span className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${statusColors[chapter.status] || 'bg-gray-100'}`}>
              {chapter.status}
            </span>
            <span className="text-sm capitalize text-muted-foreground">{chapter.chapter_level.replace(/_/g, ' ')}</span>
            {chapter.state_code && (
              <span className="text-sm text-muted-foreground">{chapter.state_code}</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column: Edit Form (2/3 width) */}
        <div className="lg:col-span-2">
          <ChapterDetailForm chapter={chapter} />
        </div>

        {/* Right Column: Info Cards */}
        <div className="space-y-6">
          {/* Chapter Info Card */}
          <div className="rounded-lg border bg-card p-6">
            <h2 className="mb-4 font-semibold">Info</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Members</dt>
                <dd className="font-medium">{memberCount || 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Created</dt>
                <dd>{formatDate(chapter.created_at)}</dd>
              </div>
              {parentChapter && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Parent</dt>
                  <dd>
                    <Link href={`/admin/chapters/${parentChapter.id}`} className="text-rlc-red hover:underline">
                      {parentChapter.name}
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Sub-Chapters Card */}
          {subChapters.length > 0 && (
            <div className="rounded-lg border bg-card p-6">
              <h2 className="mb-4 font-semibold">Sub-Chapters ({subChapters.length})</h2>
              <ul className="space-y-2">
                {subChapters.map((sub) => (
                  <li key={sub.id} className="flex items-center justify-between text-sm">
                    <Link href={`/admin/chapters/${sub.id}`} className="text-rlc-red hover:underline">
                      {sub.name}
                    </Link>
                    <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${statusColors[sub.status] || 'bg-gray-100'}`}>
                      {sub.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Members Preview Card */}
          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Members</h2>
              <Link href={`/admin/members?chapter=${id}`} className="text-sm text-rlc-red hover:underline">
                View all
              </Link>
            </div>
            {members.length > 0 ? (
              <ul className="space-y-2">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between text-sm">
                    <Link href={`/admin/members/${m.id}`} className="text-rlc-red hover:underline">
                      {m.first_name} {m.last_name}
                    </Link>
                    <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${memberStatusColors[m.membership_status] || 'bg-gray-100'}`}>
                      {m.membership_status}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No members in this chapter</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
