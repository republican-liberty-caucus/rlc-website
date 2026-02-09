# Plan: Rename "Chapters" to "Charters" + Build State Charter Profile Page

**Created:** 2026-02-08
**Status:** Planned

## Context

The RLC website currently refers to state organizations as "chapters" everywhere — database tables, URLs, UI text, types, and components. The correct terminology for these state-level organizational units is "charters." Additionally, the current chapter detail page (`/chapters/[slug]`) is very sparse — it only shows a name, basic stats, a leadership JSON dump, and events. It needs to be a full profile page showing officers, bylaws, contact info, social media, description, sub-charters, and founding date.

This is split into **two PRs** to keep reviews manageable:
- **PR 1**: Full rename chapters to charters (mechanical, ~80 files)
- **PR 2**: Add new profile columns + build the enhanced profile page (~8 files)

---

## PR 1: Full Rename chapters to charters

### Step 1: Create GitHub issue to track this work

### Step 2: Database migration (Supabase SQL via Prisma)

Create migration with `ALTER TABLE RENAME` and `ALTER TABLE RENAME COLUMN` statements. These are metadata-only operations — zero data loss risk.

**Tables to rename:**
- `rlc_chapters` to `rlc_charters`
- `rlc_chapter_stripe_accounts` to `rlc_charter_stripe_accounts`
- `rlc_chapter_split_configs` to `rlc_charter_split_configs`
- `rlc_chapter_split_rules` to `rlc_charter_split_rules`
- `rlc_chapter_onboarding` to `rlc_charter_onboarding`
- `rlc_chapter_onboarding_steps` to `rlc_charter_onboarding_steps`

**Columns to rename across all tables:**
- `chapter_level` to `charter_level` (on rlc_charters)
- `parent_chapter_id` to `parent_charter_id` (on rlc_charters)
- `primary_chapter_id` to `primary_charter_id` (on rlc_members)
- `chapter_id` to `charter_id` (on rlc_member_roles, rlc_contributions, rlc_events, rlc_posts, rlc_surveys, rlc_scorecard_sessions, rlc_action_campaigns, rlc_charter_stripe_accounts, rlc_charter_split_configs, rlc_officer_positions, rlc_charter_onboarding)
- `recipient_chapter_id` to `recipient_charter_id` (on rlc_charter_split_rules, rlc_split_ledger_entries)

**Note:** UserRole enum values (`chapter_officer`, `chapter_admin`) will be kept as-is for PR 1 since they're stored in Clerk user metadata. A separate issue will track renaming these if desired.

### Step 3: Update Prisma schema (`prisma/schema.prisma`)

- Rename enums: `ChapterLevel` to `CharterLevel`, `ChapterStatus` to `CharterStatus`
- Rename models: `Chapter` to `Charter`, `ChapterStripeAccount` to `CharterStripeAccount`, `ChapterSplitConfig` to `CharterSplitConfig`, `ChapterSplitRule` to `CharterSplitRule`
- Update all `@@map()` and `@map()` directives
- Update all relation field names and references

### Step 4: Update TypeScript types (`types/index.ts`)

- `ChapterLevel` to `CharterLevel`
- `ChapterStatus` to `CharterStatus`
- `interface Chapter` to `interface Charter` (rename internal fields)
- `interface ChapterStripeAccount` to `interface CharterStripeAccount`
- `interface ChapterSplitConfig` to `interface CharterSplitConfig`
- `interface ChapterSplitRule` to `interface CharterSplitRule`
- `interface ChapterOnboarding` to `interface CharterOnboarding`
- `interface ChapterOnboardingStep` to `interface CharterOnboardingStep`
- Update `Member.primary_chapter_id` to `primary_charter_id`
- Update `OfficerPosition.chapter_id` to `charter_id`
- Update `SplitLedgerEntry.recipient_chapter_id` to `recipient_charter_id`

### Step 5: Update Supabase Database types (`lib/supabase/client.ts`)

- Rename `rlc_chapters` to `rlc_charters` table definition
- Rename all `chapter_*` columns to `charter_*` across all table types
- Update type imports from `ChapterLevel`/`ChapterStatus` to `CharterLevel`/`CharterStatus`

### Step 6: Update library files

| File | Changes |
|------|---------|
| `lib/admin/permissions.ts` | `Chapter` to `Charter`, `visibleChapterIds` to `visibleCharterIds`, table/column names |
| `lib/validations/admin.ts` | `chapterUpdateSchema` to `charterUpdateSchema`, field names |
| `lib/validations/member.ts` | `primaryChapterId` to `primaryCharterId` |
| `lib/validations/event.ts` | `chapterId` to `charterId` |
| `lib/validations/post.ts` | `chapterId` to `charterId` |
| `lib/validations/survey.ts` | `chapterId` to `charterId` |
| `lib/validations/scorecard.ts` | `chapterId` to `charterId` |
| `lib/validations/campaign.ts` | `chapterId` to `charterId` |
| `lib/validations/split-config.ts` | `chapterId` to `charterId`, `recipientChapterId` to `recipientCharterId` |
| `lib/validations/onboarding.ts` | chapter to charter references |
| `lib/dues-sharing/split-engine.ts` | table/column/type names |
| `lib/dues-sharing/transfer-engine.ts` | table/column/type names |
| `lib/dues-sharing/constants.ts` | chapter to charter references |
| `lib/dues-sharing/__tests__/split-engine.test.ts` | type/variable names |
| `lib/onboarding/engine.ts` | type/table names |
| `lib/onboarding/constants.ts` | UI text strings |
| `lib/stripe/client.ts` | table/column names |

### Step 7: Rename API route directories + update content

- `app/api/v1/chapters/` to `app/api/v1/charters/`
- `app/api/v1/admin/chapters/` to `app/api/v1/admin/charters/`
- Update all `.from('rlc_chapters')` to `.from('rlc_charters')` and column references in every API route file that references chapter data (~30 files)

### Step 8: Rename admin page directories + update content

- `app/(admin)/admin/chapters/` to `app/(admin)/admin/charters/`
- Update all internal references in admin pages (~15 files)

### Step 9: Rename public page directories + update content

- `app/(public)/chapters/` to `app/(public)/charters/`
- Update all internal references + UI text ("Chapter" to "Charter")
- Update chapter references in other public pages (events, blog, donate, join, etc.)

### Step 10: Rename + update components

- `components/admin/chapter-detail-form.tsx` to `charter-detail-form.tsx` (export `CharterDetailForm`)
- `components/admin/chapter-officers-card.tsx` to `charter-officers-card.tsx` (export `CharterOfficersCard`)
- Update all other components that reference chapters (~15 files)

### Step 11: Update navigation

- `components/navigation/main-nav.tsx`: `/chapters` to `/charters`, label "Charters"
- `components/navigation/admin-nav.tsx`: `/admin/chapters` to `/admin/charters`
- `components/layout/footer.tsx`: `/chapters` to `/charters`, "Find Your Chapter" to "Find Your Charter"

### Step 12: Update middleware (`middleware.ts`)

- `/chapters(.*)` to `/charters(.*)`
- `/api/v1/chapters(.*)` to `/api/v1/charters(.*)`

### Step 13: Add URL redirects (`next.config.js`)

```js
{ source: '/chapters', destination: '/charters', permanent: true },
{ source: '/chapters/:slug', destination: '/charters/:slug', permanent: true },
```

### Step 14: Update home page (`app/page.tsx`)

- `.from('rlc_chapters')` to `.from('rlc_charters')` and any column/text references

---

## PR 2: Enhanced State Charter Profile Page

### Step 1: Database migration — add new columns to `rlc_charters`

```sql
ALTER TABLE rlc_charters ADD COLUMN description TEXT;
ALTER TABLE rlc_charters ADD COLUMN bylaws_url TEXT;
ALTER TABLE rlc_charters ADD COLUMN phone TEXT;
ALTER TABLE rlc_charters ADD COLUMN social_media_links JSONB DEFAULT '{}';
ALTER TABLE rlc_charters ADD COLUMN founded_date DATE;
```

### Step 2: Update types

Add to `Charter` interface in `types/index.ts`:
```typescript
description: string | null;
bylaws_url: string | null;
phone: string | null;
social_media_links: Record<string, string>;
founded_date: string | null;
```

Add same fields to `lib/supabase/client.ts` Database type and `prisma/schema.prisma`.

### Step 3: Update admin form + API

- Add new fields to `charterUpdateSchema` in `lib/validations/admin.ts`
- Add new form fields to `components/admin/charter-detail-form.tsx` (description textarea, bylaws URL, phone, social media inputs, founded date picker)
- Update PATCH handler in `app/api/v1/admin/charters/[id]/route.ts` to accept new fields

### Step 4: Build enhanced public charter profile page

**File:** `app/(public)/charters/[slug]/page.tsx`

**Data fetching (parallel via Promise.all):**
1. Charter data (select `*`)
2. Member count (count query on `rlc_members` where `primary_charter_id = charter.id`)
3. Upcoming events (from `rlc_events` where `charter_id = charter.id`, published, future dates, limit 5)
4. Active officers (from `rlc_officer_positions` joined with `rlc_members` for first_name/last_name — **NO email**)
5. Sub-charters (from `rlc_charters` where `parent_charter_id = charter.id`, active)

**Page layout:**

```
<MainNav />

Hero (bg-rlc-blue):
  - State code badge (rounded-full bg-white/10)
  - Charter name (h1, text-4xl font-bold)
  - "Republican Liberty Caucus of {state}"

Stats Bar (border-b bg-muted/50):
  - Members count (Users icon)
  - Upcoming Events count (Calendar icon)
  - Charter Level (MapPin icon)
  - Founded date (if exists)

Main Content (container, grid lg:grid-cols-3):

  Left Column (lg:col-span-2, space-y-8):

    About Section (if description exists):
      - h2 "About" (text-2xl font-bold text-rlc-blue)
      - Description text

    Officers Directory (if officers exist):
      - h2 "Officers" (text-2xl font-bold text-rlc-blue)
      - Grid sm:grid-cols-2 of cards showing title + name (NO email)

    Upcoming Events:
      - h2 "Upcoming Events"
      - Event list cards with links (existing pattern)
      - Empty state with "Browse all events" link

    Sub-Charters (if any exist):
      - h2 "Local Charters"
      - Grid of link cards to sub-charter profiles

  Right Column (sidebar, space-y-6):

    Join CTA Card:
      - "Get Involved" heading
      - Description text
      - "Join the RLC" button (bg-rlc-red)

    Contact Card (if email/phone/website):
      - Email link (Mail icon)
      - Phone link (Phone icon)
      - Website link (ExternalLink icon)

    Social Media Card (if social_media_links has entries):
      - "Follow Us" heading
      - Labeled links for each platform

    Bylaws Card (if bylaws_url exists):
      - "Governing Documents" heading
      - "View Bylaws" link (FileText icon)

    Back Link:
      - "All State Charters" link to /charters

<Footer />
```

### Step 5: Update charters listing page text

Update `app/(public)/charters/page.tsx` — ensure all copy uses "charters" language.

### Step 6: E2E test

**File:** `e2e/charter-profile.spec.ts`
- Verify charter profile page loads with key sections
- Verify NO officer emails are displayed publicly
- Verify old `/chapters/*` URLs redirect to `/charters/*`

---

## Key Files

| File | PR | Action |
|------|-----|--------|
| `prisma/schema.prisma` | 1 | Rename models, enums, @map directives |
| `types/index.ts` | 1+2 | Rename interfaces/types; add new Charter fields |
| `lib/supabase/client.ts` | 1+2 | Rename table/column types; add new fields |
| `lib/admin/permissions.ts` | 1 | Rename chapter to charter throughout |
| `middleware.ts` | 1 | Update public route patterns |
| `next.config.js` | 1 | Add redirects |
| `components/navigation/main-nav.tsx` | 1 | Update href/label |
| `components/layout/footer.tsx` | 1 | Update href/label |
| `app/(public)/charters/[slug]/page.tsx` | 2 | Complete rewrite for rich profile |
| `components/admin/charter-detail-form.tsx` | 2 | Add new profile fields |

---

## Verification

1. `npx tsc --noEmit` — catch any missed type references after rename
2. `next build` — verify build succeeds
3. `npx playwright test` — run full E2E suite
4. Manual spot-check: visit `/charters` and a charter detail page
5. Verify redirect: visit `/chapters/rlc-national` redirects to `/charters/rlc-national`
6. Verify officer section shows names only, no emails
