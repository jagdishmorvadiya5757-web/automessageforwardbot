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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Copy, Plus, Trash2 } from "lucide-react";

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

  const [plan, setPlan] = useState<"pro" | "business">("pro");
  const [days, setDays] = useState(30);
  const [count, setCount] = useState(1);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const keys = useQuery({ queryKey: ["license-keys"], queryFn: () => keysFn(), retry: false });
  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => usersFn(), retry: false });

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
        <p className="text-sm text-muted-foreground">Issue license keys and manage subscriptions.</p>
      </div>

      <Tabs defaultValue="keys">
        <TabsList>
          <TabsTrigger value="keys">License keys</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        <TabsContent value="keys" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Generate keys</CardTitle>
              <CardDescription>Keys are copied to your clipboard after creation.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-5">
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
              <div className="space-y-1.5 sm:col-span-1">
                <Label>Note</Label>
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="buyer" />
              </div>
              <div className="flex items-end">
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
                className="flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 text-sm"
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
            <div
              key={u.userId}
              className="flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 text-sm"
            >
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
              <PlanEditor
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
