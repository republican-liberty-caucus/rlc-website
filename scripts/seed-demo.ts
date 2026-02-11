/**
 * Seed / teardown demo data for RLC platform walkthrough.
 *
 * Usage:
 *   tsx --env-file=.env.local scripts/seed-demo.ts              # seed
 *   tsx --env-file=.env.local scripts/seed-demo.ts --teardown   # remove all demo data
 *
 * Env vars required:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CLERK_SECRET_KEY
 *   DEMO_ADMIN_PASSWORD  (default: DemoAdmin2026!)
 *   DEMO_MEMBER_PASSWORD (default: DemoMember2026!)
 *
 * Identification strategy:
 *   Tables WITH metadata column  → tagged { is_demo: true }
 *   Tables WITH slug column      → slugs prefixed "demo-"
 *   Tables WITHOUT either        → cleaned via FK cascade or explicit FK lookup
 */

import { createClerkClient } from '@clerk/backend';
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const clerkSecret = process.env.CLERK_SECRET_KEY;

if (!supabaseUrl || !supabaseKey || !clerkSecret) {
  console.error(
    'Missing required env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CLERK_SECRET_KEY'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const clerk = createClerkClient({ secretKey: clerkSecret });

const ADMIN_PASSWORD = process.env.DEMO_ADMIN_PASSWORD || 'DemoAdmin2026!';
const MEMBER_PASSWORD = process.env.DEMO_MEMBER_PASSWORD || 'DemoMember2026!';

const DEMO_TAG = { is_demo: true };
const id = () => crypto.randomUUID();

const isTeardown = process.argv.includes('--teardown');

// Tables that do NOT have an updated_at column (Prisma @updatedAt has no DB default)
const NO_UPDATED_AT = new Set([
  'rlc_member_roles',
  'rlc_contributions',
  'rlc_event_registrations',
  'rlc_survey_questions',
  'rlc_survey_answers',
  'rlc_scorecard_votes',
  'rlc_campaign_participations',
  'rlc_split_ledger_entries',
  'rlc_candidate_vetting_section_assignments',
  'rlc_candidate_vetting_board_votes',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function insert<T extends Record<string, unknown>>(
  table: string,
  row: T
): Promise<T & { id: string }> {
  const payload = { ...row } as Record<string, unknown>;
  if (!NO_UPDATED_AT.has(table) && !('updated_at' in payload)) {
    payload.updated_at = new Date().toISOString();
  }
  const { data, error } = await supabase.from(table).insert(payload).select().single();
  if (error) {
    console.error(`  [ERROR] ${table} insert failed:`, error.message);
    throw error;
  }
  return data as T & { id: string };
}

/** Delete rows matching a metadata tag. Returns count deleted. */
async function deleteByMeta(table: string): Promise<number> {
  const { data, error } = await supabase
    .from(table)
    .delete()
    .contains('metadata', DEMO_TAG)
    .select('id');
  if (error) return 0;
  return data?.length ?? 0;
}

/** Delete rows where slug starts with "demo-". Returns count deleted. */
async function deleteBySlug(table: string): Promise<number> {
  const { data, error } = await supabase
    .from(table)
    .delete()
    .like('slug', 'demo-%')
    .select('id');
  if (error) return 0;
  return data?.length ?? 0;
}

/** Delete rows where a column matches any of the given IDs. */
async function deleteByFk(table: string, column: string, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const { data, error } = await supabase
    .from(table)
    .delete()
    .in(column, ids)
    .select('id');
  if (error) {
    console.warn(`  [WARN] ${table}.${column}: ${error.message}`);
    return 0;
  }
  return data?.length ?? 0;
}

function logDeleted(table: string, count: number) {
  if (count > 0) console.log(`  ${table}: ${count} rows deleted`);
}

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------

async function teardown() {
  console.log('\n=== Demo Data Teardown ===\n');

  // 1. Collect demo parent IDs for FK-based cleanup
  const { data: demoCharters } = await supabase
    .from('rlc_charters')
    .select('id')
    .contains('metadata', DEMO_TAG);
  const charterIds = (demoCharters ?? []).map((r) => r.id);

  const { data: demoContacts } = await supabase
    .from('rlc_members')
    .select('id')
    .contains('metadata', DEMO_TAG);
  const contactIds = (demoContacts ?? []).map((r) => r.id);

  const { data: demoContribs } = await supabase
    .from('rlc_contributions')
    .select('id')
    .contains('metadata', DEMO_TAG);
  const contribIds = (demoContribs ?? []).map((r) => r.id);

  // 2. Explicitly delete children before parents (don't rely on CASCADE)

  // Vettings reference candidate_responses — delete vettings first
  // (vetting report sections + assignments cascade from vetting deletion)
  logDeleted('rlc_candidate_vettings', await deleteByMeta('rlc_candidate_vettings'));

  // Vetting committees: find by known demo name
  const { data: demoCommittees } = await supabase
    .from('rlc_candidate_vetting_committees')
    .select('id')
    .eq('name', 'Demo Vetting Committee');
  const committeeIds = (demoCommittees ?? []).map((r) => r.id);
  logDeleted('rlc_candidate_vetting_committee_members', await deleteByFk('rlc_candidate_vetting_committee_members', 'committee_id', committeeIds));
  logDeleted('rlc_candidate_vetting_committees', await deleteByFk('rlc_candidate_vetting_committees', 'id', committeeIds));

  // Survey family: answers → responses → questions → surveys
  const { data: demoSurveys } = await supabase
    .from('rlc_surveys')
    .select('id')
    .like('slug', 'demo-%');
  const surveyIds = (demoSurveys ?? []).map((r) => r.id);
  if (surveyIds.length > 0) {
    const { data: demoResponses } = await supabase
      .from('rlc_candidate_responses')
      .select('id')
      .in('survey_id', surveyIds);
    const responseIds = (demoResponses ?? []).map((r) => r.id);
    logDeleted('rlc_survey_answers', await deleteByFk('rlc_survey_answers', 'candidate_response_id', responseIds));
    logDeleted('rlc_candidate_responses', await deleteByFk('rlc_candidate_responses', 'survey_id', surveyIds));
    logDeleted('rlc_survey_questions', await deleteByFk('rlc_survey_questions', 'survey_id', surveyIds));
  }
  logDeleted('rlc_surveys', await deleteBySlug('rlc_surveys'));

  // Scorecard family: votes + scores → bills → sessions
  const { data: demoSessions } = await supabase
    .from('rlc_scorecard_sessions')
    .select('id')
    .like('slug', 'demo-%');
  const sessionIds = (demoSessions ?? []).map((r) => r.id);
  if (sessionIds.length > 0) {
    const { data: demoBills } = await supabase
      .from('rlc_scorecard_bills')
      .select('id')
      .in('session_id', sessionIds);
    const billIds = (demoBills ?? []).map((r) => r.id);
    logDeleted('rlc_scorecard_votes', await deleteByFk('rlc_scorecard_votes', 'bill_id', billIds));
    logDeleted('rlc_scorecard_legislator_scores', await deleteByFk('rlc_scorecard_legislator_scores', 'session_id', sessionIds));
    logDeleted('rlc_scorecard_bills', await deleteByFk('rlc_scorecard_bills', 'session_id', sessionIds));
  }
  logDeleted('rlc_scorecard_sessions', await deleteBySlug('rlc_scorecard_sessions'));

  // Action campaigns: participations → campaigns
  logDeleted('rlc_campaign_participations', await deleteByMeta('rlc_campaign_participations'));
  logDeleted('rlc_action_campaigns', await deleteBySlug('rlc_action_campaigns'));
  // Events: registrations → events
  logDeleted('rlc_event_registrations', await deleteByMeta('rlc_event_registrations'));
  logDeleted('rlc_events', await deleteBySlug('rlc_events'));
  logDeleted('rlc_posts', await deleteBySlug('rlc_posts'));

  // 3. FK-based deletes for dues sharing tables
  logDeleted('rlc_split_ledger_entries', await deleteByFk('rlc_split_ledger_entries', 'contribution_id', contribIds));
  logDeleted('rlc_charter_split_rules', await deleteByFk('rlc_charter_split_rules', 'recipient_charter_id', charterIds));
  logDeleted('rlc_charter_split_configs', await deleteByFk('rlc_charter_split_configs', 'charter_id', charterIds));
  logDeleted('rlc_charter_stripe_accounts', await deleteByFk('rlc_charter_stripe_accounts', 'charter_id', charterIds));

  // 5. Remaining metadata tables
  logDeleted('rlc_contributions', await deleteByMeta('rlc_contributions'));
  logDeleted('rlc_memberships', await deleteByMeta('rlc_memberships'));
  logDeleted('rlc_legislators', await deleteByMeta('rlc_legislators'));

  // 6. Member roles cascade from contact deletion, but delete explicitly to be safe
  logDeleted('rlc_member_roles', await deleteByFk('rlc_member_roles', 'contact_id', contactIds));

  // 7. Contacts, then charters
  logDeleted('rlc_members', await deleteByMeta('rlc_members'));
  logDeleted('rlc_charters', await deleteByMeta('rlc_charters'));

  // 8. Remove Clerk demo users
  for (const email of ['demo-admin@example.com', 'demo-member@example.com']) {
    const users = await clerk.users.getUserList({ emailAddress: [email] });
    for (const user of users.data) {
      await clerk.users.deleteUser(user.id);
      console.log(`  Clerk user deleted: ${email} (${user.id})`);
    }
  }

  console.log('\nTeardown complete.\n');
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function seed() {
  console.log('\n=== Demo Data Seed ===\n');

  // ------------------------------------------------------------------
  // 1. Clerk users
  // ------------------------------------------------------------------
  console.log('1. Creating Clerk users...');

  const adminUser = await clerk.users.createUser({
    emailAddress: ['demo-admin@example.com'],
    password: ADMIN_PASSWORD,
    firstName: 'Sarah',
    lastName: 'Liberty',
    publicMetadata: { role: 'super_admin' },
    skipPasswordChecks: true,
  });
  console.log(`  Admin: ${adminUser.id} (demo-admin@example.com)`);

  const memberUser = await clerk.users.createUser({
    emailAddress: ['demo-member@example.com'],
    password: MEMBER_PASSWORD,
    firstName: 'James',
    lastName: 'Freedom',
    publicMetadata: { role: 'member' },
    skipPasswordChecks: true,
  });
  console.log(`  Member: ${memberUser.id} (demo-member@example.com)`);

  // ------------------------------------------------------------------
  // 2. Charters (6: national + 3 states + 2 counties)
  // ------------------------------------------------------------------
  console.log('2. Creating charters...');

  const nationalId = id();
  const txStateId = id();
  const flStateId = id();
  const nhStateId = id();
  const txCountyId = id();
  const flCountyId = id();

  const charters = [
    {
      id: nationalId,
      name: 'Republican Liberty Caucus (National)',
      slug: 'demo-national',
      charter_level: 'national',
      parent_charter_id: null,
      state_code: null,
      status: 'active',
      contact_email: 'national@example.com',
      description: 'The national organization of the Republican Liberty Caucus.',
      metadata: DEMO_TAG,
    },
    {
      id: txStateId,
      name: 'RLC of Texas',
      slug: 'demo-texas',
      charter_level: 'state',
      parent_charter_id: nationalId,
      state_code: 'TX',
      status: 'active',
      contact_email: 'texas@example.com',
      description: 'The Texas state chapter of the Republican Liberty Caucus.',
      metadata: DEMO_TAG,
    },
    {
      id: flStateId,
      name: 'RLC of Florida',
      slug: 'demo-florida',
      charter_level: 'state',
      parent_charter_id: nationalId,
      state_code: 'FL',
      status: 'active',
      contact_email: 'florida@example.com',
      description: 'The Florida state chapter of the Republican Liberty Caucus.',
      metadata: DEMO_TAG,
    },
    {
      id: nhStateId,
      name: 'RLC of New Hampshire',
      slug: 'demo-new-hampshire',
      charter_level: 'state',
      parent_charter_id: nationalId,
      state_code: 'NH',
      status: 'active',
      contact_email: 'nh@example.com',
      description: 'The New Hampshire state chapter — Live Free or Die.',
      metadata: DEMO_TAG,
    },
    {
      id: txCountyId,
      name: 'RLC of Travis County',
      slug: 'demo-travis-county',
      charter_level: 'county',
      parent_charter_id: txStateId,
      state_code: 'TX',
      status: 'active',
      contact_email: 'travis@example.com',
      description: 'Travis County chapter, serving the Austin metro area.',
      metadata: DEMO_TAG,
    },
    {
      id: flCountyId,
      name: 'RLC of Hillsborough County',
      slug: 'demo-hillsborough-county',
      charter_level: 'county',
      parent_charter_id: flStateId,
      state_code: 'FL',
      status: 'active',
      contact_email: 'hillsborough@example.com',
      description: 'Hillsborough County chapter, serving the Tampa area.',
      metadata: DEMO_TAG,
    },
  ];

  for (const c of charters) {
    await insert('rlc_charters', c);
  }
  console.log(`  ${charters.length} charters created`);

  // ------------------------------------------------------------------
  // 3. Contacts (10: 2 demo users + 8 filler)
  // ------------------------------------------------------------------
  console.log('3. Creating contacts...');

  const adminContactId = id();
  const memberContactId = id();
  const householdId = id();

  const contacts = [
    {
      id: adminContactId,
      clerk_user_id: adminUser.id,
      email: 'demo-admin@example.com',
      first_name: 'Sarah',
      last_name: 'Liberty',
      phone: '(512) 555-0100',
      address_line1: '1100 Congress Ave',
      city: 'Austin',
      state: 'TX',
      postal_code: '78701',
      membership_tier: 'patron',
      membership_status: 'current',
      membership_start_date: '2022-01-15',
      membership_expiry_date: '2027-01-15',
      membership_join_date: '2022-01-15',
      primary_charter_id: txStateId,
      metadata: DEMO_TAG,
    },
    {
      id: memberContactId,
      clerk_user_id: memberUser.id,
      email: 'demo-member@example.com',
      first_name: 'James',
      last_name: 'Freedom',
      phone: '(813) 555-0200',
      address_line1: '601 E Kennedy Blvd',
      city: 'Tampa',
      state: 'FL',
      postal_code: '33602',
      membership_tier: 'individual',
      membership_status: 'current',
      membership_start_date: '2024-06-01',
      membership_expiry_date: '2027-06-01',
      membership_join_date: '2024-06-01',
      primary_charter_id: flStateId,
      household_id: householdId,
      household_role: 'primary',
      metadata: DEMO_TAG,
    },
    { id: id(), first_name: 'Robert', last_name: 'Hamilton', email: 'demo-hamilton@example.com', membership_tier: 'sustaining', membership_status: 'current', membership_start_date: '2023-03-10', membership_expiry_date: '2027-03-10', primary_charter_id: txStateId, city: 'Dallas', state: 'TX', metadata: DEMO_TAG },
    { id: id(), first_name: 'Emily', last_name: 'Madison', email: 'demo-madison@example.com', membership_tier: 'premium', membership_status: 'current', membership_start_date: '2023-09-20', membership_expiry_date: '2026-09-20', primary_charter_id: flStateId, city: 'Miami', state: 'FL', metadata: DEMO_TAG },
    { id: id(), first_name: 'Thomas', last_name: 'Jefferson', email: 'demo-jefferson@example.com', membership_tier: 'benefactor', membership_status: 'current', membership_start_date: '2021-07-04', membership_expiry_date: '2027-07-04', primary_charter_id: nhStateId, city: 'Concord', state: 'NH', metadata: DEMO_TAG },
    { id: id(), first_name: 'Abigail', last_name: 'Adams', email: 'demo-adams@example.com', membership_tier: 'individual', membership_status: 'grace', membership_start_date: '2024-01-15', membership_expiry_date: '2026-01-15', primary_charter_id: txCountyId, city: 'Austin', state: 'TX', metadata: DEMO_TAG },
    { id: id(), first_name: 'Benjamin', last_name: 'Franklin', email: 'demo-franklin@example.com', membership_tier: 'roundtable', membership_status: 'current', membership_start_date: '2020-11-03', membership_expiry_date: '2028-11-03', primary_charter_id: nationalId, city: 'Philadelphia', state: 'PA', metadata: DEMO_TAG },
    { id: id(), first_name: 'Martha', last_name: 'Washington', email: 'demo-washington@example.com', membership_tier: 'student_military', membership_status: 'current', membership_start_date: '2025-09-01', membership_expiry_date: '2026-09-01', primary_charter_id: flCountyId, city: 'Tampa', state: 'FL', household_id: householdId, household_role: 'spouse', primary_contact_id: memberContactId, metadata: DEMO_TAG },
    { id: id(), first_name: 'Alexander', last_name: 'Hamilton', email: 'demo-a-hamilton@example.com', membership_tier: 'individual', membership_status: 'pending', primary_charter_id: nhStateId, city: 'Manchester', state: 'NH', metadata: DEMO_TAG },
  ];

  for (const c of contacts) {
    await insert('rlc_members', c);
  }
  console.log(`  ${contacts.length} contacts created`);

  // ------------------------------------------------------------------
  // 4. Memberships + ContactRoles
  // ------------------------------------------------------------------
  console.log('4. Creating memberships & roles...');

  await insert('rlc_memberships', {
    id: id(), contact_id: adminContactId, membership_tier: 'patron', membership_status: 'current',
    start_date: '2022-01-15', expiry_date: '2027-01-15', join_date: '2022-01-15', amount: 500.0,
    metadata: DEMO_TAG,
  });
  await insert('rlc_memberships', {
    id: id(), contact_id: memberContactId, membership_tier: 'individual', membership_status: 'current',
    start_date: '2024-06-01', expiry_date: '2027-06-01', join_date: '2024-06-01', amount: 50.0,
    metadata: DEMO_TAG,
  });

  // ContactRole has NO metadata column — cleaned via FK cascade from contact deletion
  await insert('rlc_member_roles', {
    id: id(), contact_id: adminContactId, role: 'super_admin', charter_id: nationalId,
  });
  await insert('rlc_member_roles', {
    id: id(), contact_id: memberContactId, role: 'member', charter_id: flStateId,
  });

  console.log('  2 memberships + 2 roles created');

  // ------------------------------------------------------------------
  // 5. Events + Registrations
  // ------------------------------------------------------------------
  console.log('5. Creating events...');

  const event1Id = id();
  const event2Id = id();
  const event3Id = id();

  await insert('rlc_events', {
    id: event1Id, title: 'RLC National Convention 2026', slug: 'demo-national-convention-2026',
    description: 'Annual gathering of liberty-minded Republicans from across the nation. Keynote speakers, workshops, and networking.',
    event_type: 'convention', start_date: '2026-07-15T09:00:00Z', end_date: '2026-07-17T17:00:00Z',
    is_virtual: false, location_name: 'Austin Convention Center', address: '500 E Cesar Chavez St',
    city: 'Austin', state: 'TX', postal_code: '78701', registration_required: true,
    max_attendees: 500, registration_fee: 150.0, charter_id: nationalId, organizer_id: adminContactId,
    status: 'published', metadata: DEMO_TAG,
  });
  await insert('rlc_events', {
    id: event2Id, title: 'Florida Liberty Mixer', slug: 'demo-florida-liberty-mixer',
    description: 'Casual networking event for Florida RLC members and prospective members.',
    event_type: 'social', start_date: '2026-04-20T18:00:00Z', end_date: '2026-04-20T21:00:00Z',
    is_virtual: false, location_name: 'The Tap Room', city: 'Tampa', state: 'FL',
    registration_required: true, max_attendees: 75, registration_fee: 0, charter_id: flStateId,
    organizer_id: memberContactId, status: 'published', metadata: DEMO_TAG,
  });
  await insert('rlc_events', {
    id: event3Id, title: 'Virtual Town Hall: 2026 Legislative Priorities', slug: 'demo-virtual-town-hall-2026',
    description: 'Join us online to discuss key bills and legislative strategies for the 2026 session.',
    event_type: 'town_hall', start_date: '2026-03-10T19:00:00Z', end_date: '2026-03-10T20:30:00Z',
    is_virtual: true, virtual_url: 'https://zoom.us/j/demo-placeholder', registration_required: true,
    charter_id: nationalId, status: 'published', metadata: DEMO_TAG,
  });

  for (const reg of [
    { event_id: event1Id, contact_id: adminContactId },
    { event_id: event1Id, contact_id: memberContactId },
    { event_id: event2Id, contact_id: memberContactId },
    { event_id: event3Id, contact_id: adminContactId },
  ]) {
    await insert('rlc_event_registrations', {
      id: id(), ...reg, registration_status: 'registered', metadata: DEMO_TAG,
    });
  }
  console.log('  3 events + 4 registrations created');

  // ------------------------------------------------------------------
  // 6. Contributions
  // ------------------------------------------------------------------
  console.log('6. Creating contributions...');

  const contributionData = [
    { contact_id: adminContactId, contribution_type: 'membership', amount: 500.0, charter_id: nationalId },
    { contact_id: adminContactId, contribution_type: 'donation', amount: 1000.0, charter_id: nationalId },
    { contact_id: memberContactId, contribution_type: 'membership', amount: 50.0, charter_id: flStateId },
    { contact_id: memberContactId, contribution_type: 'donation', amount: 100.0, charter_id: flStateId },
    { contact_id: adminContactId, contribution_type: 'event_registration', amount: 150.0, charter_id: nationalId },
    { contact_id: memberContactId, contribution_type: 'donation', amount: 250.0, charter_id: nationalId },
  ];

  const contribIds: string[] = [];
  for (const c of contributionData) {
    const row = await insert('rlc_contributions', {
      id: id(), ...c, payment_status: 'completed', source: 'demo-seed', metadata: DEMO_TAG,
    });
    contribIds.push(row.id);
  }
  console.log(`  ${contributionData.length} contributions created`);

  // ------------------------------------------------------------------
  // 7. Blog posts
  // ------------------------------------------------------------------
  console.log('7. Creating blog posts...');

  await insert('rlc_posts', {
    id: id(), title: 'RLC Announces 2026 Convention in Austin', slug: 'demo-rlc-2026-convention-announcement',
    content: '<p>The Republican Liberty Caucus is excited to announce that our 2026 National Convention will be held at the Austin Convention Center in Austin, Texas, from July 15-17.</p><p>This year\'s theme, "Liberty Ascending," will feature keynote addresses from leading voices in the liberty movement, policy workshops on Second Amendment rights, fiscal responsibility, and criminal justice reform, and networking opportunities with liberty-minded Republicans from all 50 states.</p><p>Early bird registration is now open. Don\'t miss this opportunity to shape the future of the Republican Party.</p>',
    excerpt: 'Join us in Austin, TX for the 2026 RLC National Convention — "Liberty Ascending."',
    author_id: adminContactId, charter_id: nationalId, status: 'published', content_type: 'post',
    published_at: '2026-01-15T12:00:00Z', categories: ['Events', 'National'], tags: ['convention', '2026', 'austin'],
    metadata: DEMO_TAG,
  });
  await insert('rlc_posts', {
    id: id(), title: 'Liberty Scorecard: How Your Representatives Voted', slug: 'demo-liberty-scorecard-update',
    content: '<p>Our latest Liberty Scorecard update shows how your federal representatives voted on key liberty issues during the current congressional session.</p><p>The scorecard tracks votes on bills related to fiscal responsibility, individual rights, limited government, and free markets. Each legislator receives a liberty score based on their alignment with pro-liberty positions.</p><p>Visit our Scorecards page to see how your representatives stack up.</p>',
    excerpt: 'Check how your federal representatives scored on key liberty votes this session.',
    author_id: adminContactId, charter_id: nationalId, status: 'published', content_type: 'post',
    published_at: '2026-02-01T10:00:00Z', categories: ['Scorecards', 'Advocacy'], tags: ['scorecard', 'congress', 'voting-record'],
    metadata: DEMO_TAG,
  });
  await insert('rlc_posts', {
    id: id(), title: 'Upcoming State Legislative Priorities for 2026', slug: 'demo-state-legislative-priorities',
    content: '<p>Draft: This post will outline the key state-level legislative priorities for 2026 across our state chapters.</p><p>Topics will include property tax reform, occupational licensing, education freedom, and Second Amendment protection.</p>',
    excerpt: 'A look at key state-level legislative priorities for 2026.',
    author_id: adminContactId, status: 'draft', content_type: 'post',
    categories: ['Legislation'], tags: ['state-issues', '2026'],
    metadata: DEMO_TAG,
  });
  console.log('  3 posts created (2 published, 1 draft)');

  // ------------------------------------------------------------------
  // 8. Scorecard (use existing data if present, else seed minimal)
  // ------------------------------------------------------------------
  console.log('8. Checking scorecard data...');

  const { data: existingSessions } = await supabase
    .from('rlc_scorecard_sessions')
    .select('id')
    .eq('status', 'published')
    .limit(1);

  if (existingSessions && existingSessions.length > 0) {
    console.log('  Existing published scorecard found — skipping demo scorecard seed');
  } else {
    console.log('  No published scorecard — creating minimal demo session...');
    const demoSessionId = id();
    // No metadata column on scorecard tables — use "demo-" slug for teardown
    await insert('rlc_scorecard_sessions', {
      id: demoSessionId, name: 'Demo: 119th Congress (House)', slug: 'demo-119th-congress-house',
      jurisdiction: 'federal', session_year: 2026, chamber: 'us_house', status: 'published',
      description: 'Demo scorecard for platform walkthrough.',
    });

    const bill1Id = id();
    const bill2Id = id();
    await insert('rlc_scorecard_bills', {
      id: bill1Id, session_id: demoSessionId, bill_number: 'H.R. 0001',
      title: 'Federal Spending Transparency Act', liberty_position: 'yea',
      category: 'fiscal', weight: 1.0, sort_order: 1, bill_status: 'voted',
    });
    await insert('rlc_scorecard_bills', {
      id: bill2Id, session_id: demoSessionId, bill_number: 'H.R. 0002',
      title: 'Online Surveillance Expansion Act', liberty_position: 'nay',
      category: 'civil_liberties', weight: 1.0, sort_order: 2, bill_status: 'voted',
    });

    const legIds = [id(), id(), id()];
    const legs = [
      { id: legIds[0], name: 'Rep. Jane Constitutionalist', party: 'R', chamber: 'us_house', state_code: 'TX', district: 'TX-10', current_score: 100.0, metadata: DEMO_TAG },
      { id: legIds[1], name: 'Rep. John Moderate', party: 'R', chamber: 'us_house', state_code: 'FL', district: 'FL-14', current_score: 50.0, metadata: DEMO_TAG },
      { id: legIds[2], name: 'Rep. Bob Statist', party: 'R', chamber: 'us_house', state_code: 'NH', district: 'NH-01', current_score: 0.0, metadata: DEMO_TAG },
    ];
    for (const l of legs) await insert('rlc_legislators', l);

    const votes = [
      { id: id(), bill_id: bill1Id, legislator_id: legIds[0], vote: 'yea', aligned_with_liberty: true },
      { id: id(), bill_id: bill2Id, legislator_id: legIds[0], vote: 'nay', aligned_with_liberty: true },
      { id: id(), bill_id: bill1Id, legislator_id: legIds[1], vote: 'yea', aligned_with_liberty: true },
      { id: id(), bill_id: bill2Id, legislator_id: legIds[1], vote: 'yea', aligned_with_liberty: false },
      { id: id(), bill_id: bill1Id, legislator_id: legIds[2], vote: 'nay', aligned_with_liberty: false },
      { id: id(), bill_id: bill2Id, legislator_id: legIds[2], vote: 'yea', aligned_with_liberty: false },
    ];
    for (const v of votes) await insert('rlc_scorecard_votes', v);

    for (let i = 0; i < legIds.length; i++) {
      const aligned = votes.filter((v) => v.legislator_id === legIds[i] && v.aligned_with_liberty).length;
      await insert('rlc_scorecard_legislator_scores', {
        id: id(), session_id: demoSessionId, legislator_id: legIds[i],
        votes_aligned: aligned, total_bills: 2, absences: 0, bonus_points: 0,
        liberty_score: (aligned / 2) * 100,
      });
    }
    console.log('  Demo scorecard created (1 session, 2 bills, 3 legislators)');
  }

  // ------------------------------------------------------------------
  // 9. Survey + candidate responses
  // ------------------------------------------------------------------
  console.log('9. Creating survey...');

  const surveyId = id();
  // Survey has NO metadata column — use "demo-" slug for teardown
  await insert('rlc_surveys', {
    id: surveyId, title: 'Demo: 2026 Primary Candidate Survey', slug: 'demo-2026-primary-survey',
    description: 'Candidate endorsement survey for the 2026 Republican primary elections.',
    status: 'active', election_type: 'primary', election_date: '2026-03-03', state: 'TX',
    charter_id: txStateId, created_by: adminContactId,
  });

  const questionIds: string[] = [];
  const questions = [
    { question_text: 'Do you support a balanced budget amendment to the U.S. Constitution?', question_type: 'yes_no', options: [] as string[], weight: 1.0, sort_order: 1, ideal_answer: 'Yes' },
    { question_text: 'On a scale of 1-10, how strongly do you support reducing federal regulations on small businesses?', question_type: 'scale', options: [] as string[], weight: 1.5, sort_order: 2, ideal_answer: '10' },
    { question_text: 'Which of the following best describes your position on the Second Amendment?', question_type: 'multiple_choice', options: ['Absolute right — no infringements', 'Support with reasonable restrictions', 'Support current regulations', 'Support additional restrictions'], weight: 2.0, sort_order: 3, ideal_answer: 'Absolute right — no infringements' },
    { question_text: 'What specific steps would you take to reduce government spending in your first term?', question_type: 'text', options: [] as string[], weight: 1.0, sort_order: 4, ideal_answer: null },
    { question_text: 'Do you support eliminating the federal Department of Education?', question_type: 'yes_no', options: [] as string[], weight: 1.0, sort_order: 5, ideal_answer: 'Yes' },
  ];

  for (const q of questions) {
    const qId = id();
    questionIds.push(qId);
    await insert('rlc_survey_questions', { id: qId, survey_id: surveyId, ...q });
  }

  const candidate1Id = id();
  const candidate2Id = id();

  await insert('rlc_candidate_responses', {
    id: candidate1Id, survey_id: surveyId, candidate_name: 'John Libertarian',
    candidate_email: 'demo-libertarian@example.com', candidate_party: 'Republican',
    candidate_office: 'State Representative', candidate_district: 'TX HD-47',
    access_token: crypto.randomBytes(16).toString('hex'), status: 'submitted',
    total_score: 92.5, submitted_at: '2026-02-01T14:00:00Z',
  });
  await insert('rlc_candidate_responses', {
    id: candidate2Id, survey_id: surveyId, candidate_name: 'Jane Conservative',
    candidate_email: 'demo-conservative@example.com', candidate_party: 'Republican',
    candidate_office: 'State Representative', candidate_district: 'TX HD-47',
    access_token: crypto.randomBytes(16).toString('hex'), status: 'submitted',
    total_score: 75.0, submitted_at: '2026-02-03T10:00:00Z',
  });

  const candidate1Answers = ['Yes', '10', 'Absolute right — no infringements', 'I would push for zero-based budgeting and a full audit of all federal agencies.', 'Yes'];
  for (let i = 0; i < questionIds.length; i++) {
    await insert('rlc_survey_answers', {
      id: id(), candidate_response_id: candidate1Id, question_id: questionIds[i],
      answer: candidate1Answers[i], score: i === 3 ? null : 10.0,
    });
  }
  console.log('  1 survey, 5 questions, 2 candidates created');

  // ------------------------------------------------------------------
  // 10. Vetting case
  // ------------------------------------------------------------------
  console.log('10. Creating vetting case...');

  const committeeId = id();
  await insert('rlc_candidate_vetting_committees', {
    id: committeeId, name: 'Demo Vetting Committee', is_active: true,
  });

  const committeeMemberId = id();
  await insert('rlc_candidate_vetting_committee_members', {
    id: committeeMemberId, committee_id: committeeId, contact_id: adminContactId,
    role: 'chair', is_active: true,
  });

  const vettingId = id();
  await insert('rlc_candidate_vettings', {
    id: vettingId, candidate_response_id: candidate1Id, committee_id: committeeId,
    stage: 'committee_review', candidate_name: 'John Libertarian',
    candidate_office: 'State Representative', candidate_district: 'TX HD-47',
    candidate_state: 'TX', candidate_party: 'Republican', metadata: DEMO_TAG,
  });

  const sections: Array<{ section: string; status: string }> = [
    { section: 'executive_summary', status: 'section_completed' },
    { section: 'candidate_background', status: 'section_in_progress' },
    { section: 'digital_presence_audit', status: 'section_not_started' },
  ];

  for (const s of sections) {
    const sectionId = id();
    await insert('rlc_candidate_vetting_report_sections', {
      id: sectionId, vetting_id: vettingId, section: s.section, status: s.status,
      data: s.section === 'executive_summary'
        ? { summary: 'John Libertarian is a strong liberty candidate with a consistent record of supporting limited government and individual rights.', recommendation: 'Recommend endorsement pending full background review.' }
        : {},
    });

    if (s.section === 'executive_summary') {
      await insert('rlc_candidate_vetting_section_assignments', {
        id: id(), section_id: sectionId, committee_member_id: committeeMemberId,
        assigned_by_id: adminContactId,
      });
    }
  }
  console.log('  1 committee, 1 vetting case, 3 report sections created');

  // ------------------------------------------------------------------
  // 11. Action campaign
  // ------------------------------------------------------------------
  console.log('11. Creating action campaign...');

  const campaignId = id();
  // ActionCampaign has NO metadata column — use "demo-" slug for teardown
  await insert('rlc_action_campaigns', {
    id: campaignId, title: 'Support the Spending Transparency Act', slug: 'demo-support-spending-transparency',
    description: 'Contact your representative and urge them to vote YES on H.R. 0001, the Federal Spending Transparency Act.',
    target_chamber: 'us_house',
    message_template: 'Dear [Representative],\n\nAs your constituent, I urge you to vote YES on H.R. 0001, the Federal Spending Transparency Act. Taxpayers deserve to know how their money is being spent.\n\nSincerely,\n[Your Name]',
    status: 'active', created_by: adminContactId, charter_id: nationalId,
    starts_at: '2026-02-01T00:00:00Z', ends_at: '2026-06-30T23:59:59Z',
  });

  for (const p of [
    { contact_id: adminContactId, action: 'email_sent', legislator_id: null },
    { contact_id: memberContactId, action: 'email_sent', legislator_id: null },
    { contact_id: adminContactId, action: 'phone_call', legislator_id: null },
  ]) {
    await insert('rlc_campaign_participations', {
      id: id(), campaign_id: campaignId, ...p, metadata: DEMO_TAG,
    });
  }
  console.log('  1 campaign + 3 participations created');

  // ------------------------------------------------------------------
  // 12. Dues sharing
  // ------------------------------------------------------------------
  console.log('12. Creating dues sharing config...');

  await insert('rlc_charter_stripe_accounts', {
    id: id(), charter_id: txStateId, stripe_account_id: 'acct_demo_tx_placeholder',
    status: 'active', charges_enabled: true, payouts_enabled: true,
  });

  const splitConfigId = id();
  await insert('rlc_charter_split_configs', {
    id: splitConfigId, charter_id: nationalId, disbursement_model: 'national_managed',
    is_active: true, updated_by_id: adminContactId,
  });

  await insert('rlc_charter_split_rules', { id: id(), config_id: splitConfigId, recipient_charter_id: nationalId, percentage: 60.0, sort_order: 1, is_active: true });
  await insert('rlc_charter_split_rules', { id: id(), config_id: splitConfigId, recipient_charter_id: txStateId, percentage: 30.0, sort_order: 2, is_active: true });
  await insert('rlc_charter_split_rules', { id: id(), config_id: splitConfigId, recipient_charter_id: txCountyId, percentage: 10.0, sort_order: 3, is_active: true });

  // Use first membership contribution for ledger entries
  const membershipContribId = contribIds[0];
  await insert('rlc_split_ledger_entries', { id: id(), contribution_id: membershipContribId, source_type: 'membership', recipient_charter_id: nationalId, amount: 300.0, status: 'transferred', transferred_at: '2026-01-20T12:00:00Z', split_rule_snapshot: { percentage: 60, charter: 'National' } });
  await insert('rlc_split_ledger_entries', { id: id(), contribution_id: membershipContribId, source_type: 'membership', recipient_charter_id: txStateId, amount: 150.0, status: 'transferred', transferred_at: '2026-01-20T12:00:00Z', split_rule_snapshot: { percentage: 30, charter: 'Texas' } });
  await insert('rlc_split_ledger_entries', { id: id(), contribution_id: membershipContribId, source_type: 'membership', recipient_charter_id: txCountyId, amount: 50.0, status: 'pending', split_rule_snapshot: { percentage: 10, charter: 'Travis County' } });

  console.log('  1 Stripe account, 1 split config, 3 rules, 3 ledger entries created');

  // ------------------------------------------------------------------
  // Summary
  // ------------------------------------------------------------------
  console.log('\n=== Seed Complete ===');
  console.log(`  Admin login:  demo-admin@example.com  / ${ADMIN_PASSWORD}`);
  console.log(`  Member login: demo-member@example.com / ${MEMBER_PASSWORD}`);
  console.log('  Demo records identified by: metadata tag, "demo-" slug prefix, or FK cascade.\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

(isTeardown ? teardown() : seed()).catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
