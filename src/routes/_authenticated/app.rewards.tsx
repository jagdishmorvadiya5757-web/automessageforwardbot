import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getRewardState,
  doDailyCheckin,
  applyReferralCode,
  claimMission,
} from "@/lib/rewards.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Gift, Flame, Users, Copy, CheckCircle2, Target } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/rewards")({
  component: RewardsPage,
  head: () => ({
    meta: [
      { title: "Rewards — ForwardFlow" },
      { name: "description", content: "Daily check-ins, missions and referral rewards." },
      { property: "og:title", content: "Rewards — ForwardFlow" },
      { property: "og:description", content: "Daily check-ins, missions and referral rewards." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const CLAIMABLE = ["connect", "first_rule", "five_rules", "hundred_forwards"] as const;
type ClaimableId = (typeof CLAIMABLE)[number];

function RewardsPage() {
  const qc = useQueryClient();
  const stateFn = useServerFn(getRewardState);
  const checkinFn = useServerFn(doDailyCheckin);
  const referralFn = useServerFn(applyReferralCode);
  const missionFn = useServerFn(claimMission);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({ queryKey: ["rewards"], queryFn: () => stateFn({}) });

  function refresh() {
    qc.invalidateQueries({ queryKey: ["rewards"] });
    qc.invalidateQueries({ queryKey: ["wallet"] });
    qc.invalidateQueries({ queryKey: ["wallet-txs"] });
  }

  async function run(fn: () => Promise<{ success: boolean; message: string; credits?: number }>) {
    setBusy(true);
    try {
      const res = await fn();
      if (res.success) toast.success(res.credits ? `${res.message} · +${res.credits} credits` : res.message);
      else toast.error(res.message);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const referralLink =
    typeof window !== "undefined" && data?.referralCode
      ? `${window.location.origin}/auth?ref=${data.referralCode}`
      : "";

  const done = data?.missions.filter((m) => m.done).length ?? 0;
  const total = data?.missions.length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Reward center</h1>
        <p className="text-sm text-muted-foreground">
          Earn credits with daily check-ins, missions and invites.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Credits</p>
            <p className="text-2xl font-semibold text-foreground">{data?.balance ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Flame className="h-3 w-3" /> Check-in streak
            </p>
            <p className="text-2xl font-semibold text-foreground">{data?.streak ?? 0} days</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" /> Friends invited
            </p>
            <p className="text-2xl font-semibold text-foreground">{data?.referralCount ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Gift className="h-4 w-4" /> Daily check-in
          </CardTitle>
          <CardDescription>
            5 credits on day one, +2 each consecutive day, up to 25 per day.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button disabled={busy || data?.checkedInToday} onClick={() => run(() => checkinFn({}))}>
            {data?.checkedInToday ? "Checked in today" : busy ? "Checking in…" : "Check in"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4" /> Missions
          </CardTitle>
          <CardDescription>
            {done} of {total} completed
          </CardDescription>
          <Progress value={total ? (done / total) * 100 : 0} className="mt-2" />
        </CardHeader>
        <CardContent className="space-y-2">
          {(data?.missions ?? []).map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                  {m.done && <CheckCircle2 className="h-4 w-4 text-primary" />}
                  {m.label}
                </p>
                <p className="truncate text-xs text-muted-foreground">{m.description}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="secondary">+{m.reward}</Badge>
                {CLAIMABLE.includes(m.id as ClaimableId) && (
                  <Button
                    size="sm"
                    variant={m.done ? "default" : "outline"}
                    disabled={!m.done || busy}
                    onClick={() => run(() => missionFn({ data: { missionId: m.id as ClaimableId } }))}
                  >
                    Claim
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" /> Referrals
          </CardTitle>
          <CardDescription>
            You get 50 credits per friend, they get 25 when they use your code.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Your referral code</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded bg-muted px-2 py-2 font-mono text-sm">
                {data?.referralCode ?? "—"}
              </code>
              <Button
                size="icon"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(referralLink || data?.referralCode || "");
                  toast.success("Invite link copied");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Earned from referrals: {data?.referralCredits ?? 0} credits
            </p>
          </div>

          {!data?.usedReferral && (
            <div className="space-y-2 border-t pt-4">
              <Label>Have a friend's code?</Label>
              <div className="flex gap-2">
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="FFAB12CD" />
                <Button
                  variant="outline"
                  disabled={busy || code.trim().length < 4}
                  onClick={() => run(() => referralFn({ data: { code: code.trim() } }))}
                >
                  Apply
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
