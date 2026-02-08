# UX Transformation — Task Orchestration Plan

**Epic:** #57 | **Issues:** #58–#65
**Strategy:** Adaptive (sequential foundation → parallel workstreams)
**Total Scope:** ~58 new files, ~33 modified files, 8 phases

---

## Dependency Graph

```
Phase 0 (#58) ─── Wireframe Mockups (reference only, non-blocking)
    │
Phase 1 (#59) ─── Component Foundation + Visual Identity [CRITICAL PATH]
    │
    ├──→ Phase 2 (#60) ─── Homepage Command Center
    │       │
    │       └──→ Phase 4 (#62) ─── Engagement Engine (also needs Phase 1)
    │
    ├──→ Phase 3 (#61) ─── Navigation + Footer [PARALLEL with Phase 2]
    │
    ├──→ Phase 5 (#63) ─── Member Dashboard [PARALLEL with Phase 2/3]
    │
    ├──→ Phase 6 (#64) ─── Empty States + HighLevel [PARALLEL with Phase 2/3/5]
    │
    └──→ Phase 7 (#65) ─── Admin Visual Redesign [PARALLEL with Phase 4/5/6]
```

### Execution Waves

| Wave | Phases | Strategy | Est. Days |
|------|--------|----------|-----------|
| **Wave 0** | Phase 0 (Mockups) | Sequential — design reference | 1 |
| **Wave 1** | Phase 1 (Foundation) | Sequential — everything depends on this | 1 |
| **Wave 2** | Phase 2 + Phase 3 + Phase 6A | **Parallel** — independent workstreams | 2-3 |
| **Wave 3** | Phase 4 + Phase 5 + Phase 6B | **Parallel** — independent workstreams | 2 |
| **Wave 4** | Phase 7 | Sequential — uses all prior components | 3 |

---

## Epic → Story → Task Hierarchy

### EPIC: UX Transformation (#57)

---

### STORY 0: Wireframe Mockups (#58)
> Design reference for all implementation phases

| ID | Task | Type | Files | Tier | Delegation |
|----|------|------|-------|------|------------|
| 0.1 | Create homepage command center mockup | Create | `docs/mockups/01-homepage.html` | T2 | `/sc:design` |
| 0.2 | Create member dashboard mockup | Create | `docs/mockups/02-member-dashboard.html` | T2 | `/sc:design` |
| 0.3 | Create admin navigation mockup | Create | `docs/mockups/03-admin-nav.html` | T1 | `/sc:design` |
| 0.4 | Create scorecard sharing mockup | Create | `docs/mockups/04-scorecard.html` | T2 | `/sc:design` |
| 0.5 | Create action confirmation mockup | Create | `docs/mockups/05-action-confirmation.html` | T1 | `/sc:design` |
| 0.6 | Create navigation before/after mockup | Create | `docs/mockups/06-navigation.html` | T1 | `/sc:design` |
| 0.7 | Create admin dashboard mockup | Create | `docs/mockups/07-admin-dashboard.html` | T2 | `/sc:design` |
| 0.8 | Create admin members list mockup | Create | `docs/mockups/08-admin-members.html` | T2 | `/sc:design` |
| 0.9 | Create admin member detail mockup | Create | `docs/mockups/09-admin-member-detail.html` | T2 | `/sc:design` |
| 0.10 | Create admin reports mockup | Create | `docs/mockups/10-admin-reports.html` | T2 | `/sc:design` |

**Quality Gate:** All 10 files viewable in browser at 375px/768px/1024px/1440px

---

### STORY 1: Component Foundation + Visual Identity (#59)
> **CRITICAL PATH** — blocks all subsequent stories

| ID | Task | Type | Files | Tier | Delegation |
|----|------|------|-------|------|------------|
| **1A. shadcn/ui Installation** | | | | | |
| 1A.1 | Install 17 shadcn/ui components | Shell | `components/ui/` (17 files) | T1 | `/sc:implement` |
| 1A.2 | Verify all components importable | Verify | — | T1 | `/sc:test` |
| **1B. Oswald Font** | | | | | |
| 1B.1 | Import Oswald via next/font/google | Modify | `app/layout.tsx` | T1 | `/sc:implement` |
| 1B.2 | Set `--font-heading` CSS variable | Modify | `app/layout.tsx` | T1 | `/sc:implement` |
| 1B.3 | Apply Oswald to h1/h2/h3 in base layer | Modify | `app/globals.css` | T1 | `/sc:implement` |
| **1C. Animation Keyframes** | | | | | |
| 1C.1 | Add `count-up` keyframe + animation class | Modify | `tailwind.config.ts` | T1 | `/sc:implement` |
| 1C.2 | Add `slide-in` keyframe + animation class | Modify | `tailwind.config.ts` | T1 | `/sc:implement` |
| 1C.3 | Add `fade-in` keyframe + animation class | Modify | `tailwind.config.ts` | T1 | `/sc:implement` |
| 1C.4 | Add `pulse-urgent` keyframe + animation class | Modify | `tailwind.config.ts` | T1 | `/sc:implement` |
| **1D. RLC Base Components** | | | | | |
| 1D.1 | Create `stat-card` component | Create | `components/ui/stat-card.tsx` | T2 | `/sc:implement` |
| 1D.2 | Create `score-badge` component | Create | `components/ui/score-badge.tsx` | T2 | `/sc:implement` |
| 1D.3 | Create `status-badge` component | Create | `components/ui/status-badge.tsx` | T2 | `/sc:implement` |
| 1D.4 | Create `data-table` component | Create | `components/ui/data-table.tsx` | T3 | `/sc:implement` |
| 1D.5 | Create `urgency-badge` component | Create | `components/ui/urgency-badge.tsx` | T2 | `/sc:implement` |
| 1D.6 | Create `empty-state` component | Create | `components/ui/empty-state.tsx` | T1 | `/sc:implement` |
| 1D.7 | Create `page-header` component | Create | `components/ui/page-header.tsx` | T1 | `/sc:implement` |

**Quality Gate:** `npx tsc --noEmit` + `npx next build` pass

**Subtask Dependencies:**
- 1A.1 → 1A.2 (verify after install)
- 1B.1 + 1B.2 → 1B.3 (CSS uses the variable)
- 1C.1–1C.4 are independent (parallel)
- 1D.1–1D.7 depend on 1A.1 (use shadcn Card, Badge, Progress, etc.)

---

### STORY 2: Homepage Command Center (#60)
> **Depends on:** Story 1

| ID | Task | Type | Files | Tier | Delegation |
|----|------|------|-------|------|------------|
| **2A. Server Data Loader** | | | | | |
| 2A.1 | Build parallel Supabase queries for homepage data | Modify | `app/page.tsx` | T2 | `/sc:implement` |
| **2B. Homepage Sections** | | | | | |
| 2B.1 | Create hero section with animated counters | Create | `components/home/hero-section.tsx` | T2 | `/sc:implement` |
| 2B.2 | Create urgency bar component | Create | `components/home/urgency-bar.tsx` | T1 | `/sc:implement` |
| 2B.3 | Create live activity feed (polls API) | Create | `components/home/activity-feed.tsx` | T3 | `/sc:implement` |
| 2B.4 | Create scorecard spotlight section | Create | `components/home/scorecard-spotlight.tsx` | T2 | `/sc:implement` |
| 2B.5 | Create active campaigns grid | Create | `components/home/campaign-grid.tsx` | T2 | `/sc:implement` |
| 2B.6 | Create stats bar with animated counters | Create | `components/home/stats-bar.tsx` | T2 | `/sc:implement` |
| 2B.7 | Create event preview section | Create | `components/home/event-preview.tsx` | T2 | `/sc:implement` |
| **2C. API Route** | | | | | |
| 2C.1 | Create public activity feed API endpoint | Create | `app/api/v1/activity/route.ts` | T2 | `/sc:implement` |
| **2D. Page Integration** | | | | | |
| 2D.1 | Rewrite `app/page.tsx` with all sections | Modify | `app/page.tsx` | T3 | `/sc:implement` |

**Quality Gate:** Homepage loads with dynamic data, graceful empty states, mobile responsive

**Subtask Dependencies:**
- 2A.1 → 2D.1 (data loader feeds page)
- 2B.1–2B.7 are independent (parallel creation)
- 2C.1 → 2B.3 (activity feed polls the API)
- All 2B.* → 2D.1 (page assembles all sections)

---

### STORY 3: Navigation Overhaul + Footer Fix (#61)
> **Depends on:** Story 1 | **Parallel with:** Story 2

| ID | Task | Type | Files | Tier | Delegation |
|----|------|------|-------|------|------------|
| 3A.1 | Redesign public nav (Learn>Join>Act funnel) | Modify | `components/navigation/main-nav.tsx` | T2 | `/sc:implement` |
| 3B.1 | Redesign member nav (add engagement links) | Modify | `components/navigation/member-nav.tsx` | T2 | `/sc:implement` |
| 3C.1 | Group admin nav with section headers | Modify | `components/navigation/admin-nav.tsx` | T2 | `/sc:implement` |
| 3D.1 | Fix 6 broken footer links | Modify | `components/layout/footer.tsx` | T1 | `/sc:implement` |
| 3D.2 | Add Action Center + Scorecards to footer | Modify | `components/layout/footer.tsx` | T1 | `/sc:implement` |
| 3D.3 | Add social media links to footer | Modify | `components/layout/footer.tsx` | T1 | `/sc:implement` |

**Quality Gate:** All nav links resolve, no 404s, mobile hamburger works

**Subtask Dependencies:**
- 3A.1, 3B.1, 3C.1 are independent (parallel)
- 3D.1 → 3D.2 → 3D.3 (sequential edits to same file)

---

### STORY 4: Engagement Engine (#62)
> **Depends on:** Story 1 + Story 2

| ID | Task | Type | Files | Tier | Delegation |
|----|------|------|-------|------|------------|
| **4A. Share Buttons** | | | | | |
| 4A.1 | Create share buttons component (Twitter, Facebook, copy, email) | Create | `components/shared/share-buttons.tsx` | T2 | `/sc:implement` |
| **4B. Post-Action Confirmation** | | | | | |
| 4B.1 | Create action confirmation dialog | Create | `components/action-center/action-confirmation.tsx` | T2 | `/sc:implement` |
| 4B.2 | Integrate confirmation into contact page | Modify | `app/(public)/action-center/contact/page.tsx` | T2 | `/sc:implement` |
| **4C. Campaign Progress** | | | | | |
| 4C.1 | Create campaign progress bar component | Create | `components/action-center/campaign-progress.tsx` | T2 | `/sc:implement` |
| 4C.2 | Add progress bars to action center page | Modify | `app/(public)/action-center/page.tsx` | T2 | `/sc:implement` |
| **4D. Scorecard Sharing + OG** | | | | | |
| 4D.1 | Create OG image generation route | Create | `app/api/og/scorecard/route.tsx` | T3 | `/sc:implement` |
| 4D.2 | Create scorecard share component | Create | `components/scorecards/share-scorecard.tsx` | T2 | `/sc:implement` |
| 4D.3 | Add share buttons to legislator detail page | Modify | `app/(public)/scorecards/[slug]/[legislatorId]/page.tsx` | T2 | `/sc:implement` |
| 4D.4 | Add share to full scorecard page | Modify | `app/(public)/scorecards/[slug]/page.tsx` | T2 | `/sc:implement` |
| 4D.5 | Enhance legislator table (avatars, score bars, badges, mobile) | Modify | `components/scorecards/legislator-table.tsx` | T3 | `/sc:implement` |
| **4E. Member Context Badges** | | | | | |
| 4E.1 | Create member context badge component | Create | `components/shared/member-context-badge.tsx` | T2 | `/sc:implement` |
| 4E.2 | Add member participation context to action center | Modify | `app/(public)/action-center/page.tsx` | T2 | `/sc:implement` |
| 4E.3 | Highlight member's reps on scorecard page | Modify | `app/(public)/scorecards/[slug]/page.tsx` | T2 | `/sc:implement` |
| 4E.4 | Show registration status on events page | Modify | `app/(public)/events/page.tsx` | T2 | `/sc:implement` |

**Quality Gate:** Share URLs correct, OG previews render, member badges show, no auth errors for public visitors

**Subtask Dependencies:**
- 4A.1 → 4B.1, 4D.2 (share buttons used in confirmation + scorecard)
- 4B.1 → 4B.2 (component before integration)
- 4C.1 → 4C.2 (component before integration)
- 4D.1 independent (OG route standalone)
- 4D.2 → 4D.3, 4D.4 (component before page integration)
- 4E.1 → 4E.2, 4E.3, 4E.4 (component before integrations)

---

### STORY 5: Member Dashboard Transformation (#63)
> **Depends on:** Story 1 | **Parallel with:** Story 2, 3, 4

| ID | Task | Type | Files | Tier | Delegation |
|----|------|------|-------|------|------------|
| 5A.1 | Build dashboard data queries (participations, reps, events) | Modify | `app/(member)/dashboard/page.tsx` | T2 | `/sc:implement` |
| 5B.1 | Create impact summary component (animated stats) | Create | `components/dashboard/impact-summary.tsx` | T2 | `/sc:implement` |
| 5B.2 | Create urgent actions component | Create | `components/dashboard/urgent-actions.tsx` | T2 | `/sc:implement` |
| 5B.3 | Create "my reps" preview component (Civic API) | Create | `components/dashboard/my-reps-preview.tsx` | T3 | `/sc:implement` |
| 5B.4 | Create activity timeline component | Create | `components/dashboard/activity-timeline.tsx` | T2 | `/sc:implement` |
| 5C.1 | Create auth-required activity feed API | Create | `app/api/v1/me/activity/route.ts` | T2 | `/sc:implement` |
| 5D.1 | Rewrite dashboard page with all sections | Modify | `app/(member)/dashboard/page.tsx` | T3 | `/sc:implement` |

**Quality Gate:** Dashboard shows impact data, handles zero activity, mobile responsive

**Subtask Dependencies:**
- 5B.1–5B.4 independent (parallel creation)
- 5A.1 + 5B.* + 5C.1 → 5D.1 (all components ready before page assembly)

---

### STORY 6: Empty States + HighLevel Integration (#64)
> **Depends on:** Story 1 (empty-state component)

| ID | Task | Type | Files | Tier | Delegation |
|----|------|------|-------|------|------------|
| **6A. Empty State Overhaul** | | | | | |
| 6A.1 | Audit all pages for dead-end empty states | Research | — | T1 | `/sc:design` |
| 6A.2 | Replace dead ends with contextual empty-state + CTA | Modify | Multiple pages | T2 | `/sc:implement` |
| **6B. HighLevel Integration** | | | | | |
| 6B.1 | Create HighLevel notifications helper | Create | `lib/highlevel/notifications.ts` | T2 | `/sc:implement` |
| 6B.2 | Create HighLevel tags helper | Create | `lib/highlevel/tags.ts` | T2 | `/sc:implement` |
| 6B.3 | Add workflow trigger to Stripe webhook | Modify | `app/api/webhooks/stripe/route.ts` | T2 | `/sc:implement` |
| 6B.4 | Add workflow + tag methods to HL client | Modify | `lib/highlevel/client.ts` | T2 | `/sc:implement` |
| **6C. Placeholder Pages** | | | | | |
| 6C.1 | Create contact page | Create | `app/(public)/contact/page.tsx` | T1 | `/sc:implement` |
| 6C.2 | Create volunteer page | Create | `app/(public)/volunteer/page.tsx` | T1 | `/sc:implement` |

**Quality Gate:** No blank dead ends, HL workflow triggers fire, placeholder pages render

**Subtask Dependencies:**
- 6A.1 → 6A.2 (audit before replace)
- 6B.4 → 6B.1, 6B.2, 6B.3 (client methods before consumers)
- 6C.1, 6C.2 independent (parallel)

**Note:** Plan references `lib/ghl/` but actual path is `lib/highlevel/`. All GHL tasks target `lib/highlevel/`.

---

### STORY 7: Admin Visual Redesign (#65)
> **Depends on:** Story 1 (stat-card, status-badge, data-table, page-header)

| ID | Task | Type | Files | Tier | Delegation |
|----|------|------|-------|------|------------|
| **7A. Admin Dashboard** | | | | | |
| 7A.1 | Replace KPI cards with stat-card components | Modify | `app/(admin)/admin/page.tsx` | T2 | `/sc:implement` |
| 7A.2 | Add "Needs Attention" alert section | Modify | `app/(admin)/admin/page.tsx` | T2 | `/sc:implement` |
| 7A.3 | Add recent activity feed | Modify | `app/(admin)/admin/page.tsx` | T2 | `/sc:implement` |
| **7B. Data Tables** | | | | | |
| 7B.1 | Replace members HTML table → data-table | Modify | `app/(admin)/admin/members/page.tsx` | T3 | `/sc:implement` |
| 7B.2 | Replace campaigns HTML table → data-table | Modify | `app/(admin)/admin/campaigns/page.tsx` | T3 | `/sc:implement` |
| 7B.3 | Replace scorecards HTML table → data-table | Modify | `app/(admin)/admin/scorecards/page.tsx` | T3 | `/sc:implement` |
| **7C. Member Detail** | | | | | |
| 7C.1 | Restructure member detail with Card sections | Modify | `app/(admin)/admin/members/[id]/page.tsx` | T3 | `/sc:implement` |
| 7C.2 | Add quick action buttons | Modify | `app/(admin)/admin/members/[id]/page.tsx` | T2 | `/sc:implement` |
| 7C.3 | Replace contribution list with mini data-table | Modify | `app/(admin)/admin/members/[id]/page.tsx` | T2 | `/sc:implement` |
| **7D. Reports Dashboard** | | | | | |
| 7D.1 | Replace KPI cards with stat-card + trends | Modify | `app/(admin)/admin/reports/page.tsx` | T2 | `/sc:implement` |
| 7D.2 | Add visual progress bars to report tables | Modify | `app/(admin)/admin/reports/page.tsx` | T2 | `/sc:implement` |
| 7D.3 | Add date preset buttons | Modify | `app/(admin)/admin/reports/page.tsx` | T1 | `/sc:implement` |
| **7E. Chapter + Event Cards** | | | | | |
| 7E.1 | Add search/filter + health indicator to chapters | Modify | `app/(admin)/admin/chapters/page.tsx` | T2 | `/sc:implement` |
| 7E.2 | Add search/filter + registration fill bar to events | Modify | `app/(admin)/admin/events/page.tsx` | T2 | `/sc:implement` |
| **7F. Centralize Status Colors** | | | | | |
| 7F.1 | Create centralized status-colors constants | Create | `lib/constants/status-colors.ts` | T1 | `/sc:implement` |
| 7F.2 | Replace all local status color maps | Modify | ~10 admin pages | T2 | `/sc:implement` |
| **7G. Form Consistency** | | | | | |
| 7G.1 | Standardize forms to shadcn components | Modify | Campaign, scorecard, survey, event, post, chapter form pages | T2 | `/sc:implement` |

**Quality Gate:** All admin pages use shared components, no local color maps, `npx next build` passes

**Subtask Dependencies:**
- 7F.1 → 7F.2 (constants before consumers)
- 7A.*, 7B.*, 7C.*, 7D.*, 7E.* can run in parallel
- 7G.1 independent (can run parallel with everything in 7)

---

## Resource Optimization

### Parallel Execution Map

```
Wave 1 (Sequential — Foundation):
  └── [Story 1] Component Foundation + Visual Identity

Wave 2 (Parallel — 3 workstreams):
  ├── [Story 2] Homepage Command Center
  ├── [Story 3] Navigation + Footer
  └── [Story 6A] Empty State Audit + Overhaul

Wave 3 (Parallel — 3 workstreams):
  ├── [Story 4] Engagement Engine
  ├── [Story 5] Member Dashboard
  └── [Story 6B+C] HighLevel Integration + Placeholder Pages

Wave 4 (Sequential — Admin):
  └── [Story 7] Admin Visual Redesign
```

### Task Tier Distribution

| Tier | Count | Description |
|------|-------|-------------|
| T1 (Simple) | 22 | Installs, single-file edits, config changes |
| T2 (Standard) | 43 | Component creation, page modifications |
| T3 (Complex) | 8 | Data tables, OG image gen, page rewrites, Civic API integration |

---

## Corrections to Original Plan

| Item | Plan Says | Actual | Impact |
|------|-----------|--------|--------|
| GHL path | `lib/ghl/client.ts` | `lib/highlevel/client.ts` | Phase 6 file paths corrected |
| GHL helpers path | `lib/ghl/notifications.ts` | `lib/highlevel/notifications.ts` | Phase 6 file paths corrected |
| GHL tags path | `lib/ghl/tags.ts` | `lib/highlevel/tags.ts` | Phase 6 file paths corrected |
| shadcn/ui count | 3 existing | 3 confirmed (button, toast, toaster) | No impact |
| Admin pages | 23 | 23 confirmed | No impact |

---

## Verification Checkpoints

| After Wave | Verification |
|-----------|-------------|
| Wave 1 | `npx tsc --noEmit` + `npx next build` + all 24 components importable |
| Wave 2 | Homepage dynamic, nav works, empty states contextual |
| Wave 3 | Sharing works, OG images render, dashboard shows data, HL triggers fire |
| Wave 4 | All admin pages unified, no local color maps, forms consistent |

**Final E2E:**
- Homepage loads with dynamic data (graceful empty states if DB empty)
- Share buttons generate correct URLs with OG previews
- Activity feed polls and updates
- Post-action confirmation shows after campaign participation
- Admin nav sections clearly grouped with separators
- Member dashboard shows impact data
- All routes resolve (no 404s)
- Mobile responsive at 375px, 768px, 1024px, 1440px
