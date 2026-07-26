// Server-only helpers for authenticating the external worker.
//
// Two auth modes supported:
//  1) MASTER token (multi-user): bearer == WORKER_MASTER_TOKEN, plus an
//     X-User-Id header identifying which user this call is acting for. This
//     is the new multi-user model where one worker serves ALL users.
//  2) Per-user token (legacy): bearer resolves against worker_tokens table
//     (kept for backward compatibility while the old single-user worker exists).
import { createHash, timingSafeEqual } from "crypto";

export type WorkerAuth = { userId: string; isMaster: boolean };

function safeEqual(a: string, b: string): boolean {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}

export async function resolveWorkerUser(
  request: Request,
  opts?: { requireUserId?: boolean },
): Promise<WorkerAuth | null> {
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;

  // MASTER token path
  const master = process.env.WORKER_MASTER_TOKEN;
  if (master && safeEqual(token, master)) {
    const userIdHeader = request.headers.get("x-user-id")?.trim();
    if (userIdHeader) return { userId: userIdHeader, isMaster: true };
    // No user context — only useful for endpoints that don't need one
    if (opts?.requireUserId === false) return { userId: "", isMaster: true };
    return null;
  }

  // Legacy per-user token path
  const pepper = process.env.WORKER_TOKEN_PEPPER;
  if (!pepper) return null;
  const tokenHash = createHash("sha256").update(pepper + token).digest("hex");

  const { supabaseAdmin } = await import("./client.server");
  const { data } = await supabaseAdmin
    .from("worker_tokens")
    .select("user_id")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  return data ? { userId: data.user_id, isMaster: false } : null;
}

/** Master-only auth (no user scoping). Used by /users listing endpoint. */
export async function requireMasterToken(request: Request): Promise<boolean> {
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return false;
  const token = auth.slice(7).trim();
  const master = process.env.WORKER_MASTER_TOKEN;
  return !!master && safeEqual(token, master);
}
