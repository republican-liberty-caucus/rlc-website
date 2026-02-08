/**
 * HighLevel V2 API Client
 *
 * IMPORTANT: Always use V2 API. V1 is deprecated.
 * Base URL: https://services.leadconnectorhq.com
 * Version Header: 2021-07-28
 */

import { logger } from '@/lib/logger';

const HIGHLEVEL_BASE_URL = 'https://services.leadconnectorhq.com';
const HIGHLEVEL_API_VERSION = '2021-07-28';

interface HighLevelConfig {
  apiKey: string;
  locationId: string;
}

interface HighLevelContact {
  id?: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  tags?: string[];
  customField?: Record<string, string>;
}

interface HighLevelResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ===========================================
// Tier & Status tag/field mappings
// ===========================================

const TIER_TAGS: Record<string, string> = {
  student_military: 'Student/Military Member',
  individual: 'Individual Member',
  premium: 'Premium Member',
  sustaining: 'Sustaining Member',
  patron: 'Patron Member',
  benefactor: 'Benefactor Member',
  roundtable: 'Roundtable Member',
};

const STATUS_TAGS: Record<string, string> = {
  new_member: 'Membership: New',
  current: 'Membership: Current',
  grace: 'Membership: Grace',
  expired: 'Membership: Expired',
  pending: 'Membership: Pending',
  cancelled: 'Membership: Cancelled',
  deceased: 'Membership: Deceased',
  expiring: 'Membership: Expiring',
};

const ALL_TIER_TAG_VALUES = Object.values(TIER_TAGS);
const ALL_STATUS_TAG_VALUES = Object.values(STATUS_TAGS);

function getConfig(): HighLevelConfig {
  const apiKey = process.env.HIGHLEVEL_API_KEY;
  const locationId = process.env.HIGHLEVEL_LOCATION_ID;

  if (!apiKey || !locationId) {
    throw new Error('HighLevel API key and location ID are required');
  }

  return { apiKey, locationId };
}

async function fetchHighLevel<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<HighLevelResponse<T>> {
  const config = getConfig();

  try {
    const response = await fetch(`${HIGHLEVEL_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Version: HIGHLEVEL_API_VERSION,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('HighLevel API error:', errorText);
      return {
        success: false,
        error: `API error: ${response.status} - ${errorText}`,
      };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    logger.error('HighLevel fetch error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Create a new contact in HighLevel
 */
export async function createContact(contact: HighLevelContact): Promise<HighLevelResponse<{ contact: HighLevelContact }>> {
  const config = getConfig();

  return fetchHighLevel('/contacts/', {
    method: 'POST',
    body: JSON.stringify({
      ...contact,
      locationId: config.locationId,
    }),
  });
}

/**
 * Update an existing contact in HighLevel
 */
export async function updateContact(
  contactId: string,
  updates: Partial<HighLevelContact>
): Promise<HighLevelResponse<{ contact: HighLevelContact }>> {
  return fetchHighLevel(`/contacts/${contactId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

/**
 * Get a contact by ID
 */
export async function getContact(contactId: string): Promise<HighLevelResponse<{ contact: HighLevelContact }>> {
  return fetchHighLevel(`/contacts/${contactId}`, {
    method: 'GET',
  });
}

/**
 * Search contacts by email
 */
export async function searchContactByEmail(email: string): Promise<HighLevelResponse<{ contacts: HighLevelContact[] }>> {
  const config = getConfig();
  return fetchHighLevel(`/contacts/search?locationId=${config.locationId}&email=${encodeURIComponent(email)}`, {
    method: 'GET',
  });
}

/**
 * Add tags to a contact
 */
export async function addTagsToContact(contactId: string, tags: string[]): Promise<HighLevelResponse<{ contact: HighLevelContact }>> {
  return fetchHighLevel(`/contacts/${contactId}/tags`, {
    method: 'POST',
    body: JSON.stringify({ tags }),
  });
}

/**
 * Remove tags from a contact
 */
export async function removeTagsFromContact(contactId: string, tags: string[]): Promise<HighLevelResponse<void>> {
  return fetchHighLevel(`/contacts/${contactId}/tags`, {
    method: 'DELETE',
    body: JSON.stringify({ tags }),
  });
}

/**
 * Sync a member to HighLevel
 * Creates or updates the contact based on email match.
 * Manages tier/status tags — removes old tags before adding new ones.
 */
export async function syncMemberToHighLevel(member: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  membershipTier: string;
  membershipStatus: string;
  membershipStartDate?: string | null;
  membershipExpiryDate?: string | null;
  membershipJoinDate?: string | null;
  civicrmContactId?: number | null;
  chapterStateCode?: string | null;
  contributionSource?: string | null;
  primaryChapterSlug?: string | null;
}): Promise<HighLevelResponse<{ contact: HighLevelContact }>> {
  // Search for existing contact
  const searchResult = await searchContactByEmail(member.email);

  // Build tags: always include base tag + current tier + current status
  const tags = ['RLC Member'];

  const tierTag = TIER_TAGS[member.membershipTier];
  if (tierTag) tags.push(tierTag);

  const statusTag = STATUS_TAGS[member.membershipStatus];
  if (statusTag) tags.push(statusTag);

  if (member.primaryChapterSlug) {
    tags.push(`Chapter: ${member.primaryChapterSlug}`);
  }

  // Build custom field mapping per PRD Section 6
  const customFields: Record<string, string> = {
    membership_type_id: member.membershipTier,
    membership_status_id: member.membershipStatus,
    membership_id: member.id,
  };

  if (member.membershipStartDate) {
    customFields.membership_start_date = member.membershipStartDate;
  }
  if (member.membershipExpiryDate) {
    customFields.membership_end_date = member.membershipExpiryDate;
  }
  if (member.membershipJoinDate) {
    customFields.membership_join_date = member.membershipJoinDate;
    customFields.membership_join_date_initial = member.membershipJoinDate;
  }
  if (member.civicrmContactId) {
    customFields.civicrm_id = String(member.civicrmContactId);
  }
  if (member.chapterStateCode) {
    customFields.charter_state = member.chapterStateCode;
  }
  if (member.contributionSource) {
    customFields.membership_source = member.contributionSource;
  }

  const contactData: HighLevelContact = {
    email: member.email,
    firstName: member.firstName,
    lastName: member.lastName,
    phone: member.phone || undefined,
    address1: member.addressLine1 || undefined,
    city: member.city || undefined,
    state: member.state || undefined,
    postalCode: member.postalCode || undefined,
    country: 'US',
    tags,
    customField: customFields,
  };

  if (searchResult.success && searchResult.data?.contacts?.[0]) {
    const existingContact = searchResult.data.contacts[0];
    const existingId = existingContact.id!;

    // Remove old tier/status tags before applying new ones
    const existingTags = existingContact.tags || [];
    const tagsToRemove = existingTags.filter(
      (t) =>
        (ALL_TIER_TAG_VALUES.includes(t) && t !== tierTag) ||
        (ALL_STATUS_TAG_VALUES.includes(t) && t !== statusTag)
    );

    if (tagsToRemove.length > 0) {
      await removeTagsFromContact(existingId, tagsToRemove);
    }

    return updateContact(existingId, contactData);
  } else {
    return createContact(contactData);
  }
}

export type { HighLevelContact, HighLevelConfig, HighLevelResponse };
