import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Database } from "@/integrations/supabase/types";

type Claims = Record<string, unknown> & { sub?: string; exp?: number };

function base64urlDecode(part: string): string {
  return Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

/** Verifies an HS256 Supabase-compatible JWT locally (no auth-server round trip). */
function verifyJwt(token: string, secret: string): Claims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts as [string, string, string];
  const expected = createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const claims = JSON.parse(base64urlDecode(payload)) as Claims;
    if (typeof claims.exp === "number" && claims.exp * 1000 < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

/**
 * Auth middleware for the self-hosted Oracle backend: the bearer token is verified
 * locally with the project JWT secret, so server functions keep working even when
 * the hosted auth API is unavailable.
 */
export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const SUPABASE_URL = process.env['ORACLE_SUPABASE_URL'] || process.env['SUPABASE_URL'];
    const SUPABASE_PUBLISHABLE_KEY =
      process.env['ORACLE_SUPABASE_ANON_KEY'] || process.env['SUPABASE_PUBLISHABLE_KEY'];
    const JWT_SECRET = process.env['ORACLE_JWT_SECRET'];

    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      throw new Error("Backend is not configured (missing database URL or key).");
    }
    if (!JWT_SECRET) {
      throw new Error("Backend is not configured (missing token secret).");
    }

    const request = getRequest();
    const authHeader = request?.headers?.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("Unauthorized: No authorization header provided");
    }

    const token = authHeader.slice("Bearer ".length).trim();
    const claims = verifyJwt(token, JWT_SECRET);
    if (!claims?.sub) {
      throw new Error("Unauthorized: Invalid token");
    }

    const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY } },
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });

    return next({
      context: { supabase, userId: claims.sub as string, claims },
    });
  },
);
