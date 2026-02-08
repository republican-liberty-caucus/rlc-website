/**
 * HighLevel workflow notification helpers.
 *
 * Triggers HighLevel workflows by adding tags to contacts.
 * HighLevel workflow automations are configured to fire when specific tags are added.
 * Email/SMS templates and delivery are managed in the HighLevel dashboard — this
 * code only triggers the right workflows at the right time.
 */

import { searchContactByEmail, addTagsToContact } from './client';
import { logger } from '@/lib/logger';

/**
 * Trigger a HighLevel workflow for a contact by adding a workflow tag.
 * Non-fatal — logs errors but does not throw.
 */
export async function triggerWorkflow(
  email: string,
  workflowTag: string
): Promise<boolean> {
  try {
    const searchResult = await searchContactByEmail(email);
    if (!searchResult.success || !searchResult.data?.contacts?.[0]) {
      logger.error(`[HighLevel] Cannot trigger workflow "${workflowTag}": contact not found for ${email}`);
      return false;
    }

    const contact = searchResult.data.contacts[0];
    if (!contact?.id) {
      logger.error(`[HighLevel] No valid contact ID for ${email}`);
      return false;
    }
    const result = await addTagsToContact(contact.id, [workflowTag]);

    if (!result.success) {
      logger.error(`[HighLevel] Failed to add workflow tag "${workflowTag}" to ${email}:`, result.error);
      return false;
    }

    logger.info(`[HighLevel] Triggered workflow "${workflowTag}" for ${email}`);
    return true;
  } catch (err) {
    logger.error(`[HighLevel] Error triggering workflow "${workflowTag}" for ${email}:`, err);
    return false;
  }
}

/**
 * Trigger the new member welcome sequence.
 * HighLevel workflow listens for the "Welcome Sequence" tag.
 */
export async function triggerWelcomeSequence(email: string): Promise<boolean> {
  return triggerWorkflow(email, 'Welcome Sequence');
}

/**
 * Trigger a campaign action alert.
 * HighLevel workflow listens for the "Campaign Alert" tag.
 */
export async function triggerCampaignAlert(email: string): Promise<boolean> {
  return triggerWorkflow(email, 'Campaign Alert');
}

/**
 * Trigger an event registration confirmation.
 * HighLevel workflow listens for the "Event Registered" tag.
 */
export async function triggerEventRegistration(email: string): Promise<boolean> {
  return triggerWorkflow(email, 'Event Registered');
}
