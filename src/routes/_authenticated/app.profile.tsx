import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getMySubscription } from "@/lib/subscription.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Bot,
  RefreshCw,
  Gauge,
  BellRing,
  Globe2,
  Wallet,
  ArrowLeftRight,
  ReceiptText,
  CreditCard,
  UserCog,
  Info,
  BookOpen,
  LifeBuoy,
  Megaphone,
  ScrollText,
  Star,
  FileText,
  ShieldCheck,
  Trash2,
  LogOut,
  ChevronRight,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/profile")({
  component: ProfilePage,
});

function soon(name: string) {
  toast.info(`${name} is coming soon`, { description: "This module is being built next." });
}

const TIMEZONES = [
  "UTC",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
];

function ProfilePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchSub = useServerFn(getMySubscription);
  const [email, setEmail] = useState<string | null>(null);
  const [botActive, setBotActive] = useState(true);
  const [boost, setBoost] = useState(false);
  const [alerts, setAlerts] = useState(true);
  const [reminder, setReminder] = useState(false);
  const [tz, setTz] = useState("UTC");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    try {
      setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    } catch {
      setTz("UTC");
    }
  }, []);

  const { data: sub } = useQuery({
    queryKey: ["my-subscription"],
    queryFn: () => fetchSub(),
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Settings & profile</h1>
        <p className="text-sm text-muted-foreground">Bot configuration, wallet and support.</p>
      </div>

      <Card>
        <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate text-base">{email ?? "Account"}</CardTitle>
            <CardDescription className="capitalize">{sub?.plan ?? "—"} plan</CardDescription>
          </div>
          <Badge variant={sub?.isActive ? "default" : "destructive"} className="shrink-0">
            {sub?.isActive ? "Active" : "Expired"}
          </Badge>
        </CardHeader>
      </Card>

      {/* Bot & system */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4 shrink-0 text-primary" /> Bot & system
          </CardTitle>
          <CardDescription>Control the forwarding engine attached to your account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <ToggleRow
            icon={Bot}
            label="BOT active state"
            desc="Pause or resume all forwarding at once."
            checked={botActive}
            onChange={(v) => {
              setBotActive(v);
              soon("Global bot toggle");
            }}
          />
          <ToggleRow
            icon={Gauge}
            label="Boost performance"
            desc="Use faster polling on your busiest chats."
            checked={boost}
            onChange={(v) => {
              setBoost(v);
              soon("Boost performance");
            }}
          />
          <ToggleRow
            icon={BellRing}
            label="Chat access error alert"
            desc="Notify me when a source or target becomes unreachable."
            checked={alerts}
            onChange={(v) => {
              setAlerts(v);
              soon("Access error alerts");
            }}
          />
          <LinkRow icon={RefreshCw} label="Restart bot" onClick={() => soon("Restart bot")} />
          <LinkRow
            icon={UserCog}
            label="Bot management (use a bot token instead of my account)"
            onClick={() => soon("Bot token mode")}
          />
        </CardContent>
      </Card>

      {/* Localization */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe2 className="h-4 w-4 shrink-0 text-primary" /> Localization
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>Time zone</Label>
            <Select
              value={TIMEZONES.includes(tz) ? tz : "UTC"}
              onValueChange={(v) => {
                setTz(v);
                soon("Time zone preference");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((z) => (
                  <SelectItem key={z} value={z}>
                    {z}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ToggleRow
            icon={BellRing}
            label="Daily check-in reminder"
            desc="Ping me so I don't lose my reward streak."
            checked={reminder}
            onChange={(v) => {
              setReminder(v);
              soon("Check-in reminder");
            }}
          />
        </CardContent>
      </Card>

      {/* Wallet */}
      <Card>
        <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 pb-2">
          <CardTitle className="flex min-w-0 items-center gap-2 text-base">
            <Wallet className="h-4 w-4 shrink-0 text-primary" /> Wallet & credits
          </CardTitle>
          <Badge variant="secondary" className="shrink-0">0 credits</Badge>
        </CardHeader>
        <CardContent className="space-y-1">
          <LinkRow icon={CreditCard} label="Buy credits" onClick={() => soon("Buy credits")} />
          <LinkRow icon={ArrowLeftRight} label="Transfer credits" onClick={() => soon("Transfer credits")} />
          <LinkRow icon={ReceiptText} label="Credit transactions" onClick={() => soon("Credit history")} />
          <LinkRow icon={UserCog} label="Account transfer" onClick={() => soon("Account transfer")} />
          <LinkRow icon={Info} label="About credits & addons" onClick={() => soon("Credits guide")} />
          <Link
            to="/app/plan"
            className="flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-accent"
          >
            <CreditCard className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-sm">My subscriptions</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>

      {/* Support */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <LifeBuoy className="h-4 w-4 shrink-0 text-primary" /> Support & legal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <LinkRow icon={BookOpen} label="Setup instructions" onClick={() => soon("Docs")} />
          <LinkRow icon={LifeBuoy} label="Customer support" onClick={() => soon("Live chat")} />
          <LinkRow icon={Megaphone} label="Join news channel" onClick={() => soon("News channel")} />
          <Link
            to="/app/logs"
            className="flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-accent"
          >
            <ScrollText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-sm">Error & activity logs</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
          <LinkRow icon={Star} label="Rate us 5 stars" onClick={() => soon("Rating")} />
          <LinkRow icon={FileText} label="Terms of use" onClick={() => soon("Terms of use")} />
          <LinkRow icon={ShieldCheck} label="Privacy policy" onClick={() => soon("Privacy policy")} />
          <LinkRow
            icon={Trash2}
            label="Delete my account"
            destructive
            onClick={() => soon("Account deletion")}
          />
        </CardContent>
      </Card>

      <Button variant="outline" className="w-full" onClick={signOut}>
        <LogOut className="mr-2 h-4 w-4" /> Log out
      </Button>
    </div>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  desc,
  checked,
  onChange,
}: {
  icon: typeof Bot;
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-3">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{label}</p>
        {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function LinkRow({
  icon: Icon,
  label,
  onClick,
  destructive,
}: {
  icon: typeof Bot;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-accent"
    >
      <Icon className={`h-4 w-4 shrink-0 ${destructive ? "text-destructive" : "text-muted-foreground"}`} />
      <span className={`min-w-0 flex-1 truncate text-sm ${destructive ? "text-destructive" : ""}`}>
        {label}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}
