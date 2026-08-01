import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getMySubscription } from "@/lib/subscription.functions";
import { getTelegramConnectionState } from "@/lib/telegram.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Plus,
  Replace,
  ListFilter,
  ShieldBan,
  UserCheck,
  UserX,
  Gift,
  Copy,
  Megaphone,
  Share2,
  CreditCard,
  Zap,
  Server,
  Phone,
  Hash,
  CalendarClock,
  Settings,
  Rocket,
  CheckCircle2,
  Users,
  Coins,
  Clock,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/home")({
  component: HomePage,
});

function soon(name: string) {
  toast.info(`${name} is coming soon`, {
    description: "This module is being built next.",
  });
}

const quickActions = [
  { label: "Create Task", icon: Plus, to: "/app" as const },
  { label: "Replace", icon: Replace },
  { label: "Whitelist", icon: ListFilter },
  { label: "Blacklist", icon: ShieldBan },
  { label: "Whitelist User", icon: UserCheck },
  { label: "Blacklist User", icon: UserX },
  { label: "Addons", icon: Zap },
  { label: "Reward Center", icon: Gift },
  { label: "Settings", icon: Settings, to: "/app/profile" as const },
  { label: "Upgrade", icon: Rocket, to: "/app/plan" as const },
];

const advancedTools = [
  {
    label: "Clone",
    icon: Copy,
    desc: "Duplicate every message from one chat into another, 1:1.",
  },
  {
    label: "Spammer",
    icon: Megaphone,
    desc: "Broadcast one message to many groups at once.",
  },
  {
    label: "Publish",
    icon: Share2,
    desc: "Publish Telegram posts to X, Discord and VK.",
  },
];

const missions = [
  { label: "Daily check-in", reward: "+5 credits", done: false },
  { label: "Create your first task", reward: "+10 credits", done: true },
  { label: "Connect Telegram account", reward: "+10 credits", done: true },
  { label: "Refer a friend", reward: "+25 credits", done: false },
];

function HomePage() {
  const navigate = useNavigate();
  const fetchSub = useServerFn(getMySubscription);
  const fetchTg = useServerFn(getTelegramConnectionState);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [name, setName] = useState<string>("there");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setAccountId(data.user?.id ?? null);
      const meta = data.user?.user_metadata as { display_name?: string } | undefined;
      setName(meta?.display_name || data.user?.email?.split("@")[0] || "there");
    });
  }, []);

  const { data: sub } = useQuery({
    queryKey: ["my-subscription"],
    queryFn: () => fetchSub(),
    refetchInterval: 60_000,
  });

  const { data: tg } = useQuery({
    queryKey: ["telegram-state"],
    queryFn: () => fetchTg(),
    refetchInterval: 15_000,
  });

  const active = !!sub?.isActive;
  const renewal = sub?.plan === "trial" ? sub?.trialEndsAt : sub?.subscriptionEndsAt;
  const doneMissions = missions.filter((m) => m.done).length;

  function copyId() {
    if (!accountId) return;
    navigator.clipboard.writeText(accountId);
    toast.success("Account ID copied");
  }

  return (
    <div className="space-y-6">
      {/* Profile header */}
      <header className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand text-lg font-bold uppercase text-brand-foreground">
          {name.slice(0, 1)}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-foreground sm:text-2xl">
            Hi, {name}
          </h1>
          <button
            type="button"
            onClick={copyId}
            className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className="truncate font-mono">
              ID: {accountId ? `${accountId.slice(0, 8)}…${accountId.slice(-4)}` : "—"}
            </span>
            <Copy className="h-3 w-3 shrink-0" />
          </button>
        </div>
      </header>

      {/* Plan status */}
      <Card>
        <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="truncate capitalize">
              {sub?.plan ?? "—"} plan
            </CardTitle>
            <CardDescription>
              {active
                ? sub?.daysLeft != null
                  ? `${sub.daysLeft} ${sub.daysLeft === 1 ? "day" : "days"} remaining`
                  : "No expiry"
                : "Forwarding is paused"}
            </CardDescription>
          </div>
          <Badge variant={active ? "default" : "destructive"} className="shrink-0">
            {active ? "Active" : "Expired"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoRow icon={CalendarClock} label="Next renewal" value={renewal ? new Date(renewal).toLocaleDateString() : "—"} />
            <InfoRow icon={Hash} label="Account ID" value={accountId ? `${accountId.slice(0, 8)}…${accountId.slice(-4)}` : "—"} />
            <InfoRow icon={Phone} label="Phone" value={tg?.phone ?? "Not connected"} />
            <InfoRow icon={Server} label="Server" value="VIP-1 (Oracle)" />
            <InfoRow
              icon={Clock}
              label="Start time"
              value={renewal && sub?.daysLeft != null ? new Date(renewal).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
            />
            <InfoRow
              icon={CheckCircle2}
              label="Account status"
              value={tg?.status === "logged_in" ? "Telegram connected" : "Needs activation"}
            />
          </dl>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => navigate({ to: "/app/plan" })}>
              <CreditCard className="mr-2 h-4 w-4" />
              Renew
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate({ to: "/app/plan" })}>
              Activate key
            </Button>
            <Button size="sm" variant="ghost" onClick={() => soon("Switch to Free")}>
              Switch to Free
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick actions */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Quick actions</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {quickActions.map((a) =>
            a.to ? (
              <Link
                key={a.label}
                to={a.to}
                className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center transition-colors hover:bg-accent"
              >
                <a.icon className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium leading-tight">{a.label}</span>
              </Link>
            ) : (
              <button
                key={a.label}
                type="button"
                onClick={() => soon(a.label)}
                className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center transition-colors hover:bg-accent"
              >
                <a.icon className="h-5 w-5 text-muted-foreground" />
                <span className="text-xs font-medium leading-tight">{a.label}</span>
              </button>
            ),
          )}
        </div>
      </section>

      {/* Reward center */}
      <Card>
        <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 pb-3">
          <CardTitle className="flex min-w-0 items-center gap-2 text-base">
            <Gift className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate">Reward center</span>
          </CardTitle>
          <Badge variant="secondary" className="shrink-0 gap-1">
            <Coins className="h-3 w-3" /> 0 credits
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Missions completed</span>
              <span>
                {doneMissions}/{missions.length}
              </span>
            </div>
            <Progress value={(doneMissions / missions.length) * 100} />
          </div>
          <ul className="space-y-1">
            {missions.map((m) => (
              <li
                key={m.label}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2"
              >
                <CheckCircle2
                  className={`h-4 w-4 shrink-0 ${m.done ? "text-success" : "text-muted-foreground/40"}`}
                />
                <span className="truncate text-sm">{m.label}</span>
                <span className="shrink-0 text-xs font-medium text-muted-foreground">{m.reward}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => soon("Daily check-in")}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Daily check-in
            </Button>
            <Button size="sm" variant="outline" onClick={() => soon("Refer a friend")}>
              <Users className="mr-2 h-4 w-4" /> Refer a friend
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Advanced tools */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Advanced tools</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {advancedTools.map((t) => (
            <Card key={t.label} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                  <CardTitle className="flex min-w-0 items-center gap-2 text-base">
                    <t.icon className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate">{t.label}</span>
                  </CardTitle>
                  <Badge variant="secondary" className="shrink-0">Soon</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-3">
                <p className="text-sm text-muted-foreground">{t.desc}</p>
                <Button size="sm" variant="outline" onClick={() => soon(t.label)}>
                  Open
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Phone;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="truncate text-sm font-medium text-foreground">{value}</dd>
      </div>
    </div>
  );
}
