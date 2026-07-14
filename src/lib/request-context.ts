import { headers } from "next/headers";

/**
 * Read the current request pathname (set by proxy.ts) inside a server
 * component or route handler.
 */
export async function getPathname(): Promise<string> {
  const h = await headers();
  return h.get("x-pathname") ?? "";
}

/**
 * Read the first path segment (candidate course slug) set by proxy.ts.
 */
export async function getPathSegment(): Promise<string> {
  const h = await headers();
  return h.get("x-path-segment") ?? "";
}
