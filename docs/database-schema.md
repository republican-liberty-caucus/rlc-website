# RLC Website Database Schema

**Source of truth:** `prisma/schema.prisma`
**Database:** PostgreSQL (Supabase)
**Schema management:** Prisma (`npx prisma db push`)
**Query layer:** Supabase client (not Prisma Client)
**All PKs:** UUID v4 (`@default(uuid())`)
**Naming:** Tables use `rlc_` prefix, columns use `snake_case`

---

## Table of Contents

1. [Enums](#enums)
2. [Core Tables (Phases 1-3)](#core-tables)
3. [Candidate Surveys (Phase 4)](#phase-4-candidate-surveys)
4. [Liberty Scorecard & Action Center (Phase 5)](#phase-5-liberty-scorecard--action-center)
5. [Entity Relationship Overview](#entity-relationship-overview)
6. [External System IDs](#external-system-ids)
7. [Indexes & Constraints](#indexes--constraints)

---

## Enums

### Membership & Identity

| Enum | Values | Used By |
|------|--------|---------|
| `MembershipTier` | `student_military`, `individual`, `premium`, `sustaining`, `patron`, `benefactor`, `roundtable` | `rlc_members.membership_tier` |
| `MembershipStatus` | `new_member`, `current`, `grace`, `expired`, `pending`, `cancelled`, `deceased`, `expiring` | `rlc_members.membership_status` |
| `HouseholdRole` | `primary`, `spouse`, `child` | `rlc_members.household_role` |
| `UserRole` | `member`, `chapter_officer`, `chapter_admin`, `state_chair`, `regional_coordinator`, `national_board`, `super_admin` | `rlc_member_roles.role` |

### Organization

| Enum | Values | Used By |
|------|--------|---------|
| `ChapterLevel` | `national`, `multi_state_region`, `state`, `intra_state_region`, `county` | `rlc_chapters.chapter_level` |
| `ChapterStatus` | `active`, `inactive`, `forming` | `rlc_chapters.status` |

### Financial

| Enum | Values | Used By |
|------|--------|---------|
| `ContributionType` | `membership`, `donation`, `event_registration`, `merchandise` | `rlc_contributions.contribution_type` |
| `PaymentStatus` | `pending`, `completed`, `failed`, `refunded`, `cancelled` | `rlc_contributions.payment_status` |

### Surveys (Phase 4)

| Enum | Values | Used By |
|------|--------|---------|
| `SurveyStatus` | `draft`, `active`, `closed` | `rlc_surveys.status` |
| `CandidateResponseStatus` | `pending`, `in_progress`, `submitted`, `endorsed`, `not_endorsed` | `rlc_candidate_responses.status` |
| `QuestionType` | `scale`, `yes_no`, `text`, `multiple_choice` | `rlc_survey_questions.question_type` |

### Scorecard & Campaigns (Phase 5)

| Enum | Values | Used By |
|------|--------|---------|
| `Jurisdiction` | `federal`, `state` | `rlc_scorecard_sessions.jurisdiction` |
| `ScorecardSessionStatus` | `draft`, `active`, `published`, `archived` | `rlc_scorecard_sessions.status` |
| `LibertyPosition` | `yea`, `nay` | `rlc_scorecard_bills.liberty_position`, `.ai_suggested_position` |
| `BillTrackingStatus` | `tracking`, `voted`, `no_vote` | `rlc_scorecard_bills.bill_status` |
| `VoteChoice` | `yea`, `nay`, `not_voting`, `absent` | `rlc_scorecard_votes.vote` |
| `LegislativeChamber` | `us_house`, `us_senate`, `state_house`, `state_senate` | `rlc_legislators.chamber`, `rlc_action_campaigns.target_chamber` |
| `CampaignStatus` | `draft`, `active`, `completed`, `cancelled` | `rlc_action_campaigns.status` |

---

## Core Tables

### `rlc_chapters` — Organizational Hierarchy

Self-referential tree structure for national, state, and local chapters.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | | `uuid()` | PK |
| `name` | text | | | |
| `slug` | text | | | **unique** |
| `chapter_level` | ChapterLevel | | | |
| `parent_chapter_id` | uuid | yes | | FK `rlc_chapters.id` (self-referential) |
| `state_code` | char(2) | yes | | US state abbreviation |
| `region_name` | text | yes | | |
| `status` | ChapterStatus | | `active` | |
| `website_url` | text | yes | | |
| `contact_email` | text | yes | | |
| `leadership` | jsonb | | `{}` | Freeform leadership data |
| `metadata` | jsonb | | `{}` | |
| `created_at` | timestamptz | | `now()` | |
| `updated_at` | timestamptz | | auto | |

**Relations:** members, member_roles, contributions, events, posts, surveys, scorecard_sessions, action_campaigns

---

### `rlc_members` — Members (synced with Clerk)

Central member record linked to Clerk auth, Stripe billing, HighLevel CRM, and CiviCRM legacy.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | | `uuid()` | PK |
| `clerk_user_id` | text | yes | | **unique** — Clerk auth link |
| `email` | text | | | **unique** |
| `first_name` | text | | | |
| `last_name` | text | | | |
| `phone` | text | yes | | |
| `address_line1` | text | yes | | |
| `address_line2` | text | yes | | |
| `city` | text | yes | | |
| `state` | text | yes | | |
| `postal_code` | text | yes | | |
| `country` | text | | `US` | |
| `membership_tier` | MembershipTier | | `individual` | |
| `membership_status` | MembershipStatus | | `pending` | Cron transitions daily |
| `membership_start_date` | timestamptz | yes | | |
| `membership_expiry_date` | timestamptz | yes | | |
| `membership_join_date` | timestamptz | yes | | |
| `primary_chapter_id` | uuid | yes | | FK `rlc_chapters.id` |
| `highlevel_contact_id` | text | yes | | **unique** — GoHighLevel CRM |
| `civicrm_contact_id` | int | yes | | **unique** — Legacy CiviCRM |
| `stripe_customer_id` | text | yes | | **unique** — Stripe billing |
| `email_opt_in` | boolean | | `true` | |
| `sms_opt_in` | boolean | | `false` | |
| `do_not_phone` | boolean | | `false` | |
| `household_id` | text | yes | | Groups family members |
| `household_role` | HouseholdRole | yes | | |
| `primary_member_id` | uuid | yes | | FK `rlc_members.id` (self-ref) |
| `metadata` | jsonb | | `{}` | |
| `created_at` | timestamptz | | `now()` | |
| `updated_at` | timestamptz | | auto | |

**Membership status transitions** (daily cron at 6am UTC):
```
new_member → current    (90 days after join date)
current → expiring      (30 days before expiry)
expiring → grace        (after expiry date)
grace → expired         (30 days after expiry)
```

---

### `rlc_member_roles` — Multi-Role Support

Allows members to hold multiple roles scoped to specific chapters.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | | `uuid()` | PK |
| `member_id` | uuid | | | FK `rlc_members.id` (cascade delete) |
| `role` | UserRole | | | |
| `chapter_id` | uuid | yes | | FK `rlc_chapters.id` — scope |
| `granted_by` | uuid | yes | | FK `rlc_members.id` |
| `granted_at` | timestamptz | | `now()` | |
| `expires_at` | timestamptz | yes | | |

**Unique:** `(member_id, role, chapter_id)`

---

### `rlc_contributions` — Payments & Donations

All financial transactions — memberships, donations, event fees, merchandise.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | | `uuid()` | PK |
| `member_id` | uuid | yes | | FK `rlc_members.id` |
| `contribution_type` | ContributionType | | | |
| `amount` | decimal(10,2) | | | |
| `currency` | text | | `USD` | |
| `stripe_payment_intent_id` | text | yes | | Stripe PI |
| `stripe_subscription_id` | text | yes | | Stripe subscription |
| `payment_status` | PaymentStatus | | `pending` | |
| `payment_method` | text | yes | | |
| `chapter_id` | uuid | yes | | FK `rlc_chapters.id` |
| `campaign_id` | text | yes | | Attribution |
| `is_recurring` | boolean | | `false` | |
| `recurring_interval` | text | yes | | e.g. `month`, `year` |
| `civicrm_contribution_id` | int | yes | | **unique** — Legacy |
| `transaction_id` | text | yes | | |
| `source` | text | yes | | |
| `metadata` | jsonb | | `{}` | |
| `created_at` | timestamptz | | `now()` | |

---

### `rlc_events` — Events

In-person and virtual events with registration management.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | | `uuid()` | PK |
| `title` | text | | | |
| `slug` | text | | | **unique** |
| `description` | text | yes | | |
| `event_type` | text | yes | | |
| `start_date` | timestamptz | | | |
| `end_date` | timestamptz | yes | | |
| `timezone` | text | | `America/New_York` | |
| `is_virtual` | boolean | | `false` | |
| `location_name` | text | yes | | |
| `address` | text | yes | | |
| `city` | text | yes | | |
| `state` | text | yes | | |
| `postal_code` | text | yes | | |
| `virtual_url` | text | yes | | |
| `registration_required` | boolean | | `true` | |
| `max_attendees` | int | yes | | |
| `registration_fee` | decimal(10,2) | yes | | |
| `registration_deadline` | timestamptz | yes | | |
| `chapter_id` | uuid | yes | | FK `rlc_chapters.id` |
| `organizer_id` | uuid | yes | | FK `rlc_members.id` |
| `status` | text | | `draft` | |
| `metadata` | jsonb | | `{}` | |
| `created_at` | timestamptz | | `now()` | |
| `updated_at` | timestamptz | | auto | |

---

### `rlc_event_registrations` — Event Registrations

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | | `uuid()` | PK |
| `event_id` | uuid | | | FK `rlc_events.id` (cascade delete) |
| `member_id` | uuid | yes | | FK `rlc_members.id` |
| `guest_email` | text | yes | | For non-member registrations |
| `guest_name` | text | yes | | |
| `registration_status` | text | | `registered` | |
| `checked_in_at` | timestamptz | yes | | |
| `contribution_id` | uuid | yes | | FK `rlc_contributions.id` |
| `metadata` | jsonb | | `{}` | |
| `created_at` | timestamptz | | `now()` | |

---

### `rlc_posts` — Blog / Content

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | | `uuid()` | PK |
| `title` | text | | | |
| `slug` | text | | | **unique** |
| `content` | text | yes | | Full HTML/markdown |
| `excerpt` | text | yes | | |
| `featured_image_url` | text | yes | | |
| `author_id` | uuid | yes | | FK `rlc_members.id` |
| `chapter_id` | uuid | yes | | FK `rlc_chapters.id` |
| `status` | text | | `draft` | `draft` / `published` |
| `published_at` | timestamptz | yes | | |
| `categories` | text[] | | | PostgreSQL array |
| `tags` | text[] | | | PostgreSQL array |
| `seo_title` | text | yes | | |
| `seo_description` | text | yes | | |
| `metadata` | jsonb | | `{}` | |
| `created_at` | timestamptz | | `now()` | |
| `updated_at` | timestamptz | | auto | |

---

### `rlc_highlevel_sync_log` — GoHighLevel Sync Tracking

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | | `uuid()` | PK |
| `entity_type` | text | | | e.g. `member`, `event` |
| `entity_id` | text | | | |
| `highlevel_id` | text | yes | | |
| `action` | text | | | e.g. `create`, `update` |
| `status` | text | | `pending` | |
| `error_message` | text | yes | | |
| `request_payload` | jsonb | yes | | |
| `response_payload` | jsonb | yes | | |
| `created_at` | timestamptz | | `now()` | |

---

### `rlc_civicrm_migration_log` — Legacy Migration Tracking

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | | `uuid()` | PK |
| `entity_type` | text | | | e.g. `contact`, `contribution` |
| `civicrm_id` | int | | | Legacy CiviCRM ID |
| `supabase_id` | text | yes | | New UUID |
| `status` | text | | `pending` | |
| `error_message` | text | yes | | |
| `migrated_at` | timestamptz | yes | | |

**Unique:** `(entity_type, civicrm_id)`

---

## Phase 4: Candidate Surveys

### `rlc_surveys` — Endorsement Surveys

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | | `uuid()` | PK |
| `title` | text | | | |
| `slug` | text | | | **unique** |
| `description` | text | yes | | |
| `status` | SurveyStatus | | `draft` | |
| `election_type` | text | yes | | |
| `election_date` | text | yes | | |
| `state` | text | yes | | |
| `chapter_id` | uuid | yes | | FK `rlc_chapters.id` |
| `created_by` | uuid | yes | | FK `rlc_members.id` |
| `created_at` | timestamptz | | `now()` | |
| `updated_at` | timestamptz | | auto | |

---

### `rlc_survey_questions` — Survey Questions

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | | `uuid()` | PK |
| `survey_id` | uuid | | | FK `rlc_surveys.id` (cascade delete) |
| `question_text` | text | | | |
| `question_type` | QuestionType | | | |
| `options` | text[] | | | For multiple_choice |
| `weight` | decimal(3,1) | | `1` | Scoring weight |
| `sort_order` | int | | `0` | |
| `ideal_answer` | text | yes | | For auto-scoring |
| `created_at` | timestamptz | | `now()` | |

---

### `rlc_candidate_responses` — Candidate Survey Submissions

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | | `uuid()` | PK |
| `survey_id` | uuid | | | FK `rlc_surveys.id` (cascade delete) |
| `candidate_name` | text | | | |
| `candidate_email` | text | yes | | |
| `candidate_party` | text | yes | | |
| `candidate_office` | text | yes | | |
| `candidate_district` | text | yes | | |
| `access_token` | text | | | Unique survey link token |
| `status` | CandidateResponseStatus | | `pending` | |
| `total_score` | decimal(5,2) | yes | | Computed after submission |
| `submitted_at` | timestamptz | yes | | |
| `created_at` | timestamptz | | `now()` | |
| `updated_at` | timestamptz | | auto | |

---

### `rlc_survey_answers` — Individual Question Answers

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | | `uuid()` | PK |
| `candidate_response_id` | uuid | | | FK `rlc_candidate_responses.id` (cascade delete) |
| `question_id` | uuid | | | FK `rlc_survey_questions.id` (cascade delete) |
| `answer` | text | | | |
| `score` | decimal(5,2) | yes | | Auto-scored or manual |

---

## Phase 5: Liberty Scorecard & Action Center

### `rlc_legislators` — Tracked Legislators

Legislators from LegiScan with computed liberty scores.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | | `uuid()` | PK |
| `legiscan_people_id` | int | yes | | **unique** — LegiScan external ID |
| `name` | text | | | |
| `party` | text | | | |
| `chamber` | LegislativeChamber | | | |
| `state_code` | text | | | e.g. `US`, `TX`, `CA` |
| `district` | text | yes | | |
| `photo_url` | text | yes | | |
| `current_score` | decimal(5,2) | yes | | 0.00-100.00, recomputed by cron |
| `metadata` | jsonb | | `{}` | |
| `created_at` | timestamptz | | `now()` | |
| `updated_at` | timestamptz | | auto | |

---

### `rlc_scorecard_sessions` — Scorecard Sessions

A legislative session being scored (e.g. "118th Congress", "2025 Texas Session").

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | | `uuid()` | PK |
| `name` | text | | | |
| `slug` | text | | | **unique** — URL-safe |
| `jurisdiction` | Jurisdiction | | `federal` | |
| `state_code` | text | yes | | For state sessions |
| `chapter_id` | uuid | yes | | FK `rlc_chapters.id` — scope |
| `session_year` | int | | | e.g. 2025, 2026 |
| `status` | ScorecardSessionStatus | | `draft` | Lifecycle: draft > active > published > archived |
| `created_by` | uuid | yes | | FK `rlc_members.id` |
| `created_at` | timestamptz | | `now()` | |
| `updated_at` | timestamptz | | auto | |

**Status lifecycle:**
```
draft → active → published → archived
         ↓ (cron imports votes while active)
```

---

### `rlc_scorecard_bills` — Bills Tracked in Sessions

Bills being tracked for liberty scoring within a session.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | | `uuid()` | PK |
| `session_id` | uuid | | | FK `rlc_scorecard_sessions.id` (cascade delete) |
| `legiscan_bill_id` | int | yes | | LegiScan external ID |
| `bill_number` | text | | | e.g. `HR 1234`, `SB 567` |
| `title` | text | | | |
| `description` | text | yes | | |
| `liberty_position` | LibertyPosition | | | RLC's official position (yea/nay) |
| `ai_suggested_position` | LibertyPosition | yes | | Claude AI suggestion |
| `ai_analysis` | text | yes | | Claude AI analysis text |
| `category` | text | | `other` | e.g. `fiscal`, `gun_rights`, `civil_liberties` |
| `weight` | decimal(3,1) | | `1.0` | Score weighting factor |
| `vote_date` | date | yes | | When the vote occurred |
| `bill_status` | BillTrackingStatus | | `tracking` | tracking > voted / no_vote |
| `legiscan_roll_call_id` | int | yes | | LegiScan roll call ID for vote import |
| `created_at` | timestamptz | | `now()` | |
| `updated_at` | timestamptz | | auto | |

---

### `rlc_scorecard_votes` — Legislator Votes on Bills

Individual vote records, imported from LegiScan.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | | `uuid()` | PK |
| `bill_id` | uuid | | | FK `rlc_scorecard_bills.id` (cascade delete) |
| `legislator_id` | uuid | | | FK `rlc_legislators.id` (cascade delete) |
| `vote` | VoteChoice | | | yea/nay/not_voting/absent |
| `aligned_with_liberty` | boolean | | | Computed: vote matches bill's liberty_position |
| `created_at` | timestamptz | | `now()` | |

**Unique:** `(bill_id, legislator_id)` — one vote per legislator per bill
**Index:** `bill_id` — standalone index for vote queries by bill

**Score computation formula:**
```
Score = SUM(bill.weight * aligned_with_liberty) / SUM(bill.weight) * 100
```

---

### `rlc_action_campaigns` — Advocacy Campaigns

Action Center campaigns linking members to advocacy actions on bills.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | | `uuid()` | PK |
| `title` | text | | | |
| `slug` | text | | | **unique** |
| `description` | text | yes | | |
| `bill_id` | uuid | yes | | FK `rlc_scorecard_bills.id` |
| `chapter_id` | uuid | yes | | FK `rlc_chapters.id` — scope |
| `target_chamber` | LegislativeChamber | yes | | Which chamber to target |
| `target_state_code` | text | yes | | |
| `message_template` | text | yes | | Template with `{representative}`, `{office}` vars |
| `status` | CampaignStatus | | `draft` | |
| `created_by` | uuid | yes | | FK `rlc_members.id` |
| `starts_at` | timestamptz | yes | | |
| `ends_at` | timestamptz | yes | | |
| `created_at` | timestamptz | | `now()` | |
| `updated_at` | timestamptz | | auto | |

---

### `rlc_campaign_participations` — Member Campaign Actions

Tracks individual member actions within campaigns.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | | `uuid()` | PK |
| `campaign_id` | uuid | | | FK `rlc_action_campaigns.id` (cascade delete) |
| `member_id` | uuid | | | FK `rlc_members.id` |
| `action` | text | | | e.g. `email`, `phone`, `letter` |
| `legislator_id` | uuid | yes | | FK `rlc_legislators.id` — who they contacted |
| `metadata` | jsonb | | `{}` | |
| `created_at` | timestamptz | | `now()` | |

**Unique:** `(campaign_id, member_id, action, legislator_id)` — prevents duplicate logging

---

## Entity Relationship Overview

```
rlc_chapters (self-referential hierarchy)
  ├── rlc_members
  │     ├── rlc_member_roles
  │     ├── rlc_contributions
  │     │     └── rlc_event_registrations
  │     ├── rlc_event_registrations
  │     ├── rlc_posts
  │     ├── rlc_surveys (creator)
  │     ├── rlc_scorecard_sessions (creator)
  │     ├── rlc_action_campaigns (creator)
  │     └── rlc_campaign_participations
  ├── rlc_events
  │     └── rlc_event_registrations
  ├── rlc_posts
  ├── rlc_surveys
  │     ├── rlc_survey_questions
  │     │     └── rlc_survey_answers
  │     └── rlc_candidate_responses
  │           └── rlc_survey_answers
  ├── rlc_scorecard_sessions
  │     └── rlc_scorecard_bills
  │           ├── rlc_scorecard_votes
  │           └── rlc_action_campaigns
  └── rlc_action_campaigns
        └── rlc_campaign_participations

rlc_legislators (standalone, linked via LegiScan)
  ├── rlc_scorecard_votes
  └── rlc_campaign_participations
```

---

## External System IDs

| System | Column | Table | Notes |
|--------|--------|-------|-------|
| Clerk | `clerk_user_id` | `rlc_members` | Auth provider, unique |
| Stripe | `stripe_customer_id` | `rlc_members` | Billing, unique |
| Stripe | `stripe_payment_intent_id` | `rlc_contributions` | Per-payment |
| Stripe | `stripe_subscription_id` | `rlc_contributions` | Recurring |
| GoHighLevel | `highlevel_contact_id` | `rlc_members` | CRM sync, unique |
| CiviCRM | `civicrm_contact_id` | `rlc_members` | Legacy migration, unique |
| CiviCRM | `civicrm_contribution_id` | `rlc_contributions` | Legacy migration, unique |
| LegiScan | `legiscan_people_id` | `rlc_legislators` | Legislator lookup, unique |
| LegiScan | `legiscan_bill_id` | `rlc_scorecard_bills` | Bill lookup |
| LegiScan | `legiscan_roll_call_id` | `rlc_scorecard_bills` | Vote import trigger |

---

## Indexes & Constraints

### Unique Constraints

| Table | Columns | Notes |
|-------|---------|-------|
| `rlc_chapters` | `slug` | URL-safe identifier |
| `rlc_members` | `email` | One account per email |
| `rlc_members` | `clerk_user_id` | One Clerk account |
| `rlc_members` | `highlevel_contact_id` | One HL contact |
| `rlc_members` | `civicrm_contact_id` | One CiviCRM record |
| `rlc_members` | `stripe_customer_id` | One Stripe customer |
| `rlc_member_roles` | `(member_id, role, chapter_id)` | No duplicate roles |
| `rlc_contributions` | `civicrm_contribution_id` | Legacy dedup |
| `rlc_events` | `slug` | URL-safe identifier |
| `rlc_posts` | `slug` | URL-safe identifier |
| `rlc_surveys` | `slug` | URL-safe identifier |
| `rlc_civicrm_migration_log` | `(entity_type, civicrm_id)` | Migration dedup |
| `rlc_legislators` | `legiscan_people_id` | LegiScan dedup |
| `rlc_scorecard_sessions` | `slug` | URL-safe identifier |
| `rlc_scorecard_votes` | `(bill_id, legislator_id)` | One vote per legislator per bill |
| `rlc_action_campaigns` | `slug` | URL-safe identifier |
| `rlc_campaign_participations` | `(campaign_id, member_id, action, legislator_id)` | Dedup participation |

### Standalone Indexes

| Table | Column(s) | Notes |
|-------|-----------|-------|
| `rlc_scorecard_votes` | `bill_id` | Optimizes vote-by-bill queries (7 call sites) |

### Cascade Deletes

| Parent | Child | Notes |
|--------|-------|-------|
| `rlc_members` | `rlc_member_roles` | Roles deleted with member |
| `rlc_events` | `rlc_event_registrations` | Registrations deleted with event |
| `rlc_surveys` | `rlc_survey_questions` | Questions deleted with survey |
| `rlc_surveys` | `rlc_candidate_responses` | Responses deleted with survey |
| `rlc_candidate_responses` | `rlc_survey_answers` | Answers deleted with response |
| `rlc_survey_questions` | `rlc_survey_answers` | Answers deleted with question |
| `rlc_scorecard_sessions` | `rlc_scorecard_bills` | Bills deleted with session |
| `rlc_scorecard_bills` | `rlc_scorecard_votes` | Votes deleted with bill |
| `rlc_action_campaigns` | `rlc_campaign_participations` | Participations deleted with campaign |

---

## Automated Processes

| Process | Schedule | Route | Description |
|---------|----------|-------|-------------|
| Membership status transitions | Daily 6am UTC | `/api/cron/membership-status` | Moves members through status lifecycle |
| Scorecard vote import | Daily 7am UTC | `/api/cron/scorecard-votes` | Imports votes from LegiScan, recomputes scores |

Both crons are authenticated via `CRON_SECRET` Bearer token (Vercel Cron).
