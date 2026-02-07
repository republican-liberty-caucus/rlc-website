import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { upsertMemberFromClerk } from '@/lib/supabase/server';
import { syncMemberToHighLevel } from '@/lib/highlevel/client';

export async function POST(req: Request) {
  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occurred -- no svix headers', {
      status: 400,
    });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your secret.
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET || '');

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new Response('Error occurred', {
      status: 400,
    });
  }

  // Handle the webhook
  const eventType = evt.type;

  if (eventType === 'user.created' || eventType === 'user.updated') {
    const { id, email_addresses, first_name, last_name, phone_numbers } = evt.data;

    try {
      // Upsert member in Supabase
      const member = await upsertMemberFromClerk({
        id,
        email_addresses,
        first_name,
        last_name,
        phone_numbers,
      });

      // Sync to HighLevel
      if (member) {
        await syncMemberToHighLevel({
          id: member.id,
          email: member.email,
          firstName: member.first_name,
          lastName: member.last_name,
          phone: member.phone,
          addressLine1: member.address_line1,
          city: member.city,
          state: member.state,
          postalCode: member.postal_code,
          membershipTier: member.membership_tier,
          membershipStatus: member.membership_status,
        });
      }

      console.log(`Successfully processed ${eventType} for user ${id}`);
    } catch (error) {
      console.error(`Error processing ${eventType}:`, error);
      return new Response('Error processing webhook', { status: 500 });
    }
  }

  if (eventType === 'user.deleted') {
    const { id } = evt.data;
    console.log(`User deleted: ${id}`);
    // Note: We don't delete the member record, just mark as inactive if needed
  }

  return new Response('', { status: 200 });
}
