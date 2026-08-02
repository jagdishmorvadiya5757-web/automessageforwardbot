import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminStats = {
  users: number;
  activeSubs: number;
  trials: number;
  connectedTelegram: number;
  rules: number;
  activeRules: number;
  forwardedTotal: number;
  forwardedToday: number;
  errorsToday: number;
  creditsInCirculation: number;
  referrals: number;
};

export type WorkerDiagnostics = {
  lastHeartbeat: string | null;
  online: boolean;
  version: string | null;
  activeClients: number;
  queuedMessages: number;
  startedAt: string | null;
  detail: string | null;
};

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Forbidden");
}

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminStats> => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nowIso = new Date().toISOString();
    const dayAgo = new Date(Date.now() - 86400_000).toISOString();

    const [subs, sessions, rules, logsToday, wallets, referrals] = await Promise.all([
      supabaseAdmin.from("subscriptions").select("plan, trial_ends_at, subscription_ends_at, is_active"),
      supabaseAdmin.from("telegram_sessions").select("status"),
      supabaseAdmin.from("forwarding_rules").select("enabled, forwarded_count"),
      supabaseAdmin.from("forwarding_logs").select("status").gte("created_at", dayAgo).limit(5000),
      supabaseAdmin.from("wallets").select("balance"),
      supabaseAdmin.from("referrals").select("id"),
    ]);

    const subRows = subs.data ?? [];
    const activeSubs = subRows.filter((s) => {
      if (!s.is_active) return false;
      if (s.plan === "trial") return !!s.trial_ends_at && s.trial_ends_at > nowIso;
      if (s.plan === "pro" || s.plan === "business")
        return !s.subscription_ends_at || s.subscription_ends_at > nowIso;
      return false;
    }).length;

    const ruleRows = rules.data ?? [];
    const logRows = logsToday.data ?? [];

    return {
      users: subRows.length,
      activeSubs,
      trials: subRows.filter((s) => s.plan === "trial").length,
      connectedTelegram: (sessions.data ?? []).filter((s) => s.status === "logged_in").length,
      rules: ruleRows.length,
      activeRules: ruleRows.filter((r) => r.enabled).length,
      forwardedTotal: ruleRows.reduce((n, r) => n + (r.forwarded_count ?? 0), 0),
      forwardedToday: logRows.filter((l) => l.status === "forwarded").length,
      errorsToday: logRows.filter((l) => l.status === "error").length,
      creditsInCirculation: (wallets.data ?? []).reduce((n, w) => n + (w.balance ?? 0), 0),
      referrals: (referrals.data ?? []).length,
    };
  });

export const getWorkerDiagnostics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WorkerDiagnostics> => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("worker_health")
      .select("last_heartbeat, version, active_clients, queued_messages, started_at, detail")
      .eq("id", 1)
      .maybeSingle();

    return {
      lastHeartbeat: data?.last_heartbeat ?? null,
      online:
        !!data?.last_heartbeat && Date.now() - new Date(data.last_heartbeat).getTime() < 120_000,
      version: data?.version ?? null,
      activeClients: data?.active_clients ?? 0,
      queuedMessages: data?.queued_messages ?? 0,
      startedAt: data?.started_at ?? null,
      detail: data?.detail ?? null,
    };
  });
