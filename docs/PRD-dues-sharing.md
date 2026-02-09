# PRD: Dues Sharing & Revenue Split System

**Status**: Approved for implementation
**Date**: 2026-02-08
**Author**: Matt Nye + Claude Code
**Priority**: P0

---

## Overview

Automate the distribution of RLC membership dues between National and state/local chapters using Stripe Connect. When a member pays (e.g., $45 Individual), National keeps a flat $15 and the remainder flows to the member's state chapter. States can further define sub-splits to route funds to regions and counties.

**User Story**: "As a National admin, I want membership dues to be automatically split and disbursed to the appropriate chapters so that I don't have to manually track and transfer funds."

**User Story**: "As a state chapter chair, I want to configure how my chapter's share is divided among counties/regions and see real-time reports of incoming dues."

---

## Business Rules

### Core Split Formula
- **National flat fee**: $15 per membership payment, regardless of tier or number of people covered
- **Remainder**: Goes to the member's state chapter
- **Scope**: Memberships only. Donations go 100% to the attributed chapter with no split.

### Split Examples by Tier

| Tier | Total | National | State Share |
|------|-------|----------|-------------|
| Student/Military | $30 | $15 | $15 |
| Individual | $45 | $15 | $30 |
| Premium (incl. spouse) | $75 | $15 | $60 |
| Sustaining (family) | $150 | $15 | $135 |
| Patron | $350 | $15 | $335 |
| Benefactor | $750 | $15 | $735 |
| Roundtable | $1,500 | $15 | $1,485 |

### Sub-Split System
- States define their own sub-split percentages with sub-chapters (regions/counties)
- Up to 4 levels deep: National > State > Region > County
- Each state's rules are independent — no national standard for sub-splits
- Rules must sum to exactly 100%
- Changes to rules apply to future payments only (historical entries are immutable)

### Disbursement Model (Hybrid)
Each state chapter chooses one of two models:

1. **National-managed**: State defines sub-split rules in the platform. National disburses directly to state AND all sub-chapters via Stripe Connect.
2. **State-managed**: National sends the full state share to the state. State handles internal distribution offline.

The platform tracks all splits for transparency regardless of which model is chosen.

### Chapter Assignment
- Member chooses their chapter at signup when the form supports it
- Default: derived from mailing address state
- On renewal: splits route to member's CURRENT `primary_chapter_id` (handles moves)

### Edge Cases
- **No state chapter exists**: National keeps 100%
- **Chapter not onboarded to Stripe Connect**: Accumulate in ledger, transfer when they onboard
- **Refunds**: Auto-reverse all splits (clawback from Connected Accounts)
- **Partial refunds**: Proportional reversal across all recipients
- **Family memberships**: $15 per membership, not per person covered

---

## Payment Infrastructure

### Stripe Connect Express
- Chapters onboard as Stripe Express Connected Accounts
- Stripe handles KYC/onboarding — no custom forms needed
- Each chapter gets a Stripe dashboard to view their payouts
- **Transfer model**: Separate Charges and Transfers (supports multi-recipient splits from single payment)

### Transfer Timing
- Immediate on payment — no minimum threshold, no batching
- Chapters not yet onboarded accumulate in internal ledger
- Pending ledger drains automatically when chapter completes onboarding

### Refund Handling
- `charge.refunded` webhook triggers automatic reversal
- Each transferred split gets a `stripe.transfers.createReversal()`
- Pending (never transferred) entries marked as reversed
- Partial refunds calculated proportionally

---

## Self-Service Configuration

### Chapter Admins Can:
- Connect their chapter's bank account via Stripe Express onboarding
- View their Stripe Connect status and payout history
- Configure sub-split percentages with their sub-chapters
- Toggle between National-managed and State-managed disbursement
- View all reporting dashboards scoped to their chapter

### Access Control
- Split config: `state_chair` role or higher for the specific chapter
- Banking/onboarding: `chapter_admin` role or higher
- Reporting: `chapter_admin` role or higher, scoped by `visibleChapterIds`

---

## Reporting Requirements

### 1. Real-Time Dashboard
- KPIs: Total dues received (MTD), pending (not yet transferred), total transferred (YTD)
- Recent activity feed (last 20 transactions)
- National view: all state distributions + chapters with pending balances

### 2. Monthly Statements
- Downloadable CSV (follow existing export pattern)
- Period summary: total received, transferred, reversals, net
- Stripe Transfer IDs for reconciliation

### 3. Member-Level Detail
- Which members generated which dues for this chapter
- Shows: name, email, tier, total paid, chapter's share, payment date
- Scoped by chapter visibility

### 4. Historical Trends
- Month-over-month and year-over-year charts
- Transaction counts and dollar amounts

### 5. Full Audit Trail
- Every ledger entry: date, amount, source, recipient, Stripe Transfer ID, status
- Split rule snapshot (what rules were in effect)
- Who configured the rules
- Paginated with filters

---

## Database Schema (New)

### New Enums
- `DisbursementModel`: national_managed, state_managed
- `StripeConnectStatus`: not_started, onboarding, active, disabled
- `SplitLedgerStatus`: pending, transferred, reversed, failed
- `SplitSourceType`: membership, donation, event_registration

### New Tables

**rlc_chapter_stripe_accounts** (1:1 with chapters)
- Stores Stripe Connect account ID, status, charges_enabled, payouts_enabled
- Updated via `account.updated` webhook

**rlc_chapter_split_configs** (1:1 with chapters)
- Stores disbursement model choice (national_managed vs state_managed)
- Tracks who last updated it

**rlc_chapter_split_rules** (many per config)
- Each row = one recipient chapter + percentage
- Unique constraint on (config_id, recipient_chapter_id)
- Validation: all active rules sum to 100.00

**rlc_split_ledger_entries** (immutable audit trail)
- One row per recipient per payment
- Links to contribution, recipient chapter
- Tracks Stripe Transfer ID, status, transferred_at
- Snapshots the split rules at time of calculation
- Self-referential for reversals (reversal_of_id)

### Modifications to Existing Tables
- `rlc_contributions`: Must set `chapter_id` for membership payments (currently only set for donations)
- New relations from Chapter, Contribution, Member models

---

## Build Phases

### Phase 1: Schema + Split Engine
- Database schema additions (migration)
- Split calculation engine with unit tests
- Webhook update: set `chapter_id` on membership contributions
- Write ledger entries (all pending — no transfers yet)

### Phase 2: Stripe Connect Onboarding
- ChapterStripeAccount management
- Onboarding API routes
- Admin UI: banking page
- `account.updated` webhook handler

### Phase 3: Transfer Execution
- Stripe Transfer creation after ledger entries
- Pending ledger drain on onboarding
- Transfer status tracking

### Phase 4: Refund Handling
- `charge.refunded` webhook handler
- Transfer reversal logic
- Partial refund support

### Phase 5: Sub-Split Config UI
- Split config API routes with Zod validation
- Admin UI for configuring sub-splits
- Disbursement model toggle

### Phase 6: Reporting
- Dashboard, statements, member detail, trends, audit trail
- All scoped by admin chapter visibility

---

## Environment Variables (New)

```
STRIPE_CONNECT_RETURN_URL=https://rlc.org/admin/chapters/{chapter_id}/banking?onboarding=complete
STRIPE_CONNECT_REFRESH_URL=https://rlc.org/admin/chapters/{chapter_id}/banking?onboarding=refresh
NATIONAL_CHAPTER_ID=<uuid>
```

---

## Future Extensibility

The architecture supports adding these later with minimal changes:
- **Donation splitting**: Change scope check from "memberships only" to include donations
- **Event revenue splitting**: Add `event_registration` source type, call split engine from event payment handler
- **Custom split formulas per tier**: Add tier-based rules to ChapterSplitConfig
- **International chapters**: Currency field already on ledger entries

---

## Acceptance Criteria

- [ ] Every membership payment creates correct ledger entries with accurate amounts
- [ ] National always receives exactly $15 regardless of tier
- [ ] State chapters receive the correct remainder
- [ ] Sub-splits are calculated correctly per configured rules
- [ ] Stripe Connect onboarding works self-service for chapter admins
- [ ] Transfers execute immediately for onboarded chapters
- [ ] Pending entries transfer when chapter completes onboarding
- [ ] Refunds auto-reverse all splits
- [ ] Dashboard shows real-time data scoped to admin's chapters
- [ ] Monthly statements are downloadable as CSV
- [ ] Full audit trail with Stripe Transfer IDs
- [ ] States can toggle between National-managed and State-managed disbursement
- [ ] All reporting respects admin permission scoping
