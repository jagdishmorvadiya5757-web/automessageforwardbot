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
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, ArrowRight, RotateCcw, Check, ChevronsUpDown } from "lucide-react";

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
  forwarded_count: number;
  max_forward_count: number | null;
  forward_delay: number;
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
  max_forward_count: "",
  forward_delay: "",
};

function RulesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [form, setForm] = useState(empty);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "newest" | "oldest" | "active" | "deactivated">("all");

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
    refetchInterval: 2000,
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
        max_forward_count: parseLimit(form.max_forward_count),
        forward_delay: parseDelay(form.forward_delay),
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

  const resetCount = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("forwarding_rules")
        .update({ forwarded_count: 0, enabled: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rules"] });
      toast.success("Counter reset");
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
      max_forward_count: r.max_forward_count?.toString() ?? "",
      forward_delay: r.forward_delay ? r.forward_delay.toString() : "",
    });
    setOpen(true);
  }

  const totals = rules.reduce(
    (acc, rule) => {
      acc.forwarded += rule.forwarded_count;
      if (rule.enabled) acc.active += 1;
      return acc;
    },
    { forwarded: 0, active: 0 },
  );

  const q = query.trim().toLowerCase();
  const visible = rules
    .filter((r) => {
      if (filter === "active" && !r.enabled) return false;
      if (filter === "deactivated" && r.enabled) return false;
      if (!q) return true;
      return (
        (r.name ?? "").toLowerCase().includes(q) ||
        r.source.toLowerCase().includes(q) ||
        r.destination.toLowerCase().includes(q)
      );
    });
  // rules arrive newest-first from the query
  if (filter === "oldest") visible.reverse();


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
                onValueChange={(v) => setForm((f) => ({ ...f, source: v }))}
                onTypeChange={(v) => setForm((f) => ({ ...f, source_type: v }))}
                placeholder="@channel or -100123..."
              />
              <EndpointPicker
                label="Destination"
                channels={channels}
                value={form.destination}
                type={form.destination_type}
                onValueChange={(v) => setForm((f) => ({ ...f, destination: v }))}
                onTypeChange={(v) => setForm((f) => ({ ...f, destination_type: v }))}
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
              <div className="space-y-2">
                <Label>Forward limit (optional)</Label>
                <Input
                  inputMode="numeric"
                  min={1}
                  type="number"
                  value={form.max_forward_count}
                  onChange={(e) => setForm({ ...form, max_forward_count: e.target.value })}
                  placeholder="50"
                />
              </div>
              <div className="space-y-2">
                <Label>Delay between forwards (optional, seconds)</Label>
                <Input
                  inputMode="decimal"
                  min={0}
                  step="0.1"
                  type="number"
                  value={form.forward_delay}
                  onChange={(e) => setForm({ ...form, forward_delay: e.target.value })}
                  placeholder="e.g. 0.5, 2, 5"
                />
                <p className="text-xs text-muted-foreground">
                  Wait this many seconds after each forward for this rule. Leave empty for no delay.
                </p>
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

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Forwarded total</p>
            <p className="text-2xl font-semibold text-foreground">{totals.forwarded}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Active rules</p>
            <p className="text-2xl font-semibold text-foreground">{totals.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Limited rules</p>
            <p className="text-2xl font-semibold text-foreground">
              {rules.filter((rule) => rule.max_forward_count !== null).length}
            </p>
          </CardContent>
        </Card>
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
              <CardContent className="flex flex-wrap items-center justify-between gap-4 px-4 py-4">
                <div className="min-w-0 flex-1 space-y-1">
                  {r.name && <p className="font-medium text-foreground">{r.name}</p>}
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant="secondary">{r.source_type}</Badge>
                    <span className="break-all font-mono text-foreground">{r.source}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <Badge variant="secondary">{r.destination_type}</Badge>
                    <span className="break-all font-mono text-foreground">{r.destination}</span>
                  </div>
                  {(r.include_keywords.length > 0 || r.exclude_keywords.length > 0) && (
                    <p className="text-xs text-muted-foreground">
                      {r.include_keywords.length > 0 && <>include: {r.include_keywords.join(", ")} </>}
                      {r.exclude_keywords.length > 0 && <>· exclude: {r.exclude_keywords.join(", ")}</>}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">
                      {r.forwarded_count}{r.max_forward_count ? ` / ${r.max_forward_count}` : ""} forwarded
                    </Badge>
                    {r.max_forward_count && r.forwarded_count >= r.max_forward_count && (
                      <Badge variant="secondary">auto off</Badge>
                    )}
                    {r.forward_delay > 0 && (
                      <Badge variant="outline">{r.forward_delay}s delay</Badge>
                    )}

                  </div>
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
                  <Switch
                    checked={r.enabled}
                    onCheckedChange={(v) => toggle.mutate({ id: r.id, enabled: v })}
                  />
                  <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button aria-label="Reset counter" title="Reset counter" variant="ghost" size="icon" onClick={() => resetCount.mutate(r.id)}>
                    <RotateCcw className="h-4 w-4" />
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
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState(false);

  // Selected channel identifier matches a synced channel when its username/id equals value.
  const match = channels.find((c) => (c.username ? `@${c.username}` : c.chat_id) === value);
  const showManual = channels.length === 0 || manual || (!!value && !match);

  return (
    <div className="grid grid-cols-[1fr_auto] items-end gap-2">
      <div className="space-y-2">
        <Label>{label}</Label>
        {channels.length > 0 ? (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-between font-normal"
              >
                <span className="truncate">
                  {match ? match.title : value ? value : "Pick a channel"}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search channel…" />
                <CommandList>
                  <CommandEmpty>No channel found.</CommandEmpty>
                  <CommandGroup>
                    {channels.map((c) => {
                      const id = c.username ? `@${c.username}` : c.chat_id;
                      return (
                        <CommandItem
                          key={id}
                          value={`${c.title} ${id}`}
                          onSelect={() => {
                            onValueChange(id);
                            onTypeChange(c.kind === "bot" ? "bot" : "channel");
                            setManual(false);
                            setOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              value === id ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <span className="truncate">{c.title}</span>
                          <span className="ml-auto truncate pl-2 text-xs text-muted-foreground">{id}</span>
                        </CommandItem>
                      );
                    })}
                    <CommandItem
                      value="__type-manually__"
                      onSelect={() => {
                        onValueChange("");
                        setManual(true);
                        setOpen(false);
                      }}
                    >
                      <Check className="mr-2 h-4 w-4 opacity-0" />
                      Type manually…
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        ) : null}
        {showManual && (
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

function parseLimit(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseDelay(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
