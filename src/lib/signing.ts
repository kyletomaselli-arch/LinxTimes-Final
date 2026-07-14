import "server-only";
import crypto from "crypto";
import { serverEnv } from "./env";

/**
 * Compact HMAC-signed tokens: base64url(payloadJSON).base64url(sig).
 * Used for tamper-proof, short-lived values like the Stripe OAuth `state`
 * (CSRF protection) where we don't need a full session.
 */

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64url(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export function signToken(payload: Record<string, unknown>, ttlSeconds = 900): string {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const data = b64url(JSON.stringify(body));
  const sig = crypto
    .createHmac("sha256", serverEnv.JWT_SECRET)
    .update(data)
    .digest();
  return `${data}.${b64url(sig)}`;
}

export function verifyToken<T = Record<string, unknown>>(token: string): T | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expected = crypto
    .createHmac("sha256", serverEnv.JWT_SECRET)
    .update(data)
    .digest();
  const given = fromB64url(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
    return null;
  }
  try {
    const body = JSON.parse(fromB64url(data).toString("utf8")) as T & { exp?: number };
    if (body.exp && body.exp < Math.floor(Date.now() / 1000)) return null;
    return body;
  } catch {
    return null;
  }
}
