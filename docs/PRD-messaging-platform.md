# PRD: RLC Membership Messaging Platform

> **Status:** Requirements Complete | **Created:** 2026-02-08 | **Owner:** Matt Nye

## Context

RLC currently has fragmented communication:
- **State Coordinators** use **Signal** for grassroots organizing and new chapter traction (groups, DMs, file sharing, voice/video)
- **National Board** uses **Slack** ($100/month) for between-meeting discussions, threaded channels, and votes
- **Goal**: Consolidate all messaging into the RLC membership platform, eliminate Slack cost, replace Signal dependency, and eventually ship a full RLC membership mobile app

### Why Not Signal?
Signal has **no public API** — it's intentionally closed to third-party integrations. Community tools (signal-cli, signal-bot) are unofficial, fragile, and potentially violate Signal's ToS. Signal cannot be embedded or integrated into our platform.

### Why Not Just Switch to Another External Tool?
Self-hosted alternatives (Rocket.Chat, Matrix/Element) are full-featured and cheap, but create the same "two apps" problem — members switch between the RLC website and a separate chat tool. This contradicts the consolidation goal and doesn't integrate with our org hierarchy.

---

## Constraints & Decisions

| Decision | Answer |
|----------|--------|
| Messaging features needed | Full: groups, DMs, file/photo sharing, voice/video calls |
| Board features needed | Channels + threads + Robert's Rules voting (motions, seconds, quorum) |
| Mobile strategy | PWA first, native app later |
| Encryption | Standard security (HTTPS + encrypted DB) — no E2E requirement |
| Expected users (6 months) | 100–500 |
| App scope | Full membership app (events, scorecards, donations, news) — messaging is one module |
| Voice/video | Deferred to Phase 3 — coordinators keep Signal for calls temporarily |
| Voice/video SDK | LiveKit (open-source WebRTC), hosted on Cloudflare (Railway fallback) |
| Voting model | Robert's Rules of Order (motions, seconds, quorum, roll call) |
| Guest access | Limited — certain channels (state organizing) open to prospective members |
| Message retention | Default to forever, with future option to archive (TBD) |
| Current stack | Next.js 15, Supabase, Clerk, Prisma, shadcn/ui, Tailwind |

---

## Functional Requirements

### FR-1: Channel-Based Messaging
- Public and private channels (e.g., #national-board, #tx-chapter, #state-coordinators)
- Channel creation restricted by role (admins, board members, state chairs)
- Channel membership tied to RLC organizational hierarchy (national, state, chapter)
- Threaded replies within channels
- Pin messages, react with emoji

### FR-2: Direct Messaging
- 1-on-1 DMs between any members
- Group DMs (small ad-hoc groups, not formal channels)
- Member directory / search to start conversations

### FR-3: File & Media Sharing
- Image, document, and video uploads in channels and DMs
- File size limits (TBD — 25MB reasonable for photos/docs)
- Image thumbnails and previews inline
- Storage via Supabase Storage or S3

### FR-4: Voice & Video Calls (Phase 3)
- 1-on-1 voice/video calls
- Group calls (at minimum for Board meetings — up to ~20 participants)
- Screen sharing for presentations
- **SDK**: LiveKit (open-source WebRTC)
- **Hosting**: Cloudflare Workers / Durable Objects for signaling, with TURN relay via Cloudflare network. Railway as fallback if LiveKit's long-running processes don't fit Cloudflare's compute model.

### FR-5: Voting & Polls (Robert's Rules)
- **Motion workflow**: Member makes a motion → another member seconds → discussion period → vote called → results recorded
- Motion states: proposed, seconded, under_discussion, voting, passed, failed, tabled, withdrawn
- Vote types: yea/nay/abstain (standard), roll call (named votes)
- Quorum tracking (configurable per channel/body)
- Vote deadlines with reminders for async voting between meetings
- Results visible to authorized roles with full audit trail
- Motion history searchable for governance records
- Simple polls also available for informal temperature checks

### FR-6: Notifications
- In-app notification center
- Push notifications (PWA web push, later native push via FCM/APNS)
- @mentions in channels trigger notifications
- Configurable notification preferences per channel (all, mentions only, mute)
- Email digest option for offline members

### FR-7: Presence & Read Receipts
- Online/offline/away status indicators
- Typing indicators in active conversations
- Read receipts (optional per user)
- "Last seen" timestamp

### FR-8: Search
- Full-text search across messages, channels, and files
- Filter by channel, sender, date range
- Supabase full-text search (tsvector) or pg_trgm for fuzzy matching

### FR-9: Moderation & Admin
- Message deletion by admins
- User muting/banning from channels
- Content reporting mechanism
- Audit log for admin actions

### FR-10: Organizational Structure Integration
- Channels auto-mapped to chapters (each chapter gets a default channel)
- State-level channels for coordinators
- National-level channels for board
- Role-based channel access (chapter_admin sees their chapter, state_chair sees all chapters in state, etc.)
- Leverage existing `rlc_member_roles` table for permissions

### FR-11: Guest Access
- Prospective members can be invited to specific channels (e.g., state organizing groups)
- Guest accounts with limited permissions (can message in invited channels, cannot create channels or DMs)
- Conversion path from guest to full member
- Guest access as a recruiting tool for chapter building

---

## Non-Functional Requirements

### NFR-1: Performance
- Message delivery < 500ms (real-time feel)
- Support 100 concurrent users initially, scalable to 2,000+
- Message history loads in < 1 second (paginated)

### NFR-2: Security
- HTTPS everywhere
- Database encryption at rest (Supabase default)
- File uploads scanned/validated (type + size)
- Authentication via existing Clerk integration
- RLS policies on all messaging tables

### NFR-3: Mobile Experience
- PWA with service worker for offline message queue
- Web push notifications (supported in modern browsers)
- Touch-optimized UI (already using shadcn/ui + Tailwind mobile-first)
- Future: React Native app sharing API layer

### NFR-4: Reliability
- Message persistence (no message loss)
- Offline message queuing (send when back online)
- Graceful degradation if real-time connection drops

---

## User Stories

### State Coordinators (replacing Signal)
- "As a State Coordinator, I want to create a group for prospective chapter leaders in my state so I can organize them without using a separate app"
- "As a State Coordinator, I want to share documents and photos with my organizing groups so recruits have materials"
- "As a State Coordinator, I want to invite prospective members into organizing channels so they can participate before formally joining"
- "As a State Coordinator, I want to make voice/video calls to chapter leaders directly from the platform" *(Phase 3)*

### National Board (replacing Slack)
- "As a Board Member, I want topic-based channels (#finance, #policy, #events) with threaded discussions so conversations stay organized"
- "As a Board Member, I want to create formal votes with deadlines so we can make decisions between meetings with an audit trail"
- "As a Board Member, I want to @mention specific members to get their attention on urgent items"

### General Members
- "As a Member, I want to message other members in my chapter without sharing my phone number"
- "As a Member, I want to receive push notifications on my phone when someone messages me"
- "As a Member, I want to search past messages to find information shared previously"

### Prospective Members (Guests)
- "As a prospective member, I want to join my state's organizing channel to see what RLC is about before committing to membership"

---

## Build vs Buy Analysis

### Option A: Hosted Chat SDK (CometChat, Stream, Sendbird)

| Pros | Cons |
|------|------|
| Launch in 1–3 weeks | $200–500/month at 100–500 users (more than Slack) |
| Professional mobile SDKs | Limited voting/polling customization |
| Voice/video included | Vendor lock-in |
| Battle-tested at scale | Doesn't feel native to the platform |
| | Per-user pricing compounds at scale |

**Verdict:** Saves time but costs MORE than Slack, still needs custom work for voting/org-structure. Doesn't align with the "full membership app" vision.

### Option B: Self-Hosted Open Source (Rocket.Chat, Matrix/Element)

| Pros | Cons |
|------|------|
| Full-featured out of the box | Separate system — not embedded |
| Low ongoing cost ($50–100/mo) | Separate auth to sync (SSO complexity) |
| E2E encryption available | Users switch between two apps |
| Existing mobile apps | No native org hierarchy integration |
| | Can't customize voting without forking |

**Verdict:** Cheap and full-featured, but defeats the consolidation goal. Just replaces Slack with a different external tool.

### Option C: Custom Build on Supabase Realtime (Recommended)

| Pros | Cons |
|------|------|
| Fully integrated — one login, one UI | 3–5 months dev time for full feature set |
| Channels auto-mapped to org hierarchy | Voice/video needs third-party SDK |
| Custom voting built to Board needs | Must handle edge cases (offline, reconnect) |
| Leverages existing role system | No vendor support — you maintain it |
| No per-user fees ($25–100/mo) | |
| Same tech stack — no new learning | |
| PWA + future native app share API | |
| Becomes reusable IP | |

**Verdict:** Best long-term fit. Fully integrated, lowest cost at scale, and produces reusable IP for other membership organizations.

---

## Recommended Phased Approach

### Phase 1: Core Messaging (MVP) — ~4–6 weeks
- Channels (public/private, mapped to org hierarchy)
- Direct messages (1-on-1 and group)
- Threaded replies
- File/image uploads
- @mentions and notifications (in-app + web push)
- Basic search
- Guest access for prospective members
- Mobile-responsive PWA

**Outcome:** Replace Slack for the National Board. State Coordinators can start migrating groups.

### Phase 2: Governance Features (Robert's Rules) — ~2–3 weeks
- Robert's Rules motion workflow (motion → second → discussion → vote → results)
- Motion states, quorum tracking, roll call votes
- Vote audit trail for governance compliance
- Simple polls for informal temperature checks
- Pinned messages
- Message reactions
- Enhanced moderation tools

**Outcome:** Board can conduct formal business entirely within the platform using proper parliamentary procedure.

### Phase 3: Voice/Video (LiveKit) — ~3–4 weeks
- Integrate LiveKit (open-source WebRTC) hosted on Cloudflare (or Railway fallback)
- 1-on-1 and group calls (up to ~20 participants)
- Screen sharing
- Call history

**Outcome:** Full Signal replacement for State Coordinators.

### Phase 4: Native Mobile App — ~6–8 weeks
- React Native app (Expo)
- Native push notifications (FCM/APNS)
- Shares API layer with PWA
- Messaging + events + scorecards + donations
- App Store submission

**Outcome:** "RLC" app in the App Store — full membership experience.

---

## Cost Comparison

| Solution | Monthly Cost (500 users) | Integrated? | Custom Voting? |
|----------|------------------------|-------------|----------------|
| Current Slack | $100 | No | No |
| CometChat | $200–500 | Partially | No |
| Rocket.Chat (self-hosted) | $50–100 | No | No |
| **Custom on Supabase** | **$25–100** | **Yes** | **Yes** |

---

## Resolved Questions

1. **Voting formality**: Robert's Rules — formal motions (motion, second, discussion period, vote, results). Not just simple polls.
2. **Voice/video SDK**: LiveKit (open-source WebRTC). Self-hosted for cost control.
3. **LiveKit hosting**: Cloudflare Workers / Durable Objects for the signaling server, with TURN relay via Cloudflare's network. Cloudflare is already in the stack (connected CLI), has global edge presence for low-latency WebRTC, and avoids adding another hosting provider. Railway is an option if Cloudflare's compute model doesn't fit LiveKit's long-running process needs — will evaluate during Phase 3 design.

## Open Questions

1. **Message retention**: No policy decided yet. Default to forever with future option to archive.

---

## Next Steps

1. `/sc:design` — Architecture design (database schema, Supabase Realtime setup, API contracts)
2. `/sc:workflow` — Detailed implementation plan with task breakdown
3. Create GitHub issue to track this feature

---

*Generated from /sc:brainstorm session — 2026-02-08*
