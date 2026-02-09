import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAdminContext } from '@/lib/admin/permissions';

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ctx = await getAdminContext(userId);
  if (!ctx) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const q = request.nextUrl.searchParams.get('q')?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ contacts: [] });
  }

  const supabase = createServerClient();
  const pattern = `%${q}%`;

  const { data, error } = await supabase
    .from('rlc_contacts')
    .select('id, first_name, last_name, email')
    .or(`first_name.ilike.${pattern},last_name.ilike.${pattern}`)
    .order('last_name')
    .limit(10);

  if (error) {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }

  return NextResponse.json({ contacts: data });
}
