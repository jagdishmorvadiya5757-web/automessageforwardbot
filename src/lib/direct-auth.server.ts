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

export function buildAdminSession(email: string, secret: string) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + 60 * 60 * 24 * 7;
  const accessToken = signSupabaseJwt(
    {
      aud: "authenticated",
      role: "authenticated",
      sub: DIRECT_ADMIN_USER_ID,
      email,
      iat: issuedAt,
      exp: expiresAt,
      app_metadata: { provider: "direct", providers: ["direct"] },
      user_metadata: { display_name: "Admin" },
      session_id: DIRECT_ADMIN_USER_ID,
    },
    secret,
  );

  return {
    access_token: accessToken,
    refresh_token: `direct-${issuedAt}`,
    token_type: "bearer",
    expires_in: expiresAt - issuedAt,
    expires_at: expiresAt,
    user: {
      id: DIRECT_ADMIN_USER_ID,
      aud: "authenticated",
      role: "authenticated",
      email,
      email_confirmed_at: new Date(issuedAt * 1000).toISOString(),
      phone: "",
      confirmed_at: new Date(issuedAt * 1000).toISOString(),
      last_sign_in_at: new Date(issuedAt * 1000).toISOString(),
      app_metadata: { provider: "direct", providers: ["direct"] },
      user_metadata: { display_name: "Admin" },
      identities: [],
      created_at: new Date(issuedAt * 1000).toISOString(),
      updated_at: new Date(issuedAt * 1000).toISOString(),
      is_anonymous: false,
    },
  };
}
