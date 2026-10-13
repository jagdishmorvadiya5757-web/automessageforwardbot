import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { getAdminOverview } from "@/lib/admin-overview.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users, CreditCard, KeyRound, Link2, Activity, Send, AlertTriangle,
  UserPlus, Ban, Server, RefreshCw, ChevronRight,
} from "lucide-react";

type Props = { onOpen: (section: string) => void };

function Stat({ label, value, sub, tone }: { label: string; value: number | string; sub?: string; tone?: "bad" | "good" }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-semibold ${tone === "bad" ? "text-destructive" : tone === "good" ? "text-primary" : ""}`}>{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export function AdminHome({ onOpen }: Props) {
  const fn = useServerFn(getAdminOverview);
  const q = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => fn(),
    refetchInterval: 30000,
    retry: false,
  });
  const d = q.data;

  const sections = [
    { id: "users", title: "Users", desc: "Sab users, plan, rules, block", icon: Users, badge: d ? `${d.users.total}` : undefined },
    { id: "plans", title: "Plans", desc: "Price, perks, payment link", icon: CreditCard },
    { id: "keys", title: "License keys", desc: "Keys banao aur dekho", icon: KeyRound },
    { id: "claims", title: "Claim links", desc: "Multi-use promo codes", icon: Link2 },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Admin dashboard</h1>
          <p className="text-sm text-muted-foreground">Har 30 sec me auto update</p>
        </div>
        <Button variant="outline" size="icon" onClick={() => q.refetch()} aria-label="Refresh">
          <RefreshCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {q.isError && (
        <Card className="border-destructive/50">
          <CardContent className="p-3 text-sm text-destructive">{(q.error as Error).message}</CardContent>
        </Card>
      )}

      <Card className={d?.worker.online ? "border-primary/40" : "border-destructive/50"}>
        <CardContent className="flex items-center gap-3 p-3">
          <Server className={`h-5 w-5 ${d?.worker.online ? "text-primary" : "text-destructive"}`} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              Worker {d ? (d.worker.online ? "online" : "offline") : "…"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {d?.worker.activeClients ?? 0} Telegram accounts chal rahe
              {d?.worker.lastHeartbeat && ` · last ${new Date(d.worker.lastHeartbeat).toLocaleTimeString()}`}
            </p>
          </div>
          <Badge variant={d?.worker.online ? "default" : "destructive"}>{d?.worker.online ? "LIVE" : "DOWN"}</Badge>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Total users" value={d?.users.total ?? "–"} sub={d ? `+${d.users.signups7d} is hafte` : undefined} />
        <Stat label="Aaj ke signups" value={d?.users.signupsToday ?? "–"} tone="good" />
        <Stat label="Paid active" value={d?.plans.paid ?? "–"} sub={d ? `${d.plans.trial} trial · ${d.plans.expired} expired` : undefined} />
        <Stat label="Blocked" value={d?.users.blocked ?? "–"} tone={d && d.users.blocked > 0 ? "bad" : undefined} />
        <Stat label="Aaj forward" value={d?.today.forwarded ?? "–"} tone="good" />
        <Stat label="Aaj skip" value={d?.today.skipped ?? "–"} />
        <Stat label="Aaj errors" value={d?.today.error ?? "–"} tone={d && d.today.error > 0 ? "bad" : undefined} />
        <Stat label="Rules on" value={d ? `${d.rules.enabled}/${d.rules.total}` : "–"} />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Manage</h2>
        <div className="grid grid-cols-2 gap-3">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => onOpen(s.id)}
              className="rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/60 hover:bg-accent"
            >
              <div className="flex items-center justify-between">
                <s.icon className="h-6 w-6 text-primary" />
                {s.badge && <Badge variant="secondary">{s.badge}</Badge>}
              </div>
              <p className="mt-3 font-medium">{s.title}</p>
              <p className="text-xs text-muted-foreground">{s.desc}</p>
            </button>
          ))}
          <Link
            to="/app/health"
            className="rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/60 hover:bg-accent"
          >
            <Activity className="h-6 w-6 text-primary" />
            <p className="mt-3 font-medium">Health & logs</p>
            <p className="text-xs text-muted-foreground">Worker, logs, copy report</p>
          </Link>
          <Link
            to="/app/activity"
            className="rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/60 hover:bg-accent"
          >
            <Send className="h-6 w-6 text-primary" />
            <p className="mt-3 font-medium">Activity</p>
            <p className="text-xs text-muted-foreground">Forward history</p>
          </Link>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Quick actions</h2>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => onOpen("keys")}><KeyRound className="mr-1 h-4 w-4" /> New key</Button>
          <Button size="sm" variant="outline" onClick={() => onOpen("users")}><UserPlus className="mr-1 h-4 w-4" /> Give plan</Button>
          <Button size="sm" variant="outline" onClick={() => onOpen("users")}><Ban className="mr-1 h-4 w-4" /> Block user</Button>
        </div>
      </div>

      {d && d.recentErrors.length > 0 && (
        <div>
          <h2 className="mb-2 flex items-center gap-1 text-sm font-semibold text-destructive">
            <AlertTriangle className="h-4 w-4" /> Latest errors
          </h2>
          <div className="space-y-1">
            {d.recentErrors.map((e, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border px-3 py-2 text-xs">
                <span className="shrink-0 text-muted-foreground">{new Date(e.created_at).toLocaleTimeString()}</span>
                <span className="min-w-0 flex-1 break-words">{e.detail ?? "error"}</span>
              </div>
            ))}
          </div>
          <Link to="/app/health" className="mt-1 inline-flex items-center text-xs text-primary">
            Saare logs <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  );
}
