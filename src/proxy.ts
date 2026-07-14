import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * LinxTimes Proxy (formerly "middleware" — renamed in Next.js 16).
 *
 * Tenant resolution is path-based: the public booking page lives at
 * /[course-slug]. We keep this layer lightweight per the Next.js guidance —
 * the actual course lookup + status enforcement happens in src/lib/tenant.ts,
 * which runs inside server components and route handlers where DB access is
 * appropriate.
 *
 * Here we only:
 *  - expose the request pathname to downstream server components via a header
 *    (so a shared layout can know which tenant slug is being rendered), and
 *  - expose the resolved first path segment as a convenience header.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  // First non-empty path segment — candidate course slug for the public page.
  const firstSegment = pathname.split("/").filter(Boolean)[0] ?? "";
  requestHeaders.set("x-path-segment", firstSegment);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  // Run on everything except static assets and Next internals.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)",
  ],
};
