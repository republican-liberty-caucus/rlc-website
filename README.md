# RLC Website

Modern website for the Republican Liberty Caucus built with Next.js 14, Supabase, Clerk, and HighLevel.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS + Radix UI
- **Auth**: Clerk
- **Database**: Supabase (PostgreSQL) via Prisma
- **CRM**: HighLevel V2 API
- **Payments**: Stripe
- **Email**: Resend
- **Hosting**: Vercel

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 8+
- Supabase account
- Clerk account
- HighLevel account
- Stripe account

### Installation

```bash
# Clone the repository
git clone https://github.com/[org]/rlc-website.git
cd rlc-website

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local

# Set up database
pnpm prisma:generate
pnpm prisma:push

# Start development server
pnpm dev
```

### Environment Variables

See `.env.example` for required environment variables:

- `NEXT_PUBLIC_CLERK_*` - Clerk authentication
- `NEXT_PUBLIC_SUPABASE_*` - Supabase connection
- `HIGHLEVEL_*` - HighLevel CRM integration
- `STRIPE_*` - Payment processing
- `RESEND_*` - Transactional email

## Project Structure

```
rlc-website/
├── app/
│   ├── (public)/          # Public pages (home, about, chapters, etc.)
│   ├── (auth)/            # Authentication pages (sign-in, sign-up)
│   ├── (member)/          # Member portal (dashboard, profile, etc.)
│   ├── (admin)/           # Admin dashboard
│   └── api/               # API routes and webhooks
├── components/
│   ├── ui/                # Radix UI components
│   ├── navigation/        # Nav components
│   ├── layout/            # Layout components
│   └── forms/             # Form components
├── lib/
│   ├── supabase/          # Supabase clients
│   ├── highlevel/         # HighLevel API client
│   ├── hooks/             # React hooks
│   └── utils.ts           # Utility functions
├── prisma/
│   └── schema.prisma      # Database schema
├── scripts/
│   └── civicrm/           # Migration scripts
└── types/                 # TypeScript types
```

## Database Schema

The database includes the following main tables:

- `rlc_members` - Member profiles and membership info
- `rlc_chapters` - State/regional chapters
- `rlc_member_roles` - Role-based access control
- `rlc_contributions` - Donations and payments
- `rlc_events` - Events and meetings
- `rlc_event_registrations` - Event attendance
- `rlc_posts` - Blog/news content
- `rlc_highlevel_sync_log` - HighLevel sync tracking
- `rlc_civicrm_migration_log` - Migration tracking

## Development

```bash
# Run development server
pnpm dev

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Format code
pnpm format

# Run tests
pnpm test
```

## Deployment

The site is deployed to Vercel. Push to `main` triggers automatic deployment.

```bash
# Build for production
pnpm build

# Preview production build
pnpm start
```

## CiviCRM Migration

See `scripts/civicrm/README.md` for migration instructions.

```bash
# Dry run migration
pnpm migrate:civicrm --dry-run

# Run migration
pnpm migrate:civicrm

# Sync to HighLevel
pnpm sync:highlevel
```

## Webhooks

Configure the following webhooks in your services:

### Clerk
- URL: `https://rlc.org/api/webhooks/clerk`
- Events: `user.created`, `user.updated`, `user.deleted`

### Stripe
- URL: `https://rlc.org/api/webhooks/stripe`
- Events: `checkout.session.completed`, `customer.subscription.*`, `invoice.*`

### HighLevel
- URL: `https://rlc.org/api/webhooks/highlevel`
- Events: `contact.created`, `contact.updated`, `opportunity.created`

## License

Proprietary - Republican Liberty Caucus
