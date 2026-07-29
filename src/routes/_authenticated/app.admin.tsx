import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  createLicenseKeys,
  deleteLicenseKey,
  listLicenseKeys,
  listUsersAdmin,
  setUserPlan,
} from "@/lib/license.functions";
import {
  createClaimCode,
  deleteClaimCode,
  listAllPlans,
  listClaimCodes,
  setClaimCodeActive,
  updatePlan,
  type PlanRow,
} from "@/lib/plans.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Copy, Plus, Trash2, Link2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/admin")({
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "Admin — ForwardFlow" },
      { name: "description", content: "Issue license keys and manage user subscriptions." },
      { property: "og:title", content: "Admin — ForwardFlow" },
      { property: "og:description", content: "Issue license keys and manage subscriptions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function AdminPage() {
  const qc = useQueryClient();
  const keysFn = useServerFn(listLicenseKeys);
  const usersFn = useServerFn(listUsersAdmin);
  const createFn = useServerFn(createLicenseKeys);
  const deleteFn = useServerFn(deleteLicenseKey);
  const setPlanFn = useServerFn(setUserPlan);
  const plansFn = useServerFn(listAllPlans);
  const claimsFn = useServerFn(listClaimCodes);

  const [plan, setPlan] = useState<"pro" | "business">("pro");
  const [days, setDays] = useState(30);
  const [count, setCount] = useState(1);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const keys = useQuery({ queryKey: ["license-keys"], queryFn: () => keysFn(), retry: false });
  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => usersFn(), retry: false });
  const plansQ = useQuery({ queryKey: ["admin-plans"], queryFn: () => plansFn(), retry: false });
  const claims = useQuery({ queryKey: ["claim-codes"], queryFn: () => claimsFn(), retry: false });

  if (keys.isError || users.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Not available</CardTitle>
          <CardDescription>You do not have admin access.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  async function generate() {
    setBusy(true);
    try {
      const res = await createFn({
        data: { plan, durationDays: days, count, note: note || undefined },
      });
      await navigator.clipboard.writeText(res.codes.join("\n")).catch(() => {});
      toast.success(`${res.codes.length} key(s) generated and copied`);
      setNote("");
      await qc.invalidateQueries({ queryKey: ["license-keys"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeKey(id: string) {
    try {
      await deleteFn({ data: { id } });
      await qc.invalidateQueries({ queryKey: ["license-keys"] });
      toast.success("Key deleted");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function changePlan(userId: string, newPlan: string, d: number) {
    try {
      await setPlanFn({ data: { userId, plan: newPlan as never, days: newPlan === "expired" ? 0 : d } });
      await qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Plan updated");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="text-sm text-muted-foreground">
          Edit public plans, issue keys and manage subscriptions.
        </p>
      </div>

      <Tabs defaultValue="plans">
        <TabsList className="flex w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="claims">Claim links</TabsTrigger>
          <TabsTrigger value="keys">License keys</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="space-y-4 pt-4">
          {(plansQ.data ?? []).map((p) => (
            <PlanEditorCard key={p.id} plan={p} />
          ))}
          {plansQ.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">No plans configured.</p>
          )}
        </TabsContent>

        <TabsContent value="claims" className="space-y-4 pt-4">
          <ClaimCodeCreator />
          <div className="space-y-2">
            {(claims.data ?? []).map((c) => (
              <div key={c.id} className="rounded-lg border px-3 py-3 text-sm sm:px-4">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="font-mono font-medium">{c.code}</code>
                  <Badge variant="secondary" className="capitalize">
                    {c.plan} · {c.duration_days}d
                  </Badge>
                  <Badge variant={c.active ? "default" : "outline"}>
                    {c.used_count}/{c.max_uses} used
                  </Badge>
                  {c.note && <span className="text-muted-foreground">{c.note}</span>}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const url = `${window.location.origin}/claim`;
                      navigator.clipboard.writeText(`${url}  •  code: ${c.code}`);
                      toast.success("Claim link + code copied");
                    }}
                  >
                    <Link2 className="mr-2 h-4 w-4" /> Copy claim link
                  </Button>
                  <ToggleClaim id={c.id} active={c.active} />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto"
                    onClick={async () => {
                      try {
                        await deleteClaimCode({ data: { id: c.id } });
                        await qc.invalidateQueries({ queryKey: ["claim-codes"] });
                        toast.success("Deleted");
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
            {claims.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">No claim codes yet.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="keys" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Generate keys</CardTitle>
              <CardDescription>Keys are copied to your clipboard after creation.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1.5">
                <Label>Plan</Label>
                <Select value={plan} onValueChange={(v) => setPlan(v as "pro" | "business")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Days</Label>
                <Input
                  type="number"
                  min={1}
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Count</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Note</Label>
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="buyer" />
              </div>
              <div className="flex items-end sm:col-span-2 lg:col-span-1">
                <Button onClick={generate} disabled={busy} className="w-full">
                  <Plus className="mr-2 h-4 w-4" /> Generate
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            {(keys.data ?? []).map((k) => (
              <div
                key={k.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-3 text-sm sm:px-4"
              >
                <code className="font-mono font-medium">{k.code}</code>
                <Badge variant="secondary" className="capitalize">
                  {k.plan} · {k.duration_days}d
                </Badge>
                {k.redeemed_by ? (
                  <Badge variant="outline">
                    Used{k.redeemed_by_name ? ` by ${k.redeemed_by_name}` : ""}
                  </Badge>
                ) : (
                  <Badge>Unused</Badge>
                )}
                {k.note && <span className="text-muted-foreground">{k.note}</span>}
                <div className="ml-auto flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(k.code);
                      toast.success("Copied");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  {!k.redeemed_by && (
                    <Button variant="ghost" size="icon" onClick={() => removeKey(k.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {keys.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">No keys yet.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-2 pt-4">
          {(users.data ?? []).map((u) => (
            <div key={u.userId} className="rounded-lg border px-3 py-3 text-sm sm:px-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{u.name ?? u.userId.slice(0, 8)}</span>
                <Badge variant={u.isActive ? "default" : "destructive"} className="capitalize">
                  {u.plan}
                </Badge>
                <Badge variant="outline">TG: {u.telegramStatus}</Badge>
                <span className="text-muted-foreground">
                  {u.plan === "trial"
                    ? u.trialEndsAt && `until ${new Date(u.trialEndsAt).toLocaleDateString()}`
                    : u.subscriptionEndsAt &&
                      `until ${new Date(u.subscriptionEndsAt).toLocaleDateString()}`}
                </span>
              </div>
              <UserPlanEditor
                currentPlan={u.plan}
                onApply={(p, d) => changePlan(u.userId, p, d)}
              />
            </div>
          ))}
          {users.data?.length === 0 && <p className="text-sm text-muted-foreground">No users.</p>}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ToggleClaim({ id, active }: { id: string; active: boolean }) {
  const qc = useQueryClient();
  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={active}
        onCheckedChange={async (v) => {
          try {
            await setClaimCodeActive({ data: { id, active: v } });
            await qc.invalidateQueries({ queryKey: ["claim-codes"] });
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />
      <span className="text-xs text-muted-foreground">{active ? "Active" : "Disabled"}</span>
    </div>
  );
}

function ClaimCodeCreator() {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [plan, setPlan] = useState<"pro" | "business">("pro");
  const [days, setDays] = useState(30);
  const [maxUses, setMaxUses] = useState(1);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Create claim code</CardTitle>
        <CardDescription>
          Share your payment link, then send buyers the claim link with this code. Entering it on
          /claim auto-generates a license key for the chosen plan.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1.5">
          <Label>Code</Label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="PRO-2026"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Plan</Label>
          <Select value={plan} onValueChange={(v) => setPlan(v as "pro" | "business")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pro">Pro</SelectItem>
              <SelectItem value="business">Business</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Days</Label>
          <Input
            type="number"
            min={1}
            value={days}
            onChange={(e) => setDays(Number(e.target.value) || 1)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Max uses</Label>
          <Input
            type="number"
            min={1}
            value={maxUses}
            onChange={(e) => setMaxUses(Number(e.target.value) || 1)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Note</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="buyer" />
        </div>
        <div className="flex items-end sm:col-span-2 lg:col-span-5">
          <Button
            disabled={saving || !code.trim()}
            onClick={async () => {
              setSaving(true);
              try {
                await createClaimCode({
                  data: {
                    code: code.trim(),
                    plan,
                    durationDays: days,
                    maxUses,
                    note: note || undefined,
                  },
                });
                setCode("");
                setNote("");
                await qc.invalidateQueries({ queryKey: ["claim-codes"] });
                toast.success("Claim code created");
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setSaving(false);
              }
            }}
            className="w-full sm:w-auto"
          >
            <Plus className="mr-2 h-4 w-4" /> Create claim code
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PlanEditorCard({ plan }: { plan: PlanRow }) {
  const qc = useQueryClient();
  const [name, setName] = useState(plan.name);
  const [price, setPrice] = useState(plan.price);
  const [period, setPeriod] = useState(plan.period);
  const [perks, setPerks] = useState(plan.perks.join("\n"));
  const [days, setDays] = useState(plan.duration_days);
  const [link, setLink] = useState(plan.payment_link ?? "");
  const [visible, setVisible] = useState(plan.visible);
  const [saving, setSaving] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base capitalize">{plan.slug}</CardTitle>
        <CardDescription>Shown to every user on the Plan &amp; License page.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Price</Label>
          <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="₹499" />
        </div>
        <div className="space-y-1.5">
          <Label>Period</Label>
          <Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="per month" />
        </div>
        <div className="space-y-1.5">
          <Label>Duration (days)</Label>
          <Input
            type="number"
            min={1}
            value={days}
            onChange={(e) => setDays(Number(e.target.value) || 1)}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Payment link</Label>
          <Input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://superprofile.bio/..."
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Features (one per line)</Label>
          <Textarea rows={4} value={perks} onChange={(e) => setPerks(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
          <div className="flex items-center gap-2">
            <Switch checked={visible} onCheckedChange={setVisible} />
            <span className="text-sm text-muted-foreground">Visible to users</span>
          </div>
          <Button
            className="ml-auto"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await updatePlan({
                  data: {
                    id: plan.id,
                    name,
                    price,
                    period,
                    perks: perks
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean),
                    durationDays: days,
                    paymentLink: link.trim() || null,
                    visible,
                  },
                });
                await qc.invalidateQueries({ queryKey: ["admin-plans"] });
                await qc.invalidateQueries({ queryKey: ["public-plans"] });
                toast.success("Plan saved");
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setSaving(false);
              }
            }}
          >
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function UserPlanEditor({
  currentPlan,
  onApply,
}: {
  currentPlan: string;
  onApply: (plan: string, days: number) => void | Promise<void>;
}) {
  const [plan, setPlan] = useState(currentPlan);
  const [days, setDays] = useState(30);
  const [saving, setSaving] = useState(false);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <div className="w-32">
        <Select value={plan} onValueChange={setPlan}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="pro">Pro</SelectItem>
            <SelectItem value="business">Business</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Input
        type="number"
        min={0}
        max={3650}
        className="w-20"
        value={days}
        disabled={plan === "expired"}
        onChange={(e) => setDays(Number(e.target.value) || 0)}
        aria-label="Days"
      />
      <Button
        size="sm"
        variant="secondary"
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          try {
            await onApply(plan, days);
          } finally {
            setSaving(false);
          }
        }}
      >
        Apply
      </Button>
    </div>
  );
}
