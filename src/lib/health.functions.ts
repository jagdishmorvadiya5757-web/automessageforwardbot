import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/lib/oracle-auth-middleware";

export type HealthLog = {
  id: string;
  rule_id: string | null;
  rule_name: string | null;
  source_msg_ref: string | null;
  status: string;
  detail: string | null;
  created_at: string;
};

export type HealthReport = {
  generatedAt: string;
  isAdmin: boolean;
  database: { ok: boolean; error: string | null; latencyMs: number };
  worker: {
    online: boolean;
    lastHeartbeat: string | null;
    secondsSinceHeartbeat: number | null;
    version: string | null;
    activeClients: number;
    queuedMessages: number;
    startedAt: string | null;
    detail: string | null;
  };
  telegram: { status: string; phone: string | null; updatedAt: string | null };
  rules: {
    total: number;
    enabled: number;
    withLimitReached: number;
    backfillRunning: number;
    forwardedTotal: number;
  };
  activity24h: { forwarded: number; skipped: number; error: number; waiting: number };
  lastForwardAt: string | null;
  lastErrorAt: string | null;
  topSkipReasons: { reason: string; count: number }[];
  logs: HealthLog[];
};

export const getHealthReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HealthReport> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    let isAdmin = false;
    try {
      const { data } = await context.supabase.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });
      isAdmin = !!data;
    } catch {
      isAdmin = false;
    }

    const started = Date.now();
    let dbOk = true;
    let dbError: string | null = null;

    const dayAgo = new Date(Date.now() - 86_400_000).toISOString();

    const [healthRes, sessionRes, rulesRes, logsRes, recentRes] = await Promise.all([
      supabaseAdmin
        .from("worker_health")
        .select("last_heartbeat, version, active_clients, queued_messages, started_at, detail")
        .eq("id", 1)
        .maybeSingle(),
      supabaseAdmin
        .from("telegram_sessions")
        .select("status, phone, updated_at")
        .eq("user_id", userId)
        .maybeSingle(),
      (supabaseAdmin.from("forwarding_rules") as any)
        .select("id, name, enabled, forwarded_count, max_forward_count")
        .eq("user_id", userId),
      supabaseAdmin
        .from("forwarding_logs")
        .select("status, detail, created_at")
        .eq("user_id", userId)
        .gte("created_at", dayAgo)
        .order("created_at", { ascending: false })
        .limit(5000),
      supabaseAdmin
        .from("forwarding_logs")
        .select("id, rule_id, source_msg_ref, status, detail, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    const latencyMs = Date.now() - started;
    for (const r of [healthRes, sessionRes, rulesRes, logsRes, recentRes] as any[]) {
      if (r?.error) {
        dbOk = false;
        dbError = dbError ?? r.error.message;
      }
    }

    // Backfill columns may not exist on older databases — query separately.
    let backfillRunning = 0;
    try {
      const { data } = await (supabaseAdmin.from("forwarding_rules") as any)
        .select("backfill_status")
        .eq("user_id", userId);
      backfillRunning = ((data ?? []) as { backfill_status?: string | null }[]).filter(
        (r) => r.backfill_status === "running",
      ).length;
    } catch {
      backfillRunning = 0;
    }

    const hb = healthRes.data?.last_heartbeat ?? null;
    const secondsSince = hb ? Math.round((Date.now() - new Date(hb).getTime()) / 1000) : null;

    const ruleRows = ((rulesRes as any).data ?? []) as {
      id: string;
      name: string | null;
      enabled: boolean;
      forwarded_count: number | null;
      max_forward_count: number | null;
    }[];
    const ruleNames = new Map(ruleRows.map((r) => [r.id, r.name ?? null]));

    const dayLogs = ((logsRes.data ?? []) as { status: string; detail: string | null; created_at: string }[]);
    const count = (s: string) => dayLogs.filter((l) => l.status === s).length;

    const skipCounts = new Map<string, number>();
    for (const l of dayLogs) {
      if (l.status !== "skipped") continue;
      const reason = (l.detail ?? "unknown").slice(0, 80);
      skipCounts.set(reason, (skipCounts.get(reason) ?? 0) + 1);
    }

    const recent = ((recentRes.data ?? []) as Omit<HealthLog, "rule_name">[]).map((l) => ({
      ...l,
      rule_name: l.rule_id ? ruleNames.get(l.rule_id) ?? null : null,
    }));

    return {
      generatedAt: new Date().toISOString(),
      isAdmin,
      database: { ok: dbOk, error: dbError, latencyMs },
      worker: {
        online: secondsSince !== null && secondsSince < 120,
        lastHeartbeat: hb,
        secondsSinceHeartbeat: secondsSince,
        version: healthRes.data?.version ?? null,
        activeClients: healthRes.data?.active_clients ?? 0,
        queuedMessages: healthRes.data?.queued_messages ?? 0,
        startedAt: healthRes.data?.started_at ?? null,
        detail: healthRes.data?.detail ?? null,
      },
      telegram: {
        status: sessionRes.data?.status ?? "logged_out",
        phone: sessionRes.data?.phone ?? null,
        updatedAt: sessionRes.data?.updated_at ?? null,
      },
      rules: {
        total: ruleRows.length,
        enabled: ruleRows.filter((r) => r.enabled).length,
        withLimitReached: ruleRows.filter(
          (r) => r.max_forward_count != null && (r.forwarded_count ?? 0) >= r.max_forward_count,
        ).length,
        backfillRunning,
        forwardedTotal: ruleRows.reduce((n, r) => n + (r.forwarded_count ?? 0), 0),
      },
      activity24h: {
        forwarded: count("forwarded"),
        skipped: count("skipped"),
        error: count("error"),
        waiting: count("waiting"),
      },
      lastForwardAt: dayLogs.find((l) => l.status === "forwarded")?.created_at ?? null,
      lastErrorAt: dayLogs.find((l) => l.status === "error")?.created_at ?? null,
      topSkipReasons: [...skipCounts.entries()]
        .map(([reason, c]) => ({ reason, count: c }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6),
      logs: recent,
    };
  });
