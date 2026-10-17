import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getAdminTools, setMaintenance, createAnnouncement, setAnnouncementActive, runLogCleanupNow,
} from "@/lib/system.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

const ACTION_LABELS: Record<string, string> = {
  maintenance_on: "Maintenance ON",
  maintenance_off: "Maintenance OFF",
  broadcast_sent: "Message bheja",
  broadcast_shown: "Message dobara dikhaya",
  broadcast_hidden: "Message chhupaya",
  logs_cleaned: "Purane logs delete",
  user_blocked: "User block",
  user_unblocked: "User unblock",
};

export function AdminTools() {
  const qc = useQueryClient();
  const fn = useServerFn(getAdminTools);
  const q = useQuery({ queryKey: ["admin-tools"], queryFn: () => fn(), retry: false });
  const maintFn = useServerFn(setMaintenance);
  const annFn = useServerFn(createAnnouncement);
  const toggleFn = useServerFn(setAnnouncementActive);
  const cleanFn = useServerFn(runLogCleanupNow);

  const [mOn, setMOn] = useState(false);
  const [mMsg, setMMsg] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tone, setTone] = useState<"info" | "success" | "warning">("info");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (q.data) {
      setMOn(q.data.maintenance.enabled);
      setMMsg(q.data.maintenance.message);
    }
  }, [q.data]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-tools"] });
    qc.invalidateQueries({ queryKey: ["system-notices"] });
  };
  async function run(f: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await f();
      toast.success(ok);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const d = q.data;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Broadcast & system</h1>
      {(q.isError || d?.setupNeeded) && (
        <Card className="border-destructive/50">
          <CardContent className="p-3 text-sm text-destructive">
            Server par database update chahiye (09_admin_tools.sql). {q.isError && (q.error as Error).message}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sabhi users ko message</CardTitle>
          <CardDescription>Har user ke dashboard ke upar dikhega.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input placeholder="Title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="Message" value={body} maxLength={1000} onChange={(e) => setBody(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            {(["info", "success", "warning"] as const).map((t) => (
              <Button key={t} size="sm" variant={tone === t ? "default" : "outline"} onClick={() => setTone(t)}>
                {t === "info" ? "Info" : t === "success" ? "Offer" : "Warning"}
              </Button>
            ))}
          </div>
          <Button
            disabled={busy || !title.trim()}
            onClick={() =>
              run(async () => {
                await annFn({ data: { title, body, tone } });
                setTitle("");
                setBody("");
              }, "Message sabko bhej diya")
            }
          >
            Send to all users
          </Button>
          <div className="space-y-2 pt-2">
            {d?.announcements.map((a) => (
              <div key={a.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</p>
                </div>
                <Switch
                  checked={a.active}
                  disabled={busy}
                  onCheckedChange={(v) => run(() => toggleFn({ data: { id: a.id, active: v } }), v ? "Dikh raha hai" : "Chhupa diya")}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Maintenance mode</CardTitle>
          <CardDescription>ON karne par naye users sign in nahi kar paayenge aur sabko notice dikhega. Forwarding chalti rahegi.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <Switch checked={mOn} onCheckedChange={setMOn} />
            <span className="text-sm">{mOn ? "ON" : "OFF"}</span>
          </div>
          <Input placeholder="Notice (optional)" value={mMsg} maxLength={300} onChange={(e) => setMMsg(e.target.value)} />
          <Button disabled={busy} onClick={() => run(() => maintFn({ data: { enabled: mOn, message: mMsg } }), "Save ho gaya")}>
            Save
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Purane logs</CardTitle>
          <CardDescription>
            {d?.cleanup.retentionDays ?? 30} din se purani activity apne aap delete hoti hai (har 6 ghante check).
            {d?.cleanup.at && ` Last: ${new Date(d.cleanup.at).toLocaleString()} · ${d.cleanup.deleted ?? 0} delete.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" disabled={busy} onClick={() => run(() => cleanFn(), "Cleanup ho gaya")}>
            Abhi clean karo
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Admin record</CardTitle>
          <CardDescription>Admin ne kya-kya badla (last 100).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {d?.audit.length === 0 && <p className="text-sm text-muted-foreground">Abhi koi record nahi.</p>}
          {d?.audit.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 border-b py-1.5 text-sm last:border-0">
              <Badge variant="outline">{ACTION_LABELS[r.action] ?? r.action}</Badge>
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {Object.values(r.detail ?? {}).filter(Boolean).join(" · ")}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
