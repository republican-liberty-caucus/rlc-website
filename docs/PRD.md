# PRD: RLC Website — CiviCRM & WordPress Replacement

**Version:** 1.0
**Date:** 2026-02-07
**Author:** Matt Nye / Claude
**GitHub Issue:** #1
**Status:** Draft

---

## Context

The Republican Liberty Caucus (RLC) currently runs on WordPress + CiviCRM for membership management, with HighLevel as a CRM/marketing layer. This system has significant limitations:

- CiviCRM's UI is dated and hard for non-technical chapter leaders to use
- HighLevel was used as a membership management workaround (7 separate pipelines for membership tiers, 331 custom fields) but doesn't work well for this use case
- Member data is split across CiviCRM and HighLevel with no single source of truth
- Chapter/state leaders have no self-service capability
- No modern member portal, event management, or content tools

**This project replaces the entire WordPress + CiviCRM stack** with a modern Next.js application backed by Supabase, with HighLevel retained as the marketing/communications layer (bidirectional sync where HighLevel allows).

**CiviCRM is the source of truth** for all migrated membership data.

---

## 1. Organizational Hierarchy

The RLC has a 5-level organizational hierarchy. This is the core architectural constraint.

```
National
├── Multi-State Region (e.g., "Southeast Region")
│   ├── State (e.g., "Florida")
│   │   ├── Intra-State Region (e.g., "Central Florida")
│   │   │   └── County (e.g., "Brevard County")
│   │   └── County (direct under state, no intra-state region)
│   └── State (e.g., "Georgia")
└── State (direct under national, no multi-state region)
```

**Key Rules:**
- Not every level is required — a state can exist directly under national, a county can exist directly under a state
- Members belong to one primary chapter (any level), but national membership is implicit
- Each level has its own leadership (chair, vice-chair, secretary, treasurer, at-large board members)
- Higher tiers can see/manage everything below them

### Data Model: `rlc_chapters` (self-referential)

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `name` | VARCHAR | "Republican Liberty Caucus of Florida" |
| `slug` | VARCHAR | "florida", "brevard-county" |
| `chapter_level` | ENUM | `national`, `multi_state_region`, `state`, `intra_state_region`, `county` |
| `parent_chapter_id` | UUID (nullable) | FK → self. NULL = national |
| `state_code` | CHAR(2) (nullable) | "FL" — for state/county levels |
| `region_name` | VARCHAR (nullable) | "Southeast", "Central Florida" |
| `status` | ENUM | `active`, `inactive`, `forming` |
| `website_url` | VARCHAR (nullable) | Chapter's external site if any |
| `contact_email` | VARCHAR (nullable) | |
| `leadership` | JSONB | `{chair: "uuid", vice_chair: "uuid", ...}` |
| `metadata` | JSONB | Flexible storage |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

---

## 2. Membership Tiers

Source of truth: CiviCRM's 7 membership types. These are the actual tiers the RLC uses.

| Tier | CiviCRM Name | Annual Cost | Description |
|------|-------------|-------------|-------------|
| `student_military` | Student/Military | Reduced | Discounted tier |
| `individual` | Individual | Base | Standard membership, single person |
| `premium` | Premium | Higher | **Includes spouse** — member + 1 spouse |
| `sustaining` | Sustaining | Recurring | **Family membership** — member + spouse + children |
| `patron` | Patron | Major | Major donor tier |
| `benefactor` | Benefactor | Major+ | Top individual tier |
| `roundtable` | Roundtable | Highest | Leadership roundtable |

### Household / Family Members

CiviCRM handles family members via "relationships" (spouse, child) but reporting is poor. The new system handles this better with an explicit household model.

**Design:**
- Premium members can add **1 spouse** during signup or later via dashboard
- Sustaining members can add **spouse + children** (family plan)
- Related members get their own `rlc_members` record but are linked via `household_id`
- Related members inherit the primary member's tier and status
- When primary membership expires/renews, all household members follow
- Household members can sign in with their own Clerk account and see their own dashboard
- Admin reports can show individual members AND household totals

### Data Model: Household Fields on `rlc_members`

| Field | Type | Notes |
|-------|------|-------|
| `household_id` | UUID (nullable) | Shared by all members in a household. NULL = standalone |
| `household_role` | ENUM (nullable) | `primary`, `spouse`, `child` |
| `primary_member_id` | UUID (nullable) | FK → rlc_members. Points to the paying member. NULL if primary. |

**Key Rules:**
- `household_id` is a random UUID shared by all household members (not a table, just a grouping key)
- Only the `primary` member pays and controls the membership
- Spouse/child records have their own email, can log in independently
- On the `/join` flow for Premium: after payment, prompt to "Add your spouse"
- On the `/join` flow for Sustaining: after payment, prompt to "Add family members"
- Dashboard shows household members with add/remove capability
- Admin member list can group/filter by household

### Membership Statuses

Source of truth: CiviCRM's status rules (matched in HighLevel).

| Status | CiviCRM ID | Description |
|--------|-----------|-------------|
| `new` | 1 | Just signed up, within first 3 months |
| `current` | 2 | Active, paid membership |
| `grace` | 3 | Past expiry, in grace period |
| `expired` | 4 | Past grace period |
| `pending` | 5 | Awaiting payment |
| `cancelled` | 6 | Manually cancelled |
| `deceased` | 7 | Removed from communications |
| `expiring` | 8 | Approaching expiry date (30-day warning) |

**Status transitions are automatic** (daily cron job), following CiviCRM's model:
- New → Current (after 3 months)
- Current → Expiring (30 days before end date)
- Expiring → Grace (after end date)
- Grace → Expired (after grace period, configurable per tier)
- Any → Deceased (manual, removes from all comms)

---

## 3. Data Model: `rlc_members`

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `clerk_user_id` | VARCHAR (nullable, unique) | Linked Clerk account |
| `email` | VARCHAR (unique) | Primary email |
| `first_name` | VARCHAR | |
| `last_name` | VARCHAR | |
| `phone` | VARCHAR (nullable) | |
| `address_line1` | VARCHAR (nullable) | |
| `address_line2` | VARCHAR (nullable) | |
| `city` | VARCHAR (nullable) | |
| `state` | VARCHAR (nullable) | State abbreviation |
| `postal_code` | VARCHAR (nullable) | |
| `country` | VARCHAR | Default "US" |
| `membership_tier` | ENUM | 7 tiers from Section 2 |
| `membership_status` | ENUM | 8 statuses from Section 2 |
| `membership_start_date` | TIMESTAMP (nullable) | |
| `membership_expiry_date` | TIMESTAMP (nullable) | |
| `membership_join_date` | TIMESTAMP (nullable) | Original join date (never changes) |
| `primary_chapter_id` | UUID (nullable) | FK → rlc_chapters |
| `highlevel_contact_id` | VARCHAR (nullable) | HighLevel sync |
| `civicrm_contact_id` | INT (nullable) | Migration tracking |
| `stripe_customer_id` | VARCHAR (nullable) | Payment tracking |
| `email_opt_in` | BOOLEAN | Default true |
| `sms_opt_in` | BOOLEAN | Default false |
| `do_not_phone` | BOOLEAN | Default false |
| `household_id` | UUID (nullable) | Shared grouping key for family members |
| `household_role` | ENUM (nullable) | `primary`, `spouse`, `child` |
| `primary_member_id` | UUID (nullable) | FK → self. The paying member. NULL if primary. |
| `metadata` | JSONB | Flexible storage |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

---

## 4. Role-Based Access Control

### Roles

| Role | Scope | Access |
|------|-------|--------|
| `member` | Self | View/edit own profile, view chapter info |
| `chapter_officer` | Their chapter | Manage chapter events, view chapter members |
| `chapter_admin` | Their chapter + children | Full chapter management, member management |
| `state_chair` | Their state + all sub-chapters | All state operations, appoint chapter officers |
| `regional_coordinator` | Their multi-state region | Coordinate across states |
| `national_board` | National | Full national access |
| `super_admin` | Everything | System administration |

### Data Model: `rlc_member_roles`

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `member_id` | UUID | FK → rlc_members |
| `role` | ENUM | From roles above |
| `chapter_id` | UUID (nullable) | Scoped to this chapter. NULL = national |
| `granted_by` | UUID (nullable) | FK → rlc_members |
| `granted_at` | TIMESTAMP | |
| `expires_at` | TIMESTAMP (nullable) | Term limits |
| Unique: (member_id, role, chapter_id) | | |

### Permission Resolution

A user's effective permissions are the **union of all their roles**. A state chair for Florida can see everything in the Florida chapter tree. A national board member can see everything.

---

## 5. Contributions & Payments

### Data Model: `rlc_contributions`

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `member_id` | UUID (nullable) | FK → rlc_members |
| `contribution_type` | ENUM | `membership`, `donation`, `event_registration`, `merchandise` |
| `amount` | DECIMAL(10,2) | |
| `currency` | VARCHAR | Default "USD" |
| `payment_status` | ENUM | `pending`, `completed`, `failed`, `refunded`, `cancelled` |
| `payment_method` | VARCHAR (nullable) | From CiviCRM or Stripe |
| `stripe_payment_intent_id` | VARCHAR (nullable) | |
| `stripe_subscription_id` | VARCHAR (nullable) | |
| `chapter_id` | UUID (nullable) | Which chapter gets credit |
| `campaign_id` | VARCHAR (nullable) | Campaign attribution |
| `is_recurring` | BOOLEAN | Default false |
| `recurring_interval` | VARCHAR (nullable) | "monthly", "annually" |
| `civicrm_contribution_id` | INT (nullable) | Migration tracking |
| `transaction_id` | VARCHAR (nullable) | External txn ID from CiviCRM |
| `source` | VARCHAR (nullable) | Origin of contribution |
| `metadata` | JSONB | |
| `created_at` | TIMESTAMP | |

### Payment Flow (New Members)

1. Member selects tier on `/join` page
2. Stripe Checkout session created with tier pricing
3. On success → Clerk account created → member record created → tier set
4. Stripe webhook confirms payment → contribution record created
5. Member synced to HighLevel with tags

### Renewal Flow

1. Stripe subscription auto-renews (for recurring tiers)
2. Webhook updates membership dates and creates new contribution
3. For one-time payments: expiring status triggers email reminders (via HighLevel)
4. Member can renew/upgrade via `/dashboard/renew`

---

## 6. HighLevel Integration

**Role:** Marketing/communications CRM with bidirectional sync where possible.

### Sync Direction: Website → HighLevel

On every member create/update, push to HighLevel:
- Contact fields: name, email, phone, address
- Custom fields: `membership_type_id`, `membership_status_id`, `membership_start_date`, `membership_end_date`, `membership_join_date`, `civicrm_id`, `charter_state`, `membership_source`
- Tags: membership tier tag, status tag, chapter tags, role tags

### Sync Direction: HighLevel → Website

On HighLevel contact webhook:
- If contact has `civicrm_id` or matching email → link/update member
- Communication preferences (email opt-in/out, SMS opt-in/out) flow back
- **Membership tier/status changes in HighLevel are NOT authoritative** — website is source of truth

### Existing HighLevel Assets to Preserve

| Asset | Count | Notes |
|-------|-------|-------|
| Custom Fields | 331 | Many are from imported snapshot templates — clean up needed |
| Tags | 120+ | Membership tags, chapter tags, campaign tags, engagement tags |
| Pipelines | 8 | 7 membership pipelines (one per tier) + sales pipeline |
| Calendars | Multiple | Chapter leader calendars |
| Candidate Survey | Active | Custom fields for candidate endorsement surveys |

### HighLevel Custom Field Mapping

| HighLevel Field | Website Field | Direction |
|-----------------|---------------|-----------|
| `contact.membership_type_id` | `membership_tier` | Bidirectional |
| `contact.membership_status_id` | `membership_status` | Website → HL |
| `contact.membership_start_date` | `membership_start_date` | Website → HL |
| `contact.membership_end_date` | `membership_expiry_date` | Website → HL |
| `contact.membership_join_date` | `membership_join_date` | Website → HL |
| `contact.membership_join_date_initial` | `membership_join_date` | Website → HL |
| `contact.civicrm_id` | `civicrm_contact_id` | Website → HL |
| `contact.charter_state` | Chapter state_code | Website → HL |
| `contact.membership_source` | contribution source | Website → HL |
| `contact.membership_id` | `id` (Supabase UUID) | Website → HL |

---

## 7. CiviCRM Data Migration

### Source Data (CiviCRM → Supabase)

| Entity | Estimated Count | Target Table |
|--------|----------------|--------------|
| Contacts (members only) | ~5,000-8,000 | `rlc_members` |
| Memberships | ~12,960 | Updates to `rlc_members` |
| Contributions | ~10,700 | `rlc_contributions` |
| Groups (chapters) | ~20-30 | `rlc_chapters` |
| Events | TBD | `rlc_events` (Phase 2) |
| Participants | TBD | `rlc_event_registrations` (Phase 2) |

### Tier Mapping: CiviCRM → New System

| CiviCRM Type | New Tier Enum |
|-------------|---------------|
| General / Individual | `individual` |
| Premium | `premium` |
| Sustaining | `sustaining` |
| Patron | `patron` |
| Benefactor | `benefactor` |
| Roundtable | `roundtable` |
| Student / Student/Military | `student_military` |
| Board Member | `individual` + `national_board` role |

### Status Mapping: CiviCRM → New System

| CiviCRM Status | New Status Enum |
|---------------|-----------------|
| New | `new` |
| Current | `current` |
| Grace | `grace` |
| Expired | `expired` |
| Pending | `pending` |
| Cancelled | `cancelled` |
| Deceased | `deceased` |

### Migration Scripts (Existing)

- `scripts/civicrm/export-queries.sql` — 8 SQL queries for CiviCRM export
- `scripts/civicrm/migrate-civicrm.ts` — Migration script (needs updates for new schema)
- `scripts/civicrm/sync-highlevel.ts` — Post-migration HighLevel sync

### Migration Gaps to Fix

1. **Schema mismatch**: Current Prisma schema has 5 tiers, needs 7 + 8 statuses
2. **Chapter migration**: Export queries exist but migration function doesn't
3. **Household migration**: CiviCRM stores spouse/child relationships — need to export `civicrm_relationship` table and create household records (shared `household_id`, `household_role`, `primary_member_id`)
4. **Missing fields**: `do_not_phone`, `membership_join_date` (initial), `source`, `transaction_id`, household fields
5. **Recurring contribution tracking**: CiviCRM `contribution_recur_id` not mapped to `is_recurring`
6. **Campaign attribution**: CiviCRM `campaign_id` not mapped
7. **Event/participant migration**: Queries exist, no migration function (Phase 3)
8. **Gitignore**: `scripts/civicrm/data/` not in `.gitignore`
9. **HighLevel spouse fields**: Existing `member_spouse_first_name`, `member_spouse_last_name`, `member_spouse_date_of_birth` custom fields in HighLevel should map to the spouse's own `rlc_members` record

---

## 8. Application Routes

### Public Pages (No Auth)

| Route | Purpose | Priority |
|-------|---------|----------|
| `/` | Homepage — mission, join CTA, chapters, events | P0 |
| `/about` | About the RLC, history, principles | P1 |
| `/join` | Membership signup with tier selection + Stripe | P0 |
| `/donate` | One-time donation page | P1 |
| `/chapters` | Browse chapters by state/region | P1 |
| `/chapters/[slug]` | Chapter detail — leadership, events, how to join | P1 |
| `/events` | Upcoming events list | P1 |
| `/events/[slug]` | Event detail + registration | P1 |
| `/blog` | News/blog listing | P2 |
| `/blog/[slug]` | Blog post detail | P2 |
| `/candidate-surveys` | Published candidate survey results | P2 |

### Auth Pages (Clerk)

| Route | Purpose |
|-------|---------|
| `/sign-in` | Login via Clerk (magic link, password, or social) |
| `/sign-up` | Registration (redirects to `/join` for membership) |

### Member Portal (Authenticated)

| Route | Purpose | Priority |
|-------|---------|----------|
| `/dashboard` | Member home — status, chapter, upcoming events, alerts | P0 |
| `/dashboard/profile` | Edit personal info, communication preferences | P0 |
| `/dashboard/membership` | Tier info, renewal, upgrade, payment history | P0 |
| `/dashboard/contributions` | Contribution/donation history | P1 |
| `/dashboard/events` | My registered events | P1 |
| `/dashboard/renew` | Renew or upgrade membership tier | P0 |
| `/dashboard/household` | Manage spouse/family members (Premium/Sustaining) | P1 |

### Admin Dashboard (Role-Gated)

| Route | Access Level | Purpose | Priority |
|-------|-------------|---------|----------|
| `/admin` | chapter_officer+ | Admin home with KPIs | P0 |
| `/admin/members` | chapter_admin+ | Member list, search, filter, export | P0 |
| `/admin/members/[id]` | chapter_admin+ | Member detail/edit | P0 |
| `/admin/chapters` | state_chair+ | Manage sub-chapters | P1 |
| `/admin/events` | chapter_officer+ | Create/manage events | P1 |
| `/admin/events/[id]` | chapter_officer+ | Event detail, registrations | P1 |
| `/admin/contributions` | chapter_admin+ | Contribution reports | P1 |
| `/admin/posts` | chapter_officer+ | Blog/content management | P2 |
| `/admin/settings` | chapter_admin+ | Chapter settings | P1 |
| `/admin/roles` | national_board+ | Role management | P1 |
| `/admin/reports` | chapter_admin+ | Membership/financial reports | P1 |
| `/admin/surveys` | national_board+ | Candidate survey management | P2 |

---

## 9. API Endpoints

### v1 API (Existing + New)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/v1/me` | Required | Get current member profile (auto-creates) |
| PATCH | `/api/v1/me` | Required | Update profile, syncs to HighLevel |
| GET | `/api/v1/chapters` | Public | List chapters |
| GET | `/api/v1/chapters/[id]` | Public | Chapter detail |
| GET | `/api/v1/events` | Public | Paginated events |
| GET | `/api/v1/events/[id]` | Public | Event detail |
| POST | `/api/v1/events/[id]/register` | Required | Register for event |
| GET | `/api/v1/posts` | Public | Paginated blog posts |
| GET | `/api/v1/contributions` | Required | My contributions |
| POST | `/api/v1/contributions` | Required | Create contribution (donation) |

### Admin API

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/v1/admin/members` | chapter_admin+ | Search/list members (scoped) |
| GET | `/api/v1/admin/members/[id]` | chapter_admin+ | Member detail |
| PATCH | `/api/v1/admin/members/[id]` | chapter_admin+ | Update member |
| POST | `/api/v1/admin/members/[id]/roles` | national_board+ | Assign role |
| GET | `/api/v1/admin/reports/membership` | chapter_admin+ | Membership stats |
| GET | `/api/v1/admin/reports/contributions` | chapter_admin+ | Financial stats |

### Webhooks

| Path | Source | Purpose |
|------|--------|---------|
| `/api/webhooks/clerk` | Clerk | User create/update/delete → member sync |
| `/api/webhooks/stripe` | Stripe | Payment events → contribution records + tier updates |
| `/api/webhooks/highlevel` | HighLevel | Contact updates → communication preferences |

---

## 10. Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 15 (App Router) | Already in place |
| Language | TypeScript (strict) | Already in place |
| Auth | Clerk v6 | Already configured |
| Database | Supabase (PostgreSQL) | Already configured, schema needs update |
| ORM | Prisma | Already in place |
| Payments | Stripe | Live keys configured |
| CRM | HighLevel V2 API | PIT token configured |
| Email | Resend | API key pending |
| UI | Tailwind CSS + Radix UI + shadcn/ui | Already in place |
| State | React Query + Zustand | Already in deps |
| Forms | React Hook Form + Zod | Already in deps |
| Testing | Playwright (E2E) + Vitest (unit) | Already in deps |
| Hosting | Vercel | Already deployed |

---

## 11. Implementation Phases

### Phase 0: Schema & Migration Fix (Current Sprint)
**Goal:** Get the database schema right and import CiviCRM data.

**Approach:** Full schema first, then migration. Do it right.

1. **Update Prisma schema** — 7 tiers, 8 statuses, self-referential chapters, new member fields
2. **Fix `.gitignore`** for `scripts/civicrm/data/`
3. **Seed chapters** — Hybrid approach:
   - Export CiviCRM groups (queries 6-7) as baseline
   - Cross-reference HighLevel tags (rlcfl, rlcfl brevard, rlcaz, etc.) to fill gaps
   - Import as chapter records with best-guess hierarchy
   - Matt cleans up hierarchy manually after import
4. **Update `migrate-civicrm.ts`** for new schema:
   - 7-tier mapping (Individual, Premium, Sustaining, Patron, Benefactor, Roundtable, Student/Military)
   - 8-status mapping (new, current, grace, expired, pending, cancelled, deceased, expiring)
   - Chapter assignment via CiviCRM group membership + HighLevel tags
   - New fields: `membership_join_date`, `do_not_phone`, `spouse_*`, `source`, `transaction_id`, `is_recurring`
5. **Modify export PHP script** on rlc.org — members-only contacts filter
6. **Run CiviCRM export** — Download contacts, memberships, contributions, groups to JSON
7. **Run migration** — Dry run → contacts → memberships + contributions → validate
8. **Post-migration HighLevel sync** — Push updated data with correct custom field mappings
9. **Cleanup** — Delete export PHP script from server

**Files to modify:**
- `prisma/schema.prisma` — Updated enums and models
- `types/index.ts` — Updated TypeScript types
- `scripts/civicrm/migrate-civicrm.ts` — Updated mappings + chapter migration
- `scripts/civicrm/export-queries.sql` — Ensure group/chapter queries are included
- `lib/highlevel/client.ts` — Updated custom field mappings for 7 tiers/8 statuses
- `.gitignore` — Add data directory

### Phase 1: Core Member Portal (P0)
**Goal:** Members can sign in, view/edit profile, see membership status, renew.

- `/dashboard`, `/dashboard/profile`, `/dashboard/membership`, `/dashboard/renew`
- `/join` with Stripe checkout
- Clerk webhook → member creation
- Stripe webhook → payment processing + tier assignment
- HighLevel bidirectional sync

### Phase 2: Admin & Chapter Management (P0-P1)
**Goal:** Chapter leaders can manage their members and chapter.

- `/admin` dashboard with KPIs (member counts, contribution totals, trends)
- `/admin/members` with DataTable (search, filter, sort, export)
- Role-based permission scoping (chapter admins see their tree only)
- Chapter management for state chairs

### Phase 3: Events & Content (P1-P2)
**Goal:** Events and blog functionality.

- Event creation, registration, check-in
- Blog/news with chapter-scoped posts
- Public chapter pages

### Phase 4: Advanced Features (P2)
**Goal:** Candidate surveys, reporting, analytics.

- Candidate survey system (leveraging existing HighLevel custom fields)
- Advanced reporting dashboards
- Newsletter integration
- Custom domain (rlc.org → Vercel)

---

## 12. Verification Criteria

### Phase 0 (Migration) — Done When:
- [ ] Prisma schema has 7 membership tiers and 8 statuses
- [ ] Chapter model is self-referential with `chapter_level` enum
- [ ] `scripts/civicrm/data/` is in `.gitignore`
- [ ] CiviCRM export produces members-only contacts (not 192K)
- [ ] `pnpm migrate:civicrm --dry-run` completes with 0 or minimal errors
- [ ] `pnpm migrate:civicrm --validate` shows matching counts
- [ ] Supabase `rlc_members` has records with `civicrm_contact_id` populated
- [ ] HighLevel contacts updated with correct custom fields
- [ ] Export PHP script deleted from rlc.org server

### Phase 1 (Member Portal) — Done When:
- [ ] New member can sign up via `/join`, pay via Stripe, get correct tier
- [ ] Existing member can sign in and see their profile, tier, and status
- [ ] Member can edit profile and changes sync to HighLevel
- [ ] Member can renew/upgrade membership
- [ ] Automated status transitions work (daily cron)
- [ ] Playwright E2E tests pass for auth + profile + renewal flows

### Phase 2 (Admin) — Done When:
- [ ] Chapter admin can view/search members scoped to their chapter tree
- [ ] National board can see all members across all chapters
- [ ] KPI dashboard shows membership counts, trends, contribution totals
- [ ] Member export (CSV) works with proper scoping
- [ ] Role assignment works with proper permission checks

---

## 13. Vision Features — State of the Art Organizing

These are Phase 5+ features that transform the RLC from a membership database into a **political organizing machine**. Prioritized by impact.

### Tier 1: Force Multipliers

**A. Action Center — "One Tap to Make Your Voice Heard"**
- Legislation tracking via LegiScan API (state + federal)
- AI-generated plain-language bill summaries scored against RLC liberty principles
- One-click "Contact Your Rep" — pre-drafted emails/calls customized to member's district
- Campaign metrics: "427 RLC members contacted their senator about HB 1234 this week"
- Push notifications for urgent votes (PWA with service workers)
- Chapter leaders can launch action campaigns in minutes, not days

**B. Liberty Scorecard — Automated Legislator Accountability**

The RLC's Liberty Scorecard is a flagship product — ranking legislators by how they vote on liberty issues. Currently built manually, national level only. With AI + automation, this scales to all 50 states.

**How It Works:**
1. **Bill Selection:** RLC leadership (national or state chairs) selects key bills to track. AI assists by scanning bill text and flagging those that affect liberty issues (gun rights, property rights, free speech, economic freedom, civil liberties).
2. **Position Assignment:** For each bill, RLC assigns a "liberty position" (Yea or Nay). AI suggests positions based on bill analysis + RLC's published principles, human confirms.
3. **Vote Tracking:** Automated via LegiScan API (covers all 50 states + Congress). When a tracked bill gets a roll call vote, the system pulls every legislator's vote automatically.
4. **Scoring:** Each legislator gets a cumulative Liberty Score (0-100%) based on how often they voted with the RLC position.
5. **Publishing:** Scorecards auto-generated as shareable web pages, embeddable widgets, downloadable PDFs, and social media graphics.
6. **Alerts:** Members notified when their legislators score above/below thresholds. "Your state senator has a 34% Liberty Score — here's how to contact them."

**Data Model:**

`rlc_scorecard_sessions` — A scoring session (e.g., "118th Congress", "2026 Florida Session")
| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `name` | VARCHAR | "118th Congress Liberty Scorecard" |
| `jurisdiction` | ENUM | `federal`, `state` |
| `state_code` | CHAR(2) (nullable) | NULL for federal |
| `chapter_id` | UUID (nullable) | FK → rlc_chapters (who manages this scorecard) |
| `session_year` | INT | 2026 |
| `status` | ENUM | `draft`, `active`, `published`, `archived` |
| `created_at` | TIMESTAMP | |

`rlc_scorecard_bills` — Bills tracked in a session
| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `session_id` | UUID | FK → rlc_scorecard_sessions |
| `legiscan_bill_id` | INT (nullable) | LegiScan API ID |
| `bill_number` | VARCHAR | "HR 1234", "SB 567" |
| `title` | VARCHAR | Short title |
| `description` | TEXT | AI-generated plain-language summary |
| `liberty_position` | ENUM | `yea`, `nay` — what the RLC says the liberty vote is |
| `ai_suggested_position` | ENUM (nullable) | AI's analysis before human confirmation |
| `ai_analysis` | TEXT (nullable) | AI reasoning for suggested position |
| `category` | VARCHAR | "gun_rights", "economic_freedom", "civil_liberties", etc. |
| `weight` | DECIMAL | Default 1.0. Higher for landmark bills. |
| `vote_date` | DATE (nullable) | When the roll call happened |
| `status` | ENUM | `tracking`, `voted`, `no_vote` |

`rlc_scorecard_votes` — Individual legislator votes
| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `bill_id` | UUID | FK → rlc_scorecard_bills |
| `legislator_id` | UUID | FK → rlc_legislators |
| `vote` | ENUM | `yea`, `nay`, `not_voting`, `absent` |
| `aligned_with_liberty` | BOOLEAN | Computed: did they vote with the RLC position? |

`rlc_legislators` — Elected officials being tracked
| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `legiscan_people_id` | INT (nullable) | LegiScan API ID |
| `name` | VARCHAR | Full name |
| `party` | VARCHAR | "R", "D", "L", "I" |
| `chamber` | ENUM | `us_house`, `us_senate`, `state_house`, `state_senate` |
| `state_code` | CHAR(2) | |
| `district` | VARCHAR (nullable) | |
| `photo_url` | VARCHAR (nullable) | |
| `current_score` | DECIMAL (nullable) | Computed Liberty Score (0-100) |
| `metadata` | JSONB | |

**Automation Pipeline:**
```
LegiScan API (daily cron)
  → Fetch new bills matching liberty keywords
  → AI analysis (Claude) → suggest position + plain-language summary
  → Queue for human review (state chair or national board)
  → Once position confirmed, track bill status
  → When roll call vote occurs → pull all votes automatically
  → Compute updated scores for all legislators
  → Publish updated scorecard
  → Alert affected members
```

**Scale Impact:**
- Currently: 1 national scorecard, built manually over weeks
- With automation: 50 state scorecards + 1 national, maintained in near real-time
- Each state chair manages their state's bill selection (with AI assist)
- National board manages federal scorecard
- Cross-reference: "Legislators who support X also tend to support Y"

**Public Pages:**
- `/scorecards` — Browse all active scorecards by state/federal
- `/scorecards/[session-slug]` — Full scorecard with sortable legislator table
- `/scorecards/[session-slug]/[legislator-slug]` — Individual legislator detail with vote history
- `/scorecards/embed/[session-slug]` — Embeddable widget for chapter websites
- Shareable social media cards auto-generated per legislator

**C. Candidate Endorsement Engine**
- Structured candidate surveys (already exists in HighLevel, rebuild in-app)
- Automated scoring against RLC's published principles
- Chapter-level endorsement votes with transparent tallying
- Published scorecards on public-facing pages with shareable voter guides
- Historical voting record tracking for endorsed candidates (did they keep their promises?)
- Integration with VoteSmart/BallotReady APIs for enrichment

**D. Member Directory & Networking**
- Opt-in member directory: find other liberty-minded people in your district/county
- Privacy controls (show name + chapter only, or full profile)
- Direct messaging between members
- "Find Members Near Me" for organizing events or attending hearings
- Chapter leaders can see who's in their territory and reach out

### Tier 2: Chapter Empowerment

**E. Chapter Health Dashboard**
- Real-time KPIs per chapter: member count, growth rate, retention, contribution totals
- Engagement scoring: event attendance, email opens, action center participation, volunteer hours
- Heatmap: which chapters are thriving vs. need support
- National board can identify struggling chapters and intervene early
- Automated alerts: "Florida's membership dropped 15% this quarter"

**F. AI Content Assistant for Chapter Leaders**
- Generate newsletters, social posts, press releases, and talking points
- Summarize complex bills into member-friendly language
- Draft event descriptions and email invitations
- Localize national messaging for state/county context
- Powered by Claude API — already in the stack

**G. Volunteer Coordination**
- Shift signup for campaigns, events, phone banking, canvassing
- Track volunteer hours per member (recognition + reporting)
- Campaign managers can request help, members get notified
- Integration with HighLevel workflows for follow-up

### Tier 3: Growth & Intelligence

**H. Smart Member Acquisition**
- Referral program: existing members invite friends, track conversion
- "Liberty Score" for prospects based on public voter registration + party affiliation
- Social sharing: members share action alerts and voter guides, tracked with UTM codes
- Landing pages per chapter that feed into HighLevel nurture sequences
- A/B tested join flows optimized by tier

**I. Integrated Communications Hub**
- Unified view for chapter leaders: email, SMS, social mentions, member questions
- Don't force chapter leaders into HighLevel UI — surface comms in the admin dashboard
- Template library for common scenarios (welcome, renewal, lapsed, event invite)
- Scheduled sends with timezone awareness

**J. Gamification & Recognition**
- Member engagement scoring (events attended, actions taken, volunteer hours, referrals)
- Badges and milestones: "Liberty Champion", "100 Actions", "Founding Member"
- Public recognition on chapter pages
- Annual awards: top recruiter, most engaged member, chapter of the year
- Leaderboards by chapter (friendly competition drives growth)

**K. Data-Driven Fundraising**
- AI-optimized donation asks based on member history and giving capacity
- Peer-to-peer fundraising pages for specific campaigns
- Matching gift campaigns with progress bars
- Contribution impact stories: "Your $50 funded 200 voter guides in Ohio"

### Tier 4: Long-term Platform Plays

**L. Mobile App (PWA → Native)**
- Push notifications for legislative alerts and action items
- Offline-capable member directory
- QR code check-in at events
- Quick-action buttons: donate, contact rep, share voter guide

**M. Election War Room**
- Real-time election night results dashboard
- Precinct-level data for endorsed candidates
- Post-election analysis: which RLC-endorsed candidates won/lost and by how much
- Strategic planning: where to focus resources next cycle

**N. API & Developer Platform**
- Open API for chapter-built tools and integrations
- Webhook marketplace for connecting to state-specific tools
- Data export for research and academic partnerships

---

### Implementation Strategy for Vision Features

These aren't "someday" features. They're the reason this platform exists. The phased approach:

- **Phase 5 (Q2 2026):** Liberty Scorecard automation + Action Center — the flagship features that define the platform
- **Phase 6 (Q3 2026):** Candidate Endorsement Engine + Voter Guides — election season 2026
- **Phase 7 (Q4 2026):** AI Content Assistant + Chapter Health Dashboard + Volunteer Coordination
- **Phase 8 (2027):** Smart Acquisition + Gamification + Mobile App + Developer Platform

Each feature becomes **reusable IP** — other advocacy organizations, state parties, and caucuses face identical challenges. The RLC becomes the proof case; the platform becomes the product.

---

## 14. Open Questions (Phase 0-1)

*Resolved:*
- ~~Chapter seeding~~ → Hybrid: CiviCRM groups + HighLevel tags as baseline, Matt cleans up
- ~~Migration approach~~ → Full schema first, then import

*Still Open (can answer later, not blocking Phase 0):*
1. **Pricing**: What are the actual dollar amounts for each of the 7 membership tiers? (Needed for Phase 1 Stripe setup)
2. **Grace period**: How long is the grace period per tier? (Needed for Phase 1 status automation)
3. **Auto-renewal**: Which tiers support auto-renewal vs. one-time annual payment? (Phase 1)
4. **Existing Stripe products**: Are there already Stripe products/prices for RLC, or create new? (Phase 1)
5. **Candidate surveys**: Keep HighLevel-based surveys, or rebuild in website? (Phase 4)
6. **Email service**: Resend for transactional email, or HighLevel for all email? (Phase 1)
7. **Custom domain**: Timeline for pointing rlc.org to Vercel? (Phase 4)
