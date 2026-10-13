import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/lib/oracle-auth-middleware";

export type AdminOverview = {
  users: { total: number; signupsToday: number; signups7d: number; blocked: number };
  plans: { trial: number; paid: number; expired: number };
  rules: { total: number; enabled: number };
  today: { forwarded: number; skipped: number; error: number };
  worker: { online: boolean; lastHeartbeat: string | null; activeClients: number; version: string | null };
  recentErrors: { created_at: string; detail: string | null }[];
};

function startOfTodayIst(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + 330 * 60000);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - 330 * 60000).toISOString();
}

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminOverview> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Admin access required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const today = startOfTodayIst();
    const week = new Date(Date.now() - 7 * 86400000).toISOString();
    const nowIso = new Date().toISOString();

    const count = async (q: any) => {
      try {
        const { count: c } = await q;
        return c ?? 0;
      } catch {
        return 0;
      }
    };
    const head = (t: string) => db.from(t).select("*", { count: "exact", head: true });

    const [total, signupsToday, signups7d, blocked, rulesTotal, rulesOn, fwd, skp, err] =
      await Promise.all([
        count(head("profiles")),
        count(head("profiles").gte("created_at", today)),
        count(head("profiles").gte("created_at", week)),
        count(head("profiles").eq("is_blocked", true)),
        count(head("forwarding_rules")),
        count(head("forwarding_rules").eq("enabled", true)),
        count(head("forwarding_logs").eq("status", "forwarded").gte("created_at", today)),
        count(head("forwarding_logs").eq("status", "skipped").gte("created_at", today)),
        count(head("forwarding_logs").eq("status", "error").gte("created_at", today)),
      ]);

    let trial = 0, paid = 0, expired = 0;
    try {
      const { data: subs } = await db
        .from("subscriptions")
        .select("plan, trial_ends_at, subscription_ends_at, is_active");
      for (const s of subs ?? []) {
        const paidActive =
          (s.plan === "pro" || s.plan === "business") &&
          s.subscription_ends_at && s.subscription_ends_at > nowIso;
        const trialActive = s.plan === "trial" && s.trial_ends_at > nowIso;
        if (s.is_active && paidActive) paid++;
        else if (s.is_active && trialActive) trial++;
        else expired++;
      }
    } catch {}

    let worker: AdminOverview["worker"] = { online: false, lastHeartbeat: null, activeClients: 0, version: null };
    try {
      const { data: w } = await db.from("worker_health").select("*").eq("id", 1).maybeSingle();
      if (w) {
        const age = w.last_heartbeat ? (Date.now() - new Date(w.last_heartbeat).getTime()) / 1000 : 1e9;
        worker = { online: age < 120, lastHeartbeat: w.last_heartbeat, activeClients: w.active_clients ?? 0, version: w.version };
      }
    } catch {}

    let recentErrors: AdminOverview["recentErrors"] = [];
    try {
      const { data } = await db
        .from("forwarding_logs")
        .select("created_at, detail")
        .eq("status", "error")
        .order("created_at", { ascending: false })
        .limit(5);
      recentErrors = data ?? [];
    } catch {}

    return {
      users: { total, signupsToday, signups7d, blocked },
      plans: { trial, paid, expired },
      rules: { total: rulesTotal, enabled: rulesOn },
      today: { forwarded: fwd, skipped: skp, error: err },
      worker,
      recentErrors,
    };
  });
