// Server-only helpers for admin tools (settings, audit log, log cleanup).
export const LOG_RETENTION_DAYS = 30;
const CLEANUP_EVERY_MS = 6 * 3600_000;

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const { data } = await (await db()).from("app_settings").select("value").eq("key", key).maybeSingle();
    return (data?.value as T) ?? fallback;
  } catch {
    return fallback;
  }
}

export async function setSetting(key: string, value: unknown) {
  const { error } = await (await db())
    .from("app_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export async function logAdminAction(adminId: string, action: string, detail: Record<string, unknown> = {}) {
  try {
    await (await db()).from("admin_audit_log").insert({ admin_id: adminId, action, detail });
  } catch {
    /* audit must never break the action itself */
  }
}

export type Maintenance = { enabled: boolean; message: string };
export const getMaintenance = () =>
  getSetting<Maintenance>("maintenance", { enabled: false, message: "" });

/** Runs log cleanup at most once every 6 hours. Cheap to call often. */
export async function maybeCleanupLogs() {
  try {
    const last = await getSetting<{ at?: string }>("log_cleanup", {});
    if (last.at && Date.now() - new Date(last.at).getTime() < CLEANUP_EVERY_MS) return;
    const client = await db();
    const { data } = await client.rpc("cleanup_old_logs", { _days: LOG_RETENTION_DAYS });
    await setSetting("log_cleanup", { at: new Date().toISOString(), deleted: data ?? 0 });
  } catch {
    /* table may not exist yet */
  }
}
