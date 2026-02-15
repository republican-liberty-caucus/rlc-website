import { createServerClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

/**
 * Splits a full candidate name into first/last.
 * Single-word names get "(candidate)" as last name since Contact requires both.
 */
export function splitCandidateName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  const spaceIndex = trimmed.indexOf(' ');
  if (spaceIndex === -1) {
    return { firstName: trimmed, lastName: '(candidate)' };
  }
  return {
    firstName: trimmed.slice(0, spaceIndex),
    lastName: trimmed.slice(spaceIndex + 1).trim(),
  };
}

/**
 * Finds an existing contact by email (case-insensitive) or creates a new one.
 * Returns the contact ID for linking to the candidate response.
 */
export async function findOrCreateCandidateContact({
  candidateName,
  candidateEmail,
  candidateState,
}: {
  candidateName: string;
  candidateEmail: string | null | undefined;
  candidateState: string | null | undefined;
}): Promise<{ contactId: string; isNew: boolean }> {
  const supabase = createServerClient();
  const email = candidateEmail?.trim().toLowerCase() || null;

  // Try to find existing contact by email
  if (email) {
    const { data: existing, error: lookupError } = await supabase
      .from('rlc_members')
      .select('id')
      .ilike('email', email)
      .single();

    if (lookupError && lookupError.code !== 'PGRST116') {
      logger.error('Error looking up contact by email:', lookupError);
      throw new Error(`Failed to look up contact: ${lookupError.message}`);
    }

    if (existing) {
      const contactId = (existing as { id: string }).id;
      await ensureCandidateRole(contactId);
      return { contactId, isNew: false };
    }
  }

  // No match — create new contact
  const { firstName, lastName } = splitCandidateName(candidateName);

  const { data: newContact, error: insertError } = await supabase
    .from('rlc_members')
    .insert({
      first_name: firstName,
      last_name: lastName,
      email: email || undefined,
      state: candidateState || undefined,
      membership_status: 'pending',
    } as never)
    .select('id')
    .single();

  if (insertError) {
    // Race condition: another request created this contact between our lookup and insert
    if (insertError.code === '23505' && email) {
      const { data: retryLookup, error: retryError } = await supabase
        .from('rlc_members')
        .select('id')
        .ilike('email', email)
        .single();

      if (retryError || !retryLookup) {
        logger.error('Race condition recovery failed:', retryError);
        throw new Error('Failed to create or find contact');
      }

      const contactId = (retryLookup as { id: string }).id;
      await ensureCandidateRole(contactId);
      return { contactId, isNew: false };
    }

    logger.error('Error creating candidate contact:', insertError);
    throw new Error(`Failed to create contact: ${insertError.message}`);
  }

  const contactId = (newContact as { id: string }).id;
  await ensureCandidateRole(contactId);
  return { contactId, isNew: true };
}

/**
 * Ensures the contact has a "candidate" role. Non-fatal — if it fails,
 * the candidate is still linked to the contact.
 */
async function ensureCandidateRole(contactId: string): Promise<void> {
  try {
    const supabase = createServerClient();
    await supabase
      .from('rlc_member_roles')
      .upsert(
        {
          contact_id: contactId,
          role: 'candidate',
          charter_id: null,
        } as never,
        { onConflict: 'contact_id,role,charter_id' }
      );
  } catch (err) {
    logger.warn('Failed to ensure candidate role (non-fatal):', err);
  }
}
