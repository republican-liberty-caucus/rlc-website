import { createClient } from '@supabase/supabase-js';
import type { Database } from './client';
import type { Contact } from '@/types';
import { logger } from '@/lib/logger';

// Server-side Supabase client (uses service role key for admin operations)
export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
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
export async function getMemberByClerkId(clerkUserId: string): Promise<Contact | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('rlc_contacts')
    .select('*')
    .eq('clerk_user_id', clerkUserId)
    .single();

  if (error) {
    // PGRST116 = "Searched for exactly one row but found 0" — genuinely not found
    if (error.code === 'PGRST116') {
      return null;
    }
    logger.error(`Database error fetching member for clerk_user_id="${clerkUserId}":`, error);
    throw new Error(`Failed to fetch member: ${error.message}`);
  }

  return data as Contact;
}

// Helper to create or update a member from Clerk webhook.
// Checks for existing member by email first (handles CiviCRM-migrated members
// who don't have a clerk_user_id yet), then falls back to upsert by clerk_user_id.
export async function upsertMemberFromClerk(clerkUser: {
  id: string;
  email_addresses: Array<{ email_address: string }>;
  first_name: string | null;
  last_name: string | null;
  phone_numbers?: Array<{ phone_number: string }>;
}): Promise<Contact> {
  const supabase = createServerClient();

  const primaryEmail = clerkUser.email_addresses[0]?.email_address;
  const primaryPhone = clerkUser.phone_numbers?.[0]?.phone_number;

  if (!primaryEmail) {
    throw new Error(`Clerk user ${clerkUser.id} has no email address`);
  }

  // Check if member already exists by email (e.g. migrated from CiviCRM without clerk_user_id)
  const { data: existingByEmail, error: emailLookupError } = await supabase
    .from('rlc_contacts')
    .select('*')
    .eq('email', primaryEmail)
    .single();

  if (emailLookupError && emailLookupError.code !== 'PGRST116') {
    logger.error(`Database error looking up member by email="${primaryEmail}":`, emailLookupError);
    throw new Error(`Failed to look up member by email: ${emailLookupError.message}`);
  }

  // If found by email but missing clerk_user_id, link the Clerk account
  if (existingByEmail) {
    const member = existingByEmail as Contact;
    const updatePayload: Record<string, unknown> = {
      clerk_user_id: clerkUser.id,
      first_name: clerkUser.first_name || member.first_name,
      last_name: clerkUser.last_name || member.last_name,
    };
    if (primaryPhone) {
      updatePayload.phone = primaryPhone;
    }

    const { data, error } = await supabase
      .from('rlc_contacts')
      .update(updatePayload as never)
      .eq('id', member.id)
      .select()
      .single();

    if (error) {
      logger.error(`Error linking Clerk user ${clerkUser.id} to member ${member.id}:`, error);
      throw error;
    }

    logger.info(`Linked Clerk user ${clerkUser.id} to existing member ${member.id} (${primaryEmail})`);
    return data as Contact;
  }

  // No existing member — create new via upsert on clerk_user_id
  const upsertPayload = {
    clerk_user_id: clerkUser.id,
    email: primaryEmail,
    first_name: clerkUser.first_name || 'Unknown',
    last_name: clerkUser.last_name || 'User',
    phone: primaryPhone || null,
  };

  const { data, error } = await supabase
    .from('rlc_contacts')
    .upsert(upsertPayload as never, {
      onConflict: 'clerk_user_id',
    })
    .select()
    .single();

  if (error) {
    logger.error('Error upserting member:', error);
    throw error;
  }

  return data as Contact;
}

// Helper to get total completed contributions for a member
export async function getMemberContributionTotal(memberId: string): Promise<number> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('rlc_contributions')
    .select('amount')
    .eq('contact_id', memberId)
    .eq('payment_status', 'completed');

  if (error) {
    logger.error('Error fetching contribution total:', error);
    return 0;
  }

  const rows = data as Array<{ amount: number }> | null;
  return (rows || []).reduce((sum, row) => sum + (row.amount || 0), 0);
}
