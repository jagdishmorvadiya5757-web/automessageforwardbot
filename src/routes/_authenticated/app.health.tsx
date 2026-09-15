import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getHealthReport, type HealthReport } from "@/lib/health.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Activity, Copy, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/health")({
  component: HealthPage,
  head: () => ({
    meta: [
      { title: "Health & Logs — ForwardFlow" },
      {
        name: "description",
        content: "Live status of the forwarding worker, website and recent activity logs.",
      },
      { property: "og:title", content: "Health & Logs — ForwardFlow" },
      {
        property: "og:description",
        content: "Live status of the forwarding worker, website and recent activity logs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ago(iso: string | null) {
  if (!iso) return "never";
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${tone ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}

function buildReportText(r: HealthReport) {
  const lines = [
    `ForwardFlow health report — ${new Date(r.generatedAt).toLocaleString()}`,
    ``,
    `Website/server: reachable (response ${r.database.latencyMs}ms)`,
    `Database: ${r.database.ok ? "OK" : `FAIL — ${r.database.error}`}`,
    `Worker: ${r.worker.online ? "ONLINE" : "OFFLINE"} | last heartbeat ${r.worker.lastHeartbeat ?? "never"} (${
      r.worker.secondsSinceHeartbeat ?? "-"
    }s ago) | version ${r.worker.version ?? "-"} | clients ${r.worker.activeClients} | queue ${r.worker.queuedMessages}`,
    `Worker detail: ${r.worker.detail ?? "-"} | started ${r.worker.startedAt ?? "-"}`,
    `Telegram: ${r.telegram.status} (${r.telegram.phone ?? "no phone"}) updated ${r.telegram.updatedAt ?? "-"}`,
    `Rules: ${r.rules.total} total, ${r.rules.enabled} enabled, ${r.rules.withLimitReached} at limit, ${r.rules.backfillRunning} backfill running, ${r.rules.forwardedTotal} forwarded lifetime`,
    `Last 24h: forwarded ${r.activity24h.forwarded}, skipped ${r.activity24h.skipped}, error ${r.activity24h.error}, waiting ${r.activity24h.waiting}`,
    `Last forward: ${r.lastForwardAt ?? "none"} | Last error: ${r.lastErrorAt ?? "none"}`,
    ``,
    `Top skip reasons (24h):`,
    ...(r.topSkipReasons.length
      ? r.topSkipReasons.map((s) => `  ${s.count}x ${s.reason}`)
      : ["  none"]),
    ``,
    `Recent logs (newest first):`,
    ...(r.logs.length
      ? r.logs.map(
          (l) =>
            `  [${new Date(l.created_at).toISOString()}] ${l.status.toUpperCase()} rule=${
              l.rule_name ?? l.rule_id ?? "-"
            } msg=${l.source_msg_ref ?? "-"} :: ${l.detail ?? "-"}`,
        )
      : ["  none"]),
  ];
  return lines.join("\n");
}

const statusTone: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  forwarded: "default",
  skipped: "secondary",
  waiting: "outline",
  error: "destructive",
};

function HealthPage() {
  const fn = useServerFn(getHealthReport);
  const { data, isLoading, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["health-report"],
    queryFn: () => fn({}),
    refetchInterval: 5 * 60_000,
    refetchIntervalInBackground: true,
  });

  function copyAll() {
    if (!data) return;
    navigator.clipboard.writeText(buildReportText(data));
    toast.success("Full report copied — paste it in chat");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-semibold text-foreground sm:text-2xl">
            <Activity className="h-5 w-5" /> Health &amp; Logs
          </h1>
          <p className="text-sm text-muted-foreground">
            Auto-checks every 5 minutes. Last checked {dataUpdatedAt ? ago(new Date(dataUpdatedAt).toISOString()) : "—"}.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 sm:mr-2 ${isFetching ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Check now</span>
          </Button>
          <Button size="sm" onClick={copyAll} disabled={!data}>
            <Copy className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Copy report</span>
          </Button>
        </div>
      </div>

      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">Checking…</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  Worker
                  <Badge variant={data.worker.online ? "default" : "destructive"}>
                    {data.worker.online ? "Online" : "Offline"}
                  </Badge>
                </CardTitle>
                <CardDescription>Heartbeat {ago(data.worker.lastHeartbeat)}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1 text-xs text-muted-foreground">
                <p>Version: {data.worker.version ?? "—"}</p>
                <p>Active users: {data.worker.activeClients}</p>
                <p>Queue: {data.worker.queuedMessages}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  Website &amp; database
                  <Badge variant={data.database.ok ? "default" : "destructive"}>
                    {data.database.ok ? "OK" : "Error"}
                  </Badge>
                </CardTitle>
                <CardDescription>Response {data.database.latencyMs} ms</CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {data.database.error ?? "All queries succeeded."}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  Telegram
                  <Badge variant={data.telegram.status === "logged_in" ? "default" : "secondary"}>
                    {data.telegram.status}
                  </Badge>
                </CardTitle>
                <CardDescription>{data.telegram.phone ?? "No phone connected"}</CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Updated {ago(data.telegram.updatedAt)}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Forwarded (24h)" value={data.activity24h.forwarded} />
            <Stat label="Skipped (24h)" value={data.activity24h.skipped} />
            <Stat
              label="Errors (24h)"
              value={data.activity24h.error}
              tone={data.activity24h.error > 0 ? "text-destructive" : undefined}
            />
            <Stat label="Waiting" value={data.activity24h.waiting} />
            <Stat label="Rules enabled" value={`${data.rules.enabled}/${data.rules.total}`} />
            <Stat label="Rules at limit" value={data.rules.withLimitReached} />
            <Stat label="Backfills running" value={data.rules.backfillRunning} />
            <Stat label="Forwarded lifetime" value={data.rules.forwardedTotal} />
          </div>

          {data.topSkipReasons.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Why messages were skipped (24h)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.topSkipReasons.map((s) => (
                  <div key={s.reason} className="flex items-start justify-between gap-3 text-sm">
                    <span className="min-w-0 break-words text-muted-foreground">{s.reason}</span>
                    <span className="shrink-0 font-medium text-foreground">{s.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Recent logs</CardTitle>
              <CardDescription>
                Last {data.logs.length} events. Use “Copy report” and paste it in chat when something
                breaks.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
              ) : (
                data.logs.map((l) => (
                  <div key={l.id} className="rounded-md border p-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={statusTone[l.status] ?? "secondary"}>{l.status}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(l.created_at).toLocaleString()}
                      </span>
                      {l.rule_name && (
                        <span className="text-xs font-medium text-foreground">{l.rule_name}</span>
                      )}
                    </div>
                    <p className="mt-1 break-words text-sm text-foreground">
                      {l.detail ?? l.source_msg_ref ?? "—"}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
