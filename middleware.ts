import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/about(.*)',
  '/chapters(.*)',
  '/events(.*)',
  '/join(.*)',
  '/donate(.*)',
  '/blog(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/unauthorized(.*)',
  '/api/webhooks/(.*)',
  '/api/v1/chapters(.*)',
  '/api/v1/events(.*)',
  '/api/v1/posts(.*)',
  '/scorecards(.*)',
  '/action-center(.*)',
  '/candidate-surveys(.*)',
]);

// Define admin routes that require specific roles
const isAdminRoute = createRouteMatcher(['/admin(.*)']);

// Admin roles that grant access to /admin routes
const ADMIN_ROLES = ['super_admin', 'national_board', 'state_chair', 'chapter_admin'];

export default clerkMiddleware(async (auth, req) => {
  // Allow public routes
  if (isPublicRoute(req)) {
    return;
  }

  const { userId, sessionClaims } = await auth();

  // Redirect unauthenticated users to sign-in
  if (!userId) {
    const signInUrl = new URL('/sign-in', req.url);
    signInUrl.searchParams.set('redirect_url', req.url);
    return NextResponse.redirect(signInUrl);
  }

  // For admin routes, check role
  if (isAdminRoute(req)) {
    const publicMetadata = sessionClaims?.publicMetadata as { role?: string } | undefined;
    const role = publicMetadata?.role;

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
