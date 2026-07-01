import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, ArrowRight } from "lucide-react";

type EndpointType = "channel" | "bot";
type Rule = {
  id: string;
  name: string | null;
  source: string;
  source_type: EndpointType;
  destination: string;
  destination_type: EndpointType;
  enabled: boolean;
  include_keywords: string[];
  exclude_keywords: string[];
};
type Channel = {
  chat_id: string;
  title: string;
  username: string | null;
  kind: string;
};

export const Route = createFileRoute("/_authenticated/app/")({
  component: RulesPage,
});

const empty = {
  name: "",
  source: "",
  source_type: "channel" as EndpointType,
  destination: "",
  destination_type: "channel" as EndpointType,
  include_keywords: "",
  exclude_keywords: "",
};

function RulesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [form, setForm] = useState(empty);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forwarding_rules")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Rule[];
    },
  });

  const { data: channels = [] } = useQuery({
    queryKey: ["channels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("telegram_channels")
        .select("chat_id, title, username, kind")
        .order("title", { ascending: true });
      if (error) throw error;
      return data as Channel[];
    },
  });


  const save = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Not signed in");
      const payload = {
        user_id: uid,
        name: form.name || null,
        source: form.source.trim(),
        source_type: form.source_type,
        destination: form.destination.trim(),
        destination_type: form.destination_type,
        include_keywords: splitKw(form.include_keywords),
        exclude_keywords: splitKw(form.exclude_keywords),
      };
      if (editing) {
        const { error } = await supabase.from("forwarding_rules").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("forwarding_rules").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rules"] });
      setOpen(false);
      setEditing(null);
      setForm(empty);
      toast.success(editing ? "Rule updated" : "Rule created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase.from("forwarding_rules").update({ enabled }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rules"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("forwarding_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rules"] });
      toast.success("Rule deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }
  function openEdit(r: Rule) {
    setEditing(r);
    setForm({
      name: r.name ?? "",
      source: r.source,
      source_type: r.source_type,
      destination: r.destination,
      destination_type: r.destination_type,
      include_keywords: r.include_keywords.join(", "),
      exclude_keywords: r.exclude_keywords.join(", "),
    });
    setOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Forwarding rules</h1>
          <p className="text-sm text-muted-foreground">
            Route messages from any source to any destination.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" /> New rule
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit rule" : "New rule"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name (optional)</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="News mirror" />
              </div>
              <EndpointPicker
                label="Source"
                channels={channels}
                value={form.source}
                type={form.source_type}
                onValueChange={(v) => setForm({ ...form, source: v })}
                onTypeChange={(v) => setForm({ ...form, source_type: v })}
                placeholder="@channel or -100123..."
              />
              <EndpointPicker
                label="Destination"
                channels={channels}
                value={form.destination}
                type={form.destination_type}
                onValueChange={(v) => setForm({ ...form, destination: v })}
                onTypeChange={(v) => setForm({ ...form, destination_type: v })}
                placeholder="@mychannel or @mybot"
              />

              <div className="space-y-2">
                <Label>Include keywords (optional, comma-separated)</Label>
                <Input value={form.include_keywords} onChange={(e) => setForm({ ...form, include_keywords: e.target.value })} placeholder="bitcoin, launch" />
              </div>
              <div className="space-y-2">
                <Label>Exclude keywords (optional, comma-separated)</Label>
                <Input value={form.exclude_keywords} onChange={(e) => setForm({ ...form, exclude_keywords: e.target.value })} placeholder="ad, promo" />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => save.mutate()}
                disabled={save.isPending || !form.source.trim() || !form.destination.trim()}
              >
                {save.isPending ? "Saving…" : "Save rule"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rules.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No rules yet</CardTitle>
            <CardDescription>Create your first forwarding rule to get started.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rules.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
                <div className="min-w-0 space-y-1">
                  {r.name && <p className="font-medium text-foreground">{r.name}</p>}
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant="secondary">{r.source_type}</Badge>
                    <span className="font-mono text-foreground">{r.source}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="secondary">{r.destination_type}</Badge>
                    <span className="font-mono text-foreground">{r.destination}</span>
                  </div>
                  {(r.include_keywords.length > 0 || r.exclude_keywords.length > 0) && (
                    <p className="text-xs text-muted-foreground">
                      {r.include_keywords.length > 0 && <>include: {r.include_keywords.join(", ")} </>}
                      {r.exclude_keywords.length > 0 && <>· exclude: {r.exclude_keywords.join(", ")}</>}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={r.enabled}
                    onCheckedChange={(v) => toggle.mutate({ id: r.id, enabled: v })}
                  />
                  <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove.mutate(r.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

const MANUAL = "__manual__";

function EndpointPicker({
  label,
  channels,
  value,
  type,
  onValueChange,
  onTypeChange,
  placeholder,
}: {
  label: string;
  channels: Channel[];
  value: string;
  type: EndpointType;
  onValueChange: (v: string) => void;
  onTypeChange: (v: EndpointType) => void;
  placeholder: string;
}) {
  // Selected channel identifier matches a synced channel when its username/id equals value.
  const match = channels.find((c) => (c.username ? `@${c.username}` : c.chat_id) === value);
  const selectValue = match ? (match.username ? `@${match.username}` : match.chat_id) : value ? MANUAL : "";

  return (
    <div className="grid grid-cols-[1fr_auto] items-end gap-2">
      <div className="space-y-2">
        <Label>{label}</Label>
        {channels.length > 0 ? (
          <Select
            value={selectValue}
            onValueChange={(v) => {
              if (v === MANUAL) {
                onValueChange("");
                return;
              }
              const c = channels.find((ch) => (ch.username ? `@${ch.username}` : ch.chat_id) === v);
              onValueChange(v);
              if (c) onTypeChange(c.kind === "bot" ? "bot" : "channel");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Pick a channel" />
            </SelectTrigger>
            <SelectContent>
              {channels.map((c) => {
                const id = c.username ? `@${c.username}` : c.chat_id;
                return (
                  <SelectItem key={id} value={id}>
                    {c.title}
                  </SelectItem>
                );
              })}
              <SelectItem value={MANUAL}>Type manually…</SelectItem>
            </SelectContent>
          </Select>
        ) : null}
        {(channels.length === 0 || selectValue === MANUAL) && (
          <Input
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            placeholder={placeholder}
          />
        )}
      </div>
      <TypeSelect value={type} onChange={onTypeChange} />
    </div>
  );
}

function TypeSelect({ value, onChange }: { value: EndpointType; onChange: (v: EndpointType) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as EndpointType)}>
      <SelectTrigger className="w-28">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="channel">Channel</SelectItem>
        <SelectItem value="bot">Bot</SelectItem>
      </SelectContent>
    </Select>
  );
}

function splitKw(s: string): string[] {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}
