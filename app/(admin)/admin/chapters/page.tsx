import { Metadata } from 'next';
import Link from 'next/link';
import { createServerClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Plus, ExternalLink } from 'lucide-react';
import { Chapter } from '@/types';

export const metadata: Metadata = {
  title: 'Chapters - Admin',
  description: 'Manage RLC chapters',
};

interface ChapterWithCount extends Chapter {
  memberCount: number;
}

async function getChapters(): Promise<ChapterWithCount[]> {
  const supabase = createServerClient();

  const { data } = await supabase
    .from('rlc_chapters')
    .select('*')
    .order('name');

  const chapters = (data || []) as Chapter[];

  // Get member counts per chapter
  const chaptersWithCounts = await Promise.all(
    chapters.map(async (chapter) => {
      const { count } = await supabase
        .from('rlc_members')
        .select('*', { count: 'exact', head: true })
        .eq('primary_chapter_id', chapter.id);

      return { ...chapter, memberCount: count || 0 };
    })
  );

  return chaptersWithCounts;
}

export default async function AdminChaptersPage() {
  const chapters = await getChapters();

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-800',
    pending: 'bg-yellow-100 text-yellow-800',
  };

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Chapters</h1>
          <p className="mt-2 text-muted-foreground">
            {chapters.length} chapters
          </p>
        </div>
        <Button className="bg-rlc-red hover:bg-rlc-red/90">
          <Plus className="mr-2 h-4 w-4" />
          Add Chapter
        </Button>
      </div>

      {/* Chapters Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {chapters.map((chapter) => (
          <div key={chapter.id} className="rounded-lg border bg-card p-6">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="font-semibold">{chapter.name}</h3>
                {chapter.state_code && (
                  <p className="text-sm text-muted-foreground">{chapter.state_code}</p>
                )}
              </div>
              <span
                className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${
                  statusColors[chapter.status] || 'bg-gray-100'
                }`}
              >
                {chapter.status}
              </span>
            </div>

            <div className="mb-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Members</span>
                <span className="font-medium">{chapter.memberCount}</span>
              </div>
              {chapter.contact_email && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contact</span>
                  <a
                    href={`mailto:${chapter.contact_email}`}
                    className="text-rlc-red hover:underline"
                  >
                    {chapter.contact_email}
                  </a>
                </div>
              )}
              {chapter.website_url && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Website</span>
                  <a
                    href={chapter.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-rlc-red hover:underline"
                  >
                    Visit
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Link
                href={`/admin/chapters/${chapter.id}`}
                className="flex-1"
              >
                <Button variant="outline" size="sm" className="w-full">
                  Edit
                </Button>
              </Link>
              <Link
                href={`/chapters/${chapter.slug}`}
                target="_blank"
              >
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        ))}
      </div>

      {chapters.length === 0 && (
        <div className="rounded-lg border bg-muted/50 p-12 text-center">
          <h2 className="mb-4 text-xl font-semibold">No Chapters Yet</h2>
          <p className="mb-6 text-muted-foreground">
            Get started by creating your first chapter.
          </p>
          <Button className="bg-rlc-red hover:bg-rlc-red/90">
            <Plus className="mr-2 h-4 w-4" />
            Add Chapter
          </Button>
        </div>
      )}
    </div>
  );
}
