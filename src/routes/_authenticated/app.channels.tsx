import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listChannels, requestChannelSync, type ChannelRow } from "@/lib/rules.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { toast } from "sonner";
import { RefreshCw, Radio, Users, Bot, Search } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/app/channels")({
  component: ChannelsPage,
});

const KIND_ICON: Record<string, typeof Radio> = {
  channel: Radio,
  group: Users,
  bot: Bot,
};

function ChannelsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const listChannelsFn = useServerFn(listChannels);
  const requestChannelSyncFn = useServerFn(requestChannelSync);

  const { data: channels = [], isLoading } = useQuery({
    queryKey: ["channels"],
    queryFn: (): Promise<ChannelRow[]> => listChannelsFn({}),
  });

  const resync = useMutation({
    mutationFn: () => requestChannelSyncFn({}),
    onSuccess: () => {
      toast.success("Sync requested — channels will refresh automatically");
      window.setTimeout(() => qc.invalidateQueries({ queryKey: ["channels"] }), 6000);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = channels.filter(
    (c) =>
      c.title.toLowerCase().includes(q.toLowerCase()) ||
      (c.username ?? "").toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Channels</h1>
          <p className="text-sm text-muted-foreground">
            Chats your connected account has joined. Used as source/destination options.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            resync.mutate();
          }}
          disabled={resync.isPending}
        >
          <RefreshCw className="mr-2 h-4 w-4" /> Resync
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search channels…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : channels.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No channels synced yet</CardTitle>
            <CardDescription>
              Connect your Telegram account first, then the worker will sync your joined channels here.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-2">
          {filtered.map((c) => {
            const Icon = KIND_ICON[c.kind] ?? Radio;
            return (
              <Card key={c.id}>
                <CardContent className="flex items-center justify-between gap-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{c.title}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {c.username ? `@${c.username}` : c.chat_id}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{c.kind}</Badge>
                    {c.can_post && <Badge>can post</Badge>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
