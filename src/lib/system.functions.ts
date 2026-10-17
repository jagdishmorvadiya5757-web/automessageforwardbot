import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/oracle-auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Admin access required");
}
async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export type Announcement = { id: string; title: string; body: string; tone: string; active: boolean; created_at: string };

// Shown to every signed-in user: active announcements + maintenance notice.
export const getSystemNotices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { getMaintenance } = await import("./system.server");
    const maintenance = await getMaintenance();
    let announcements: Announcement[] = [];
    try {
      const { data } = await (await admin())
        .from("announcements").select("*").eq("active", true)
        .order("created_at", { ascending: false }).limit(3);
      announcements = data ?? [];
    } catch {}
    return { maintenance, announcements };
  });

export const getAdminTools = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { getMaintenance, getSetting, LOG_RETENTION_DAYS } = await import("./system.server");
    const db = await admin();
    const [m, cleanup, ann, audit] = await Promise.all([
      getMaintenance(),
      getSetting<{ at?: string; deleted?: number }>("log_cleanup", {}),
      db.from("announcements").select("*").order("created_at", { ascending: false }).limit(20),
      db.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    return {
      maintenance: m,
      cleanup: { ...cleanup, retentionDays: LOG_RETENTION_DAYS },
      announcements: (ann.data ?? []) as Announcement[],
      audit: (audit.data ?? []) as { id: number; action: string; detail: Record<string, string | number | boolean | null>; created_at: string }[],
      setupNeeded: !!(ann.error || audit.error),
    };
  });

export const setMaintenance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ enabled: z.boolean(), message: z.string().max(300) }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { setSetting, logAdminAction } = await import("./system.server");
    await setSetting("maintenance", data);
    await logAdminAction(context.userId, data.enabled ? "maintenance_on" : "maintenance_off", { message: data.message });
    return { ok: true };
  });

export const createAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      title: z.string().trim().min(1).max(120),
      body: z.string().trim().max(1000),
      tone: z.enum(["info", "success", "warning"]),
    }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { error } = await (await admin()).from("announcements").insert({ ...data, created_by: context.userId });
    if (error) throw new Error(error.message);
    const { logAdminAction } = await import("./system.server");
    await logAdminAction(context.userId, "broadcast_sent", { title: data.title });
    return { ok: true };
  });

export const setAnnouncementActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { error } = await (await admin()).from("announcements").update({ active: data.active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    const { logAdminAction } = await import("./system.server");
    await logAdminAction(context.userId, data.active ? "broadcast_shown" : "broadcast_hidden", { id: data.id });
    return { ok: true };
  });

export const runLogCleanupNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { setSetting, logAdminAction, LOG_RETENTION_DAYS } = await import("./system.server");
    const { data, error } = await (await admin()).rpc("cleanup_old_logs", { _days: LOG_RETENTION_DAYS });
    if (error) throw new Error(error.message);
    await setSetting("log_cleanup", { at: new Date().toISOString(), deleted: data ?? 0 });
    await logAdminAction(context.userId, "logs_cleaned", { deleted: data ?? 0 });
    return { deleted: (data as number) ?? 0 };
  });
