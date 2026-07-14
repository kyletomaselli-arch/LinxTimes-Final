import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Lightweight fixed-window rate limiter.
 *
 * IMPORTANT — production note: this uses an in-process Map, which means each
 * serverless instance has its own counter. On a single Node server (e.g. the
 * Railway/Vercel-Node deployment target) it provides real protection. For
 * horizontally-scaled serverless, swap the store for Upstash Redis / Vercel KV
 * — the call sites below do not change, only `hit()` does. It is here now as
 * defense-in-depth against enumeration and scraping, not as the sole control.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Opportunistic cleanup so the Map can't grow unbounded.
function sweep(now: number) {
  if (buckets.size < 5000) return;
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

export function hit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: limit - 1, resetAt };
  }
  existing.count += 1;
  const ok = existing.count <= limit;
  return { ok, remaining: Math.max(0, limit - existing.count), resetAt: existing.resetAt };
}

/** Best-effort client IP from common proxy headers. */
export function clientIp(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ??
    "unknown"
  );
}

/**
 * Guard a route handler. Returns a 429 NextResponse when the limit is exceeded,
 * or null when the request may proceed.
 *
 *   const limited = rateLimit(request, "quote", 60, 60_000);
 *   if (limited) return limited;
 */
export function rateLimit(
  request: NextRequest,
  scope: string,
  limit: number,
  windowMs: number
): NextResponse | null {
  const key = `${scope}:${clientIp(request)}`;
  const result = hit(key, limit, windowMs);
  if (result.ok) return null;
  const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
  return NextResponse.json(
    { error: "Too many requests. Please slow down." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Remaining": "0",
      },
    }
  );
}
