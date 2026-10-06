import { createHmac, timingSafeEqual } from "node:crypto";

export const DIRECT_ADMIN_USER_ID = "11111111-1111-4111-8111-111111111111";

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function signSupabaseJwt(
  payload: Record<string, unknown>,
  secret: string,
): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const signature = base64url(createHmac("sha256", secret).update(data).digest());
  return `${data}.${signature}`;
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Verifies an HS256 token locally and returns its claims, or null when invalid. */
export function verifySupabaseJwt(
  token: string,
  secret: string,
): (Record<string, unknown> & { sub?: string; exp?: number }) | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts as [string, string, string];
  const expected = base64url(createHmac("sha256", secret).update(`${header}.${payload}`).digest());
  if (!safeEqual(signature, expected)) return null;
  try {
    const claims = JSON.parse(
      Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
    ) as { sub?: string; exp?: number };
    if (typeof claims.exp === "number" && claims.exp * 1000 < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}


export type SessionIdentity = { userId: string; email?: string; phone?: string; name?: string };

/** Short-lived signed ticket. Uses `uid` (never `sub`) so it can't be used as an access token. */
export function signTicket(payload: Record<string, unknown>, secret: string, ttlSec: number) {
  const iat = Math.floor(Date.now() / 1000);
  return signSupabaseJwt({ ...payload, iat, exp: iat + ttlSec }, secret);
}

export function buildRefreshToken(id: SessionIdentity, secret: string) {
  return signTicket(
    { typ: "ff_refresh", uid: id.userId, email: id.email ?? "", phone: id.phone ?? "", name: id.name ?? "" },
    secret,
    60 * 60 * 24 * 30,
  );
}

export function identityFromRefreshToken(token: string, secret: string): SessionIdentity | null {
  const c = verifySupabaseJwt(token, secret) as Record<string, unknown> | null;
  if (!c || c.typ !== "ff_refresh" || typeof c.uid !== "string") return null;
  return {
    userId: c.uid,
    email: (c.email as string) || undefined,
    phone: (c.phone as string) || undefined,
    name: (c.name as string) || undefined,
  };
}

export function buildAdminSession(email: string, secret: string) {
  return buildUserSession({ userId: DIRECT_ADMIN_USER_ID, email, name: "Admin" }, secret);
}

export function buildUserSession(id: SessionIdentity, secret: string) {
  const email = id.email ?? "";
  const phone = id.phone ?? "";
  const displayName = id.name ?? (phone || email);
  const provider = id.userId === DIRECT_ADMIN_USER_ID ? "direct" : "phone";
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + 60 * 60 * 24 * 7;
  const accessToken = signSupabaseJwt(
    {
      aud: "authenticated",
      role: "authenticated",
      sub: id.userId,
      email,
      phone,
      iat: issuedAt,
      exp: expiresAt,
      app_metadata: { provider, providers: [provider] },
      user_metadata: { display_name: displayName },
      session_id: id.userId,
    },
    secret,
  );

  return {
    access_token: accessToken,
    refresh_token: buildRefreshToken(id, secret),
    token_type: "bearer",
    expires_in: expiresAt - issuedAt,
    expires_at: expiresAt,
    user: {
      id: id.userId,
      aud: "authenticated",
      role: "authenticated",
      email,
      email_confirmed_at: new Date(issuedAt * 1000).toISOString(),
      phone,
      confirmed_at: new Date(issuedAt * 1000).toISOString(),
      last_sign_in_at: new Date(issuedAt * 1000).toISOString(),
      app_metadata: { provider, providers: [provider] },
      user_metadata: { display_name: displayName },
      identities: [],
      created_at: new Date(issuedAt * 1000).toISOString(),
      updated_at: new Date(issuedAt * 1000).toISOString(),
      is_anonymous: false,
    },
  };
}
