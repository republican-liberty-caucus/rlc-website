import { clerkClient, clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/about(.*)',
  '/charters(.*)',
  '/events(.*)',
  '/join(.*)',
  '/contact(.*)',
  '/donate(.*)',
  '/blog(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/unauthorized(.*)',
  '/api/webhooks/(.*)',
  '/api/v1/charters(.*)',
  '/api/v1/events(.*)',
  '/api/v1/posts(.*)',
  '/api/v1/civic(.*)',
  '/api/v1/checkout(.*)',
  '/api/v1/donate(.*)',
  '/scorecards(.*)',
  '/action-center(.*)',
  '/endorsements(.*)',
  '/candidate-surveys(.*)',
  '/data(.*)',
  '/privacy(.*)',
  '/terms(.*)',
  '/press-releases(.*)',
  '/s/(.*)',
  '/api/og/(.*)',
]);

// Define admin routes that require specific roles
const isAdminRoute = createRouteMatcher(['/admin(.*)']);

// Admin roles that grant access to /admin routes
const ADMIN_ROLES = ['super_admin', 'national_board', 'regional_coordinator', 'state_chair', 'charter_admin'];

// Known top-level route prefixes — skip WP slug lookup for these
const KNOWN_PREFIXES = new Set([
  'about', 'admin', 'api', 'action-center', 'blog', 'candidate-surveys', 'press-releases', 's',
  'charters', 'contact', 'dashboard', 'data', 'donate', 'endorsements',
  'events', 'join', 'privacy', 'scorecards', 'sign-in', 'sign-up',
  'terms', 'unauthorized', '_next',
]);

/**
 * Check if a root-level slug matches a published WordPress post and redirect
 * to /blog/[slug]. Uses Supabase REST API directly for edge compatibility.
 */
async function wpSlugRedirect(pathname: string, baseUrl: string): Promise<NextResponse | null> {
  // Only handle single-segment root paths that look like slugs
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length !== 1) return null;

  const slug = segments[0];

  // Skip known route prefixes and paths with dots (static files)
  if (KNOWN_PREFIXES.has(slug) || slug.includes('.')) return null;

  // Skip if it doesn't look like a WP slug (lowercase alphanumeric + hyphens)
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) && !/^[a-z0-9]{1,2}$/.test(slug)) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !supabaseAnonKey) return null;

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/rlc_posts?slug=eq.${encodeURIComponent(slug)}&content_type=eq.post&status=eq.published&select=slug&limit=1`,
      {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
      }
    );

    if (!res.ok) return null;

    const rows = await res.json();
    if (Array.isArray(rows) && rows.length > 0) {
      return NextResponse.redirect(new URL(`/blog/${slug}`, baseUrl), 301);
    }
  } catch {
    // Don't block the request if the lookup fails
  }

  return null;
}

export default clerkMiddleware(async (auth, req) => {
  // Allow public routes
  if (isPublicRoute(req)) {
    return;
  }

  // WordPress backward-compatibility: redirect /[slug] → /blog/[slug] for published posts
  const redirect = await wpSlugRedirect(req.nextUrl.pathname, req.url);
  if (redirect) return redirect;

  const { userId, sessionClaims } = await auth();

  // Redirect unauthenticated users to sign-in
  if (!userId) {
    const signInUrl = new URL('/sign-in', req.url);
    signInUrl.searchParams.set('redirect_url', req.url);
    return NextResponse.redirect(signInUrl);
  }

  // For admin routes, check role
  if (isAdminRoute(req)) {
    // Try JWT claims first (fast path — requires session token template config in Clerk Dashboard).
    // Fall back to fetching the user directly from Clerk API if claims are missing.
    let role = (sessionClaims?.publicMetadata as { role?: string } | undefined)?.role;

    if (!role) {
      try {
        const clerk = await clerkClient();
        const user = await clerk.users.getUser(userId);
        role = (user.publicMetadata as { role?: string })?.role;
      } catch (error) {
        console.error('[middleware] Clerk API role lookup failed:', {
          userId,
          error: error instanceof Error ? error.message : error,
        });
        return NextResponse.redirect(new URL('/unauthorized', req.url));
      }
    }

    if (!role || !ADMIN_ROLES.includes(role)) {
      return NextResponse.redirect(new URL('/unauthorized', req.url));
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
