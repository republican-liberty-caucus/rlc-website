# PRD: Candidate Vetting System

**Version:** 1.0
**Date:** 2026-02-09
**Author:** Matt Nye / Claude
**GitHub Issue:** #100 (Epic)
**Status:** Draft

---

## Context

The RLC currently vets candidates for endorsement using a manual process: candidates fill out a HighLevel survey, then a committee does extensive research (opponent analysis, district data, electoral history, fundraising, background checks) and compiles a PDF report (like the Robert Onder MO CD-03 example). The board reviews the report and votes on endorsement. None of this is tracked in the platform — research assignments, progress, deadlines, and votes all happen outside the system.

**Goal:** Build a complete candidate vetting pipeline into the RLC platform that tracks every stage from survey submission through board vote, assigns research tasks to committee members by section, auto-generates report content with AI assistance, renders the final report in-platform, and exports to PDF.

---

## Pipeline Stages

```
Survey Submitted → Auto-Audit → Assigned → Research → Interview → Committee Review → Board Vote
```

1. **Survey Submitted** — Candidate completes the existing platform survey (migrated from HighLevel)
2. **Auto-Audit** *(NEW — automated)* — System runs a Digital Presence Audit adapted from AIdvisor Boost Authority Alignment System. Crawls candidate + opponent online presence, captures screenshots, scores platforms, identifies risks, and pre-populates report sections. Runs in background (10-30 min).
3. **Assigned** — Committee chair reviews auto-audit results, assigns remaining research sections to committee members
4. **Research** — Members research their assigned sections, starting from auto-audit pre-populated data. AI assists with additional drafts.
5. **Interview** — Candidate interview conducted, notes captured
6. **Committee Review** — Chair reviews completed report, makes recommendation (endorse / don't endorse / no position)
7. **Board Vote** — National board reviews report + recommendation, casts votes, result recorded

---

## Candidate Digital Presence Audit (Auto-Audit Stage)

Adapted from the AIdvisor Boost Authority Alignment System™ — a production-proven system that automates discovery, analysis, and scoring of digital brand presence across 20+ platforms.

### What It Does for Each Candidate (and Their Opponents)

**Platform Discovery** (via multi-hop Tavily search):
- Campaign website, social media (Facebook, Twitter/X, Instagram, YouTube, TikTok)
- LinkedIn, professional directories
- News coverage, press mentions
- Fundraising pages, FEC filings
- Any additional web presence

**Per-Platform Analysis**:
- Screenshot capture (desktop + mobile via Playwright)
- Activity status (active/occasional/inactive/abandoned)
- Follower/engagement metrics where available
- Content quality and messaging consistency
- Contact methods available

**Scoring** (adapted from Authority Alignment dual-level system):
- **Digital Presence (0-20)**: Platform coverage, diversity, verification, activity
- **Campaign Consistency (0-20)**: Messaging alignment, visual brand discipline, naming consistency
- **Communication Quality (0-20)**: Content professionalism, update frequency, completeness
- **Voter Accessibility (0-20)**: Contact methods, response indicators, engagement signals
- **Competitive Positioning (0-20)**: Presence vs opponents, authority signals, issue ownership
- **Overall Score (0-100)** with letter grade (A+ through F)

**Risk Assessment** (5 categories):
- **Security**: HTTPS, data exposure, campaign finance red flags
- **Consistency**: Messaging contradictions, visual brand issues
- **Abandonment**: Inactive accounts, broken links, outdated info
- **Reputation**: Negative press, controversies, unanswered criticism
- **Compliance**: FEC violations, missing disclaimers

**Auto-Population of Report Sections**:
The audit pre-populates these report sections with draft data for committee review:
- Executive Summary → social links, website URL, headshot (from campaign site screenshot)
- Candidate Background → draft from web research
- Opponent Research → opponent discovery, social links, basic backgrounds, fundraising data
- District Data → basic district information from web research

### Schema for Audit Results

New table: `rlc_candidate_digital_audits` storing the full audit output:

```
id, vetting_id (FK), status (pending/running/completed/failed),
started_at, completed_at, triggered_by,
// Candidate audit results
candidate_platforms (JSON[]) — array of platform records, each with:
  { platform_name, url, confidence_score, activity_status, last_activity,
    followers, engagement_rate, screenshot_urls, scores: { presence, consistency,
    quality, accessibility }, contact_methods, metadata }
candidate_overall_score (0-100), candidate_grade (A+ through F),
candidate_score_breakdown (JSON) — { digital_presence, campaign_consistency,
  communication_quality, voter_accessibility, competitive_positioning },
candidate_risks (JSON[]) — array of risk records, each with:
  { risk_id, category, severity, description, mitigation, priority },
// Opponent audit results (one entry per opponent discovered)
opponent_audits (JSON[]) — array of opponent audit summaries:
  { name, platforms[], overall_score, grade, key_findings },
// Raw data
discovery_log (JSON) — multi-hop search trace for auditability,
screenshots_manifest (JSON) — all captured screenshot URLs/paths,
metadata (JSON)
```

New table: `rlc_candidate_audit_platforms` (normalized from JSON for queryability):

```
id, audit_id (FK), entity_type (candidate/opponent), entity_name,
platform_name, platform_url, confidence_score, discovery_method,
activity_status, last_activity_date, followers, engagement_rate,
screenshot_desktop_url, screenshot_mobile_url,
score_presence (0-3), score_consistency (0-3), score_quality (0-3),
score_accessibility (0-3), total_score (0-12), grade,
contact_methods (JSON), metadata (JSON),
created_at, updated_at
```

### Adaptation from AIdvisor Boost

**Reuse directly** (from `05-Agents/domain/authority-alignment/lib/`):
- `multi-hop-search.ts` — Multi-hop Tavily search logic (adapt search queries for political context)
- `confidence-scorer.ts` — Confidence calculation for platform ownership verification
- `platform-classifier.ts` — Platform categorization logic
- `screenshot-capture.ts` — Playwright screenshot automation
- `scoring-engine.ts` — Dual-level scoring (adapt dimensions for political candidates)
- `risk-analyzer.ts` — Risk identification framework (adapt categories for political context)

**Adapt** (new political context):
- Discovery prompts: Search for "{candidate name} {state} {office}" instead of "{advisor name} {firm}"
- Scoring dimensions: "Campaign Consistency" replaces "Brand Consistency", "Voter Accessibility" replaces "Contactability"
- Risk categories: Add FEC compliance, campaign finance, political controversy
- Competitor tracking: Opponents in the same race instead of market competitors

**New** (political-specific):
- FEC filing lookup integration
- Opponent auto-discovery from ballot/election data
- News/media coverage sentiment analysis
- Voting record cross-reference (for incumbents, via existing Liberty Index)

---

## Report Sections (Research Tasks)

Each section is independently assignable to a committee member. Sections marked with **[Auto]** are pre-populated by the digital audit:

| Section | Content | Auto-Audit? | AI-Assistable? |
|---------|---------|-------------|----------------|
| Executive Summary | Contact info, headshot, social links, age, party, incumbent status, fundraising (FEC), survey link | **[Auto]** partial — social links, website, headshot from screenshots | Partial (FEC data) |
| Election Schedule | Primary/general dates, runoffs — auto-populated from state deadline database | No (from deadline DB) | Yes (from deadline DB) |
| Voting Rules | State-specific: who can vote, party registration, absentee rules, early vote % | No | Yes |
| Candidate Background | Employment, education, political experience, background check | **[Auto]** draft from web research | Yes (draft) |
| Incumbent Record | Voting record / Liberty Index score (links to existing scorecard system) | **[Auto]** if incumbent, from scorecard | Yes (from scorecard) |
| Opponent Research | Per-opponent: background, credibility, fundraising, endorsements, social links, headshot | **[Auto]** opponent discovery, platforms, basic backgrounds | Yes (draft) |
| Electoral Results | Historical election results for the district with vote counts/percentages | No | Yes |
| District Data | Cook PVI, population, party registration, map, municipalities, counties, overlapping districts, state legislature info | **[Auto]** partial from web research | Yes |
| **Digital Presence Audit** *(NEW)* | Platform scorecard, screenshot gallery, risk assessment, competitive positioning vs opponents | **[Auto]** full — this IS the audit output | N/A (fully automated) |

---

## Key Design Decisions

### Committee Structure
- **Formal committee** with defined members tracked in `rlc_candidate_vetting_committee_members`
- **Chair role** can assign sections, make recommendations
- **Member role** can research assigned sections
- Committee membership is separate from the core `UserRole` RBAC — stored in its own table, checked via `getVettingContext()` helper

### Data Model: Hybrid Approach
- **Report sections**: One row per section per vetting, using `section` enum key + `data` JSON column (follows charter onboarding step pattern)
- **Opponents**: Normalized table (`rlc_candidate_vetting_opponents`) since they're a variable-length collection with repeating structure
- **District data & election deadlines**: Shared reference tables so candidates in the same district/state reuse data
- **Board votes**: Normalized table for auditability (one row per board member per vetting)

### AI Integration
- AI drafts stored in `ai_draft_data` column, separate from human-reviewed `data`
- UI shows "AI-generated — review required" banner
- Committee member must explicitly accept/edit before data is finalized
- Uses Vercel AI SDK + Anthropic (existing pattern from `lib/ai/analyze-bill.ts`)

### Report Output
- In-platform rendered report page at `/admin/vetting/[id]/report`
- PDF export via **Playwright HTML→PDF** (proven approach from AIdvisor Boost lead magnet system)

### PDF Generation (Lessons from AIdvisor Boost)
- **Approach**: HTML/CSS report template rendered to PDF via Playwright's `page.pdf()`
- **Layout**: Flexbox page structure — `.page` div with `display: flex; flex-direction: column;`
- **Footers**: Use `margin-top: auto` on `.page-footer` — **NEVER** `position: absolute/relative`
- **Page breaks**: Explicit `page-break-before: always` on each `.page` div; `page-break-inside: avoid` on tables, callouts, candidate cards
- **Margins**: Set `@page { margin: 0 }` in CSS, control margins only via Playwright `page.pdf()` options — they **stack** otherwise
- **Min-height**: Calculate exact available space: `11in - top_margin - bottom_margin` (e.g., `10.4in` with `0.35in + 0.25in` margins)
- **Fonts**: Use `<link>` in `<head>` for Google Fonts — **NEVER** `@import` inside `<style>` (causes FOUT)
- **API route**: `/api/v1/admin/vetting/[id]/report/pdf` — renders HTML template server-side, launches Playwright, returns PDF

---

## Database Schema (New Tables)

### New Enums
- `VettingStage`: survey_submitted, auto_audit, assigned, research, interview, committee_review, board_vote
- `VettingReportSectionType`: digital_presence_audit, executive_summary, election_schedule, voting_rules, candidate_background, incumbent_record, opponent_research, electoral_results, district_data
- `AuditStatus`: pending, running, completed, failed
- `VettingRecommendation`: endorse, do_not_endorse, no_position
- `VettingSectionStatus`: not_started, assigned, in_progress, completed, needs_revision
- `BoardVoteChoice`: endorse, do_not_endorse, no_position, abstain
- `CommitteeRole`: chair, member

### New Tables

All tables use the `rlc_candidate_` prefix for consistency:

| Table | Purpose |
|-------|---------|
| `rlc_candidate_vetting_committees` | Committee definition (name, active status) |
| `rlc_candidate_vetting_committee_members` | Who's on the committee, their role (chair/member) |
| `rlc_candidate_vettings` | Master record per candidate being vetted — links to CandidateResponse, tracks stage, recommendation, endorsement result |
| `rlc_candidate_vetting_report_sections` | One row per section per vetting — section type enum + data JSON + AI draft JSON + status + assignments |
| `rlc_candidate_vetting_section_assignments` | Which committee member is assigned to which section |
| `rlc_candidate_vetting_opponents` | Normalized opponent records (name, party, credibility, background, fundraising, etc.) |
| `rlc_candidate_vetting_board_votes` | Individual board member votes (vote choice + notes) |
| `rlc_candidate_election_deadlines` | Primary/general dates by state, election cycle, and office type — shared reference data with override capability |
| `rlc_candidate_district_data` | District demographics, Cook PVI, party registration, municipalities, counties, electoral history — shared across candidates in same district |
| `rlc_candidate_digital_audits` | Full digital presence audit results per vetting — overall scores, risk assessment, discovery log, screenshots manifest |
| `rlc_candidate_audit_platforms` | Normalized per-platform records from the audit — one row per platform per entity (candidate or opponent), with scores, screenshots, activity status |

### Modified Tables
- `Contact`: Add relations for committee memberships and board votes
- `CandidateResponse`: Add 1:1 relation to `CandidateVetting`

---

## Permission Model

| Action | Who | Check |
|--------|-----|-------|
| View pipeline | Committee members, national_board, super_admin | `VettingCommitteeMember.isActive` OR `AdminContext.isNational` |
| Assign sections | Committee chair | `CommitteeRole.chair` |
| Edit assigned sections | Assigned member | `VettingReportSectionAssignment` match |
| Record interview | Committee members | Membership check |
| Make recommendation | Committee chair | `CommitteeRole.chair` |
| Cast board vote | national_board, super_admin | `AdminContext.roles` check |
| Manage committee | national_board, super_admin | `AdminContext.isNational` |
| Manage deadlines | national_board, super_admin | `AdminContext.isNational` |

New helper: `getVettingContext()` in `/lib/vetting/permissions.ts` extends `AdminContext` with committee membership info.

---

## Admin UI Pages

### Navigation
New "Vetting" section in admin nav:
- **Pipeline** (`/admin/vetting`) — Dashboard with all candidates in pipeline
- **Committee** (`/admin/vetting/committee`) — Manage committee members
- **Deadlines** (`/admin/vetting/deadlines`) — Manage election deadlines by state

### Pipeline Dashboard (`/admin/vetting`)
- Table view: Candidate Name, State, Office, District, Stage (badge), Primary Date, Days Until Primary, Recommendation, Actions
- Urgency highlighting: <30 days amber, <14 days red
- Filters: stage, state, deadline urgency
- Future: Kanban board toggle

### Vetting Detail (`/admin/vetting/[id]`)
Tabbed layout following onboarding wizard pattern (sidebar progress + main content):
- **Left sidebar**: Candidate card + section progress checklist
- **Tabs**: Report Sections | Opponents | Interview | Recommendation | Board Vote | History

### Committee Management (`/admin/vetting/committee`)
- Member table with role, joined date, active toggle
- Add member (search rlc_members), set as chair

### Deadline Management (`/admin/vetting/deadlines`)
- Filterable table: state, cycle year, office type, primary/general dates
- Inline editing, bulk import via CSV

### Report Preview (`/admin/vetting/[id]/report`)
- Full-width formatted report matching PDF layout
- Export PDF button

---

## AI Research Helpers

New directory: `/lib/ai/vetting/`

| Helper | Input | Output |
|--------|-------|--------|
| `research-opponent.ts` | Opponent name, party, district | Background, experience, fundraising draft |
| `research-district.ts` | State + district ID | Cook PVI, demographics, electoral history |
| `research-voting-rules.ts` | State code | Who can vote, registration rules, absentee rules |
| `draft-candidate-background.ts` | Candidate name, office, state | Employment, education, experience draft |
| `generate-executive-summary.ts` | All completed sections | Summary paragraph |

Each follows the `lib/ai/analyze-bill.ts` pattern: structured input → system prompt → structured JSON output → stored in `ai_draft_data`.

---

## Implementation Phases

### Phase 1: Foundation (#101)
- Prisma schema (all new enums + models, including audit tables) + migration
- TypeScript types + Zod validation schemas
- `getVettingContext()` permission helper
- Committee CRUD (API + UI)
- Election deadline CRUD (API + UI)
- Basic vetting creation from candidate response
- Pipeline list page (table view)

### Phase 2: Report Sections & Assignments (#102)
- Section CRUD + assignment API routes (including new `digital_presence_audit` section type)
- Vetting detail page (tabbed layout)
- Section edit forms for all 9 section types
- Assignment flow (chair assigns member)
- Progress tracking sidebar
- Opponent CRUD (API + UI)
- Stage advancement logic (including auto_audit → assigned transition)

### Phase 3: Digital Presence Audit (Adapted from AIdvisor Boost) (#103)
- Port/adapt core modules from `05-Agents/domain/authority-alignment/lib/`:
  - `multi-hop-search.ts` → candidate/opponent discovery engine
  - `screenshot-capture.ts` → campaign site + social media screenshots
  - `scoring-engine.ts` → political candidate scoring dimensions
  - `risk-analyzer.ts` → political risk categories (FEC, messaging, reputation)
  - `confidence-scorer.ts` → platform ownership verification
- Audit orchestrator: `lib/vetting/audit-engine.ts`
  - Triggered automatically when vetting moves to `auto_audit` stage
  - Runs as background job (Vercel serverless with long timeout or edge function)
  - Discovers candidate platforms → captures screenshots → scores → identifies risks
  - Discovers opponents → runs mini-audit on each
  - Pre-populates report sections with draft data (executive_summary, candidate_background, opponent_research, district_data)
  - Stores full results in `rlc_candidate_digital_audits` + `rlc_candidate_audit_platforms`
  - Advances stage to `assigned` on completion
- Audit results UI tab on vetting detail page:
  - Platform scorecard with screenshots
  - Risk assessment cards
  - Score breakdown visualization
  - Opponent comparison grid
- API routes:
  - `POST /api/v1/admin/vetting/[id]/audit/run` — trigger/re-run audit
  - `GET /api/v1/admin/vetting/[id]/audit` — get audit results
  - `GET /api/v1/admin/vetting/[id]/audit/platforms` — get platform detail

### Phase 4: AI Research Helpers (#104)
- 5 additional AI research helpers (supplement audit data with deeper research)
- AI draft API routes
- Draft review/accept UI with "AI-generated" badges
- District data shared table + AI population
- Voting rules AI lookup

### Phase 5: Approval Workflow (#105)
- Interview tab (date, notes)
- Recommendation API + chair-only UI
- Board vote API (cast, tally, finalize)
- Board vote UI (member grid, vote dropdowns, tally)
- Stage transition enforcement (all sections complete before review)
- Endorsement result synced to CandidateResponse status

### Phase 6: Report & Polish (#106)
- Full report preview page (HTML/CSS matching PDF layout)
- PDF export via Playwright HTML→PDF (following AIdvisor Boost patterns: flexbox pages, explicit breaks, margin-safe footers)
- Report HTML template with CSS variables for branding
- Digital Presence Audit section in report (platform scorecard, screenshots, scores)
- Deadline urgency highlighting
- Liberty Index integration for incumbents
- Audit/history log
- E2E tests

### Future (Post-MVP)
- HighLevel CRM tagging based on endorsement status
- Email notifications for assignments and pending votes
- Candidate portal (view vetting status)
- Bulk import election deadlines from FEC/Ballotpedia
- Kanban board view for pipeline
- Audit monitoring mode (scheduled re-audits for endorsed candidates during campaign season)
- FEC API integration for real-time fundraising data
- News/media sentiment analysis integration

---

## Critical Files to Modify/Create

**Modify:**
- `prisma/schema.prisma` — Add all new enums + models
- `types/index.ts` — Add TypeScript types
- `components/admin/admin-nav.tsx` — Add Vetting nav section

**Create (key new files):**
- `lib/vetting/permissions.ts` — `getVettingContext()` helper
- `lib/vetting/engine.ts` — Stage transition logic (pattern from `lib/onboarding/engine.ts`)
- `lib/vetting/audit-engine.ts` — Digital presence audit orchestrator (adapted from AIdvisor Boost authority-alignment agent)
- `lib/vetting/audit/` — Ported/adapted modules: `discovery.ts`, `screenshots.ts`, `scoring.ts`, `risks.ts`, `confidence.ts`
- `lib/validations/vetting.ts` — Zod schemas
- `lib/ai/vetting/*.ts` — 5 AI research helpers
- `app/(admin)/admin/vetting/page.tsx` — Pipeline dashboard
- `app/(admin)/admin/vetting/[id]/page.tsx` — Vetting detail
- `app/(admin)/admin/vetting/[id]/report/page.tsx` — Report preview
- `app/(admin)/admin/vetting/committee/page.tsx` — Committee management
- `app/(admin)/admin/vetting/deadlines/page.tsx` — Deadline management
- `app/api/v1/admin/vetting/` — All API routes (including `/audit/run`, `/audit`)
- `components/admin/vetting/` — All vetting-specific components (including audit results UI, platform scorecard, risk cards)

**Existing patterns to follow:**
- `lib/onboarding/engine.ts` — Stage transition logic
- `components/admin/onboarding/onboarding-wizard.tsx` — Multi-step UI with progress sidebar
- `lib/ai/analyze-bill.ts` — AI integration pattern
- `lib/admin/permissions.ts` — Permission checking pattern
- `components/admin/survey-management.tsx` — Admin CRUD pattern
- `~/AIdvisor-Boost/AIdvisor-Boost-System/03-Component-Library/lead-magnets/render-pdf.js` — Playwright PDF rendering script
- `~/AIdvisor-Boost/AIdvisor-Boost-System/03-Component-Library/lead-magnets/shared-styles/base.css` — PDF page layout CSS patterns
- `~/AIdvisor-Boost/AIdvisor-Boost-System/04-Patterns/development/pdf-generation.md` — PDF generation rules & gotchas

**AIdvisor Boost Authority Audit source files (to port/adapt for Phase 3):**
- `~/AIdvisor-Boost/AIdvisor-Boost-System/05-Agents/domain/authority-alignment/` — Full agent system
- `~/AIdvisor-Boost/AIdvisor-Boost-System/05-Agents/domain/authority-alignment/lib/multi-hop-search.ts` — Multi-hop Tavily discovery
- `~/AIdvisor-Boost/AIdvisor-Boost-System/05-Agents/domain/authority-alignment/lib/confidence-scorer.ts` — Platform ownership verification
- `~/AIdvisor-Boost/AIdvisor-Boost-System/05-Agents/domain/authority-alignment/lib/screenshot-capture.ts` — Playwright screenshot automation
- `~/AIdvisor-Boost/AIdvisor-Boost-System/05-Agents/domain/authority-alignment/lib/scoring-engine.ts` — Dual-level scoring system
- `~/AIdvisor-Boost/AIdvisor-Boost-System/05-Agents/domain/authority-alignment/lib/risk-analyzer.ts` — Risk identification & severity
- `~/AIdvisor-Boost/AIdvisor-Boost-System/05-Agents/domain/authority-alignment/lib/competitor-tracker.ts` — Competitor intelligence (→ opponent research)
- `~/AIdvisor-Boost/AIdvisor-Boost-System/05-Agents/domain/authority-alignment/schemas/` — JSON schemas for all audit data structures

---

## Verification Plan

1. **Schema**: Run `npx prisma migrate dev` — verify migration applies cleanly
2. **Committee CRUD**: Create committee, add members, set chair via admin UI
3. **Pipeline**: Submit candidate survey → verify vetting record created → auto-audit triggers → advance through stages
4. **Auto-Audit**: Trigger audit for a test candidate → verify platforms discovered → screenshots captured → scores calculated → risks identified → results stored in `rlc_candidate_digital_audits` + `rlc_candidate_audit_platforms` → report sections pre-populated with draft data
5. **Assignments**: Chair reviews audit results → assigns remaining sections → assigned member sees tasks → fills in data → marks complete
6. **AI Drafts**: Trigger AI draft for a section → verify draft stored in `ai_draft_data` → accept into `data`
7. **Recommendation**: Chair submits recommendation → verify stage advances to board_vote
8. **Board Vote**: Board members cast votes → finalize → verify endorsement result on CandidateResponse
9. **Report**: View in-platform report → verify all 9 sections render (including Digital Presence Audit with platform scorecard + screenshots) → export PDF → verify formatting
10. **Deadlines**: Create state deadline → create vetting in that state → verify urgency highlighting
11. **Permissions**: Verify committee member can't make recommendations, non-board can't vote, etc.
12. **E2E tests**: Playwright tests for critical path (survey → auto-audit → assign → research → vote → endorse)

---

## Open Questions Resolved

- **Survey location**: Migrating to platform (using existing survey system) — no HighLevel dependency
- **Committee structure**: Formal committee with chair/member roles
- **Task division**: Section-based — different members research different sections
- **Approval flow**: Committee recommends → Board votes
- **Automation level**: AI-assisted (Claude drafts sections, humans review/edit) + automated digital presence audit
- **Deadlines**: State deadline database with per-candidate override
- **Report output**: In-platform view + PDF export
- **Table naming**: All tables prefixed with `rlc_candidate_` for consistency
- **PDF generation**: Playwright HTML→PDF (proven AIdvisor Boost approach, not react-pdf)
- **Auto-audit**: Adapted from AIdvisor Boost Authority Alignment System — runs automatically after survey submission, pre-populates report sections, dramatically reduces manual research burden
