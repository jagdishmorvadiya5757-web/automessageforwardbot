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
  { label: "Rewards Center", icon: Gift },
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

function HomePage() {
  const navigate = useNavigate();
  const fetchSub = useServerFn(getMySubscription);
  const fetchTg = useServerFn(getTelegramConnectionState);
  const [accountId, setAccountId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAccountId(data.user?.id ?? null));
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Home</h1>
        <p className="text-sm text-muted-foreground">Your account, plan and shortcuts.</p>
      </div>

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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
