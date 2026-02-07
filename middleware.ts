import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

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

  // Protect all other routes - require authentication
  const session = await auth();
  const { userId, sessionClaims } = session;

  if (!userId) {
    const signInUrl = new URL('/sign-in', req.url);
    signInUrl.searchParams.set('redirect_url', req.url);
    return Response.redirect(signInUrl);
  }

  // For admin routes, check user role
  if (isAdminRoute(req)) {
    // Check for admin role in Clerk's public metadata
    // This should be set when granting admin privileges via Clerk Dashboard or API
    // Only use publicMetadata which is the secure, server-controlled path
    const publicMetadata = sessionClaims?.publicMetadata as { role?: string } | undefined;
    const role = publicMetadata?.role;

    if (!role || !ADMIN_ROLES.includes(role)) {
      // User is not an admin - redirect to unauthorized page
      const unauthorizedUrl = new URL('/unauthorized', req.url);
      unauthorizedUrl.searchParams.set('from', req.url);
      return Response.redirect(unauthorizedUrl);
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
