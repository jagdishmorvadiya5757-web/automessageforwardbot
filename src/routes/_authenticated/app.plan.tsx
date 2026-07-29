import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { redeemLicenseKey } from "@/lib/license.functions";
import { listPlans } from "@/lib/plans.functions";
import { getMySubscription } from "@/lib/subscription.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { KeyRound, Check, ExternalLink } from "lucide-react";


export const Route = createFileRoute("/_authenticated/app/plan")({
  component: PlanPage,
  head: () => ({
    meta: [
      { title: "Plan & License — ForwardFlow" },
      {
        name: "description",
        content: "View your ForwardFlow plan and activate a license key to unlock forwarding.",
      },
      { property: "og:title", content: "Plan & License — ForwardFlow" },
      {
        property: "og:description",
        content: "View your ForwardFlow plan and activate a license key.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const PLANS = [
  { name: "Trial", price: "Free", period: "3 days", perks: ["All features", "Unlimited rules", "Auto-starts on signup"] },
  { name: "Pro", price: "₹499", period: "per month", perks: ["Unlimited forwarding", "Per-rule delay & limits", "Priority worker"] },
  { name: "Business", price: "₹1499", period: "per month", perks: ["Everything in Pro", "Multiple Telegram accounts", "Priority support"] },
];

function PlanPage() {
  const qc = useQueryClient();
  const subFn = useServerFn(getMySubscription);
  const redeemFn = useServerFn(redeemLicenseKey);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: sub } = useQuery({
    queryKey: ["my-subscription"],
    queryFn: () => subFn(),
    refetchInterval: 60_000,
  });

  async function redeem(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    try {
      const res = await redeemFn({ data: { code: code.trim() } });
      if (res.success) {
        toast.success(res.message);
        setCode("");
        await qc.invalidateQueries({ queryKey: ["my-subscription"] });
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Plan & License</h1>
        <p className="text-sm text-muted-foreground">
          Activate a license key to extend or upgrade your subscription.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current plan</CardTitle>
          <CardDescription>
            {sub ? (
              <span className="flex items-center gap-2">
                <Badge variant={sub.isActive ? "default" : "destructive"} className="capitalize">
                  {sub.plan}
                </Badge>
                {sub.daysLeft !== null
                  ? `${sub.daysLeft} ${sub.daysLeft === 1 ? "day" : "days"} left`
                  : "No expiry"}
              </span>
            ) : (
              "Loading…"
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={redeem} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="license">License key</Label>
              <Input
                id="license"
                placeholder="FF-XXXX-XXXX-XXXX"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                autoCapitalize="characters"
              />
            </div>
            <Button type="submit" disabled={busy}>
              <KeyRound className="mr-2 h-4 w-4" />
              {busy ? "Activating…" : "Activate"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        {PLANS.map((p) => (
          <Card key={p.name}>
            <CardHeader>
              <CardTitle className="text-base">{p.name}</CardTitle>
              <CardDescription>
                <span className="text-xl font-semibold text-foreground">{p.price}</span>{" "}
                <span className="text-xs">{p.period}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {p.perks.map((perk) => (
                <div key={perk} className="flex items-start gap-2 text-muted-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {perk}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Need a key? Contact the admin — keys are issued manually after payment.
      </p>
    </div>
  );
}
