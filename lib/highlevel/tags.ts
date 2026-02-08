/**
 * HighLevel tag management helpers.
 *
 * Tags are used both for categorization and workflow enrollment.
 * When a tag is added that matches a HighLevel workflow trigger,
 * the workflow fires automatically.
 */

import { searchContactByEmail, addTagsToContact, removeTagsFromContact } from './client';
import { logger } from '@/lib/logger';

// Workflow trigger tags — HighLevel workflows listen for these
export const WORKFLOW_TAGS = {
  WELCOME_SEQUENCE: 'Welcome Sequence',
  CAMPAIGN_ALERT: 'Campaign Alert',
  EVENT_REGISTERED: 'Event Registered',
  MEMBERSHIP_RENEWAL_REMINDER: 'Renewal Reminder',
  MEMBERSHIP_EXPIRED: 'Membership Expired',
} as const;

// Engagement tags — for segmentation and reporting
export const ENGAGEMENT_TAGS = {
  CAMPAIGN_PARTICIPANT: 'Campaign Participant',
  EVENT_ATTENDEE: 'Event Attendee',
  DONOR: 'Donor',
  RECURRING_DONOR: 'Recurring Donor',
  SCORECARD_VISITOR: 'Scorecard Visitor',
} as const;

/**
 * Add tags to a contact by email. Non-fatal.
 */
export async function tagContactByEmail(
  email: string,
  tags: string[]
): Promise<boolean> {
  try {
    const searchResult = await searchContactByEmail(email);
    if (!searchResult.success || !searchResult.data?.contacts?.[0]) {
      logger.error(`[HighLevel Tags] Contact not found for ${email}`);
      return false;
    }

    const contact = searchResult.data.contacts[0];
    if (!contact?.id) {
      logger.error(`[HighLevel Tags] No valid contact ID for ${email}`);
      return false;
    }
    const result = await addTagsToContact(contact.id, tags);

    if (!result.success) {
      logger.error(`[HighLevel Tags] Failed to add tags to ${email}:`, result.error);
      return false;
    }

    return true;
  } catch (err) {
    logger.error(`[HighLevel Tags] Error tagging ${email}:`, err);
    return false;
  }
}

/**
 * Remove tags from a contact by email. Non-fatal.
 */
export async function untagContactByEmail(
  email: string,
  tags: string[]
): Promise<boolean> {
  try {
    const searchResult = await searchContactByEmail(email);
    if (!searchResult.success || !searchResult.data?.contacts?.[0]) {
      logger.error(`[HighLevel Tags] Contact not found for ${email}`);
      return false;
    }

    const contact = searchResult.data.contacts[0];
    if (!contact?.id) {
      logger.error(`[HighLevel Tags] No valid contact ID for ${email}`);
      return false;
    }
    const result = await removeTagsFromContact(contact.id, tags);

    if (!result.success) {
      logger.error(`[HighLevel Tags] Failed to remove tags from ${email}:`, result.error);
      return false;
    }

    return true;
  } catch (err) {
    logger.error(`[HighLevel Tags] Error untagging ${email}:`, err);
    return false;
  }
}
