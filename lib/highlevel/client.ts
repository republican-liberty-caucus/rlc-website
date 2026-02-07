/**
 * HighLevel V2 API Client
 *
 * IMPORTANT: Always use V2 API. V1 is deprecated.
 * Base URL: https://services.leadconnectorhq.com
 * Version Header: 2021-07-28
 */

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
      console.error('HighLevel API error:', errorText);
      return {
        success: false,
        error: `API error: ${response.status} - ${errorText}`,
      };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('HighLevel fetch error:', error);
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
 * Creates or updates the contact based on email match
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
  primaryChapterSlug?: string | null;
}): Promise<HighLevelResponse<{ contact: HighLevelContact }>> {
  // Search for existing contact
  const searchResult = await searchContactByEmail(member.email);

  const tags = [
    'RLC Member',
    `RLC ${member.membershipTier.charAt(0).toUpperCase() + member.membershipTier.slice(1)}`,
  ];

  if (member.primaryChapterSlug) {
    tags.push(`Chapter: ${member.primaryChapterSlug}`);
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
    customField: {
      'membership_tier': member.membershipTier,
      'membership_status': member.membershipStatus,
      'supabase_member_id': member.id,
    },
  };

  if (searchResult.success && searchResult.data?.contacts?.[0]) {
    // Update existing contact
    const existingContact = searchResult.data.contacts[0];
    return updateContact(existingContact.id!, contactData);
  } else {
    // Create new contact
    return createContact(contactData);
  }
}

export type { HighLevelContact, HighLevelConfig, HighLevelResponse };
