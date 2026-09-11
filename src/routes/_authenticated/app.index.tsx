import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  deleteRule,
  listChannels,
  listRules,
  resetRuleCounter,
  saveRule,
  setRuleEnabled,
  type ChannelRow,
  type EndpointType,
  type RuleRow,
} from "@/lib/rules.functions";
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
import { Plus, Trash2, Pencil, ArrowRight, RotateCcw, Check, ChevronsUpDown, Search, Sparkles } from "lucide-react";

type Rule = RuleRow;
type Channel = ChannelRow;

export const Route = createFileRoute("/_authenticated/app/")({
  component: RulesPage,
});

const MODIFIERS = [
  "Add header",
  "Add footer",
  "Replace text",
  "Translate language",
  "Watermark",
  "AI mode",
  "Link buttons",
  "Duplicate filter",
  "Crypto mode",
  "Anti-forward bypass",
  "Auto join invite links",
  "Paid reactions",
  "Dialog broadcast",
  "Smart image crop",
  "Paid media protection",
];

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
  schedule_enabled: false,
  schedule_start: "09:00",
  schedule_end: "18:00",
  schedule_days: [] as number[],
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function RulesPage() {
  const qc = useQueryClient();
  const listRulesFn = useServerFn(listRules);
  const listChannelsFn = useServerFn(listChannels);
  const saveRuleFn = useServerFn(saveRule);
  const setRuleEnabledFn = useServerFn(setRuleEnabled);
  const deleteRuleFn = useServerFn(deleteRule);
  const resetRuleCounterFn = useServerFn(resetRuleCounter);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [form, setForm] = useState(empty);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "newest" | "oldest" | "active" | "deactivated">("all");

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["rules"],
    queryFn: (): Promise<Rule[]> => listRulesFn({}),
    refetchInterval: 2000,
  });

  const { data: channels = [] } = useQuery({
    queryKey: ["channels"],
    queryFn: (): Promise<Channel[]> => listChannelsFn({}),
  });


  const save = useMutation({
    mutationFn: () =>
      saveRuleFn({
        data: {
        id: editing?.id ?? null,
        name: form.name || null,
        source: form.source.trim(),
        source_type: form.source_type,
        destination: form.destination.trim(),
        destination_type: form.destination_type,
        include_keywords: splitKw(form.include_keywords),
        exclude_keywords: splitKw(form.exclude_keywords),
        max_forward_count: parseLimit(form.max_forward_count),
        forward_delay: parseDelay(form.forward_delay),
        },
      }),
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
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      setRuleEnabledFn({ data: { id, enabled } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rules"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteRuleFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rules"] });
      toast.success("Rule deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetCount = useMutation({
    mutationFn: (id: string) => resetRuleCounterFn({ data: { id } }),
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
                <Label>Allow words (optional, comma-separated)</Label>
                <Input value={form.include_keywords} onChange={(e) => setForm({ ...form, include_keywords: e.target.value })} placeholder="bitcoin, launch" />
                <p className="text-xs text-muted-foreground">Only messages containing one of these words are forwarded.</p>
              </div>
              <div className="space-y-2">
                <Label>Blocking words (optional, comma-separated)</Label>
                <Input value={form.exclude_keywords} onChange={(e) => setForm({ ...form, exclude_keywords: e.target.value })} placeholder="ad, promo" />
                <p className="text-xs text-muted-foreground">Messages containing any of these words are never forwarded.</p>
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

              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                  <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                  <p className="truncate text-sm font-medium">Content modifiers & filters</p>
                  <Badge variant="secondary" className="shrink-0">Soon</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {MODIFIERS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toast.info(`${m} is coming soon`)}
                      className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent"
                    >
                      {m}
                    </button>
                  ))}
                </div>
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

      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, source ID or target ID"
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(["all", "newest", "oldest", "active", "deactivated"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                filter === f
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : visible.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{rules.length === 0 ? "No rules yet" : "No matching rules"}</CardTitle>
            <CardDescription>
              {rules.length === 0
                ? "Create your first forwarding rule to get started."
                : "Try another search term or filter."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-3">
          {visible.map((r) => (

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
                      {r.include_keywords.length > 0 && <>allow: {r.include_keywords.join(", ")} </>}
                      {r.exclude_keywords.length > 0 && <>· blocking: {r.exclude_keywords.join(", ")}</>}
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
