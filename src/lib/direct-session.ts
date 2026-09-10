// Browser-side helpers for the direct admin session.
// The session is issued by the server (directAdminLogin) and stored in
// localStorage. Everything here is fully local — no network calls to any
// hosted auth service — so the dashboard keeps working even when the
// hosted cloud backend is paused or offline.

export type StoredUser = {
  id: string;
  email?: string;
  user_metadata?: { display_name?: string };
};

export type StoredSession = {
  access_token: string;
  expires_at?: number;
  user?: StoredUser;
};

function storageKey(): string | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!url) return null;
  try {
    const ref = new URL(url).hostname.split(".")[0];
    return `sb-${ref}-auth-token`;
  } catch {
    return null;
  }
}

export function getStoredSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  const key = storageKey();
  if (!key) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const session = JSON.parse(raw) as StoredSession;
    if (!session?.access_token) return null;
    // Locally enforce expiry (expires_at is seconds since epoch).
    if (typeof session.expires_at === "number" && session.expires_at * 1000 < Date.now()) {
      window.localStorage.removeItem(key);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function getStoredUser(): StoredUser | null {
  return getStoredSession()?.user ?? null;
}

export function clearStoredSession(): void {
  if (typeof window === "undefined") return;
  const key = storageKey();
  if (key) window.localStorage.removeItem(key);
}
