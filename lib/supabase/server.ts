import { createClient } from '@supabase/supabase-js';
import type { Database } from './client';
import type { Member } from '@/types';

// Server-side Supabase client (uses service role key for admin operations)
export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)');
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Helper to get a member by Clerk user ID
export async function getMemberByClerkId(clerkUserId: string): Promise<Member | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('rlc_members')
    .select('*')
    .eq('clerk_user_id', clerkUserId)
    .single();

  if (error) {
    // PGRST116 = "Searched for exactly one row but found 0" — genuinely not found
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error(`Database error fetching member for clerk_user_id="${clerkUserId}":`, error);
    throw new Error(`Failed to fetch member: ${error.message}`);
  }

  return data as Member;
}

// Helper to create or update a member from Clerk webhook
export async function upsertMemberFromClerk(clerkUser: {
  id: string;
  email_addresses: Array<{ email_address: string }>;
  first_name: string | null;
  last_name: string | null;
  phone_numbers?: Array<{ phone_number: string }>;
}): Promise<Member> {
  const supabase = createServerClient();

  const primaryEmail = clerkUser.email_addresses[0]?.email_address;
  const primaryPhone = clerkUser.phone_numbers?.[0]?.phone_number;

  const upsertPayload = {
    clerk_user_id: clerkUser.id,
    email: primaryEmail,
    first_name: clerkUser.first_name || 'Unknown',
    last_name: clerkUser.last_name || 'User',
    phone: primaryPhone || null,
  };

  const { data, error } = await supabase
    .from('rlc_members')
    .upsert(upsertPayload as never, {
      onConflict: 'clerk_user_id',
    })
    .select()
    .single();

  if (error) {
    console.error('Error upserting member:', error);
    throw error;
  }

  return data as Member;
}

// Helper to get total completed contributions for a member
export async function getMemberContributionTotal(memberId: string): Promise<number> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('rlc_contributions')
    .select('amount')
    .eq('member_id', memberId)
    .eq('payment_status', 'completed');

  if (error) {
    console.error('Error fetching contribution total:', error);
    return 0;
  }

  const rows = data as Array<{ amount: number }> | null;
  return (rows || []).reduce((sum, row) => sum + (row.amount || 0), 0);
}
