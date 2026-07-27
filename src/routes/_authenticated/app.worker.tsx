import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMasterWorkerToken, getWorkerStatus } from "@/lib/worker.functions";
import { amIAdmin } from "@/lib/license.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, KeyRound, Circle, Eye } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/worker")({
  component: WorkerPage,
  head: () => ({
    meta: [
      { title: "Worker — ForwardFlow" },
      { name: "description", content: "Admin-only worker deployment and master token." },
      { property: "og:title", content: "Worker — ForwardFlow" },
      { property: "og:description", content: "Admin-only worker deployment and master token." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function WorkerPage() {
  const adminFn = useServerFn(amIAdmin);
  const statusFn = useServerFn(getWorkerStatus);
  const tokenFn = useServerFn(getMasterWorkerToken);
  const [masterToken, setMasterToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: adminInfo, isLoading: adminLoading } = useQuery({
    queryKey: ["am-i-admin"],
    queryFn: () => adminFn(),
    staleTime: 5 * 60_000,
  });

  const { data: status } = useQuery({
    queryKey: ["worker-status"],
    queryFn: () => statusFn({}),
    refetchInterval: 20000,
    enabled: !!adminInfo?.isAdmin,
  });

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }

  async function reveal() {
    setLoading(true);
    try {
      const res = await tokenFn({});
      setMasterToken(res.token);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (adminLoading) return null;

  if (!adminInfo?.isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Not available</CardTitle>
          <CardDescription>
            The forwarding engine is fully managed. You only need to connect Telegram on the
            Telegram page — no worker setup required.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Worker (admin)</h1>
        <p className="text-sm text-muted-foreground">
          One shared worker process serves every subscribed user. It authenticates with the master
          token below.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Connection status</CardTitle>
            <CardDescription>
              {status?.lastHeartbeat
                ? `Last seen ${new Date(status.lastHeartbeat).toLocaleString()}`
                : "No heartbeat received yet"}
            </CardDescription>
          </div>
          <Badge variant={status?.online ? "default" : "secondary"} className="gap-1">
            <Circle className={`h-2 w-2 fill-current ${status?.online ? "text-green-400" : ""}`} />
            {status?.online ? "Online" : "Offline"}
          </Badge>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Master worker token
          </CardTitle>
          <CardDescription>
            Shared secret for the multi-user worker. Keep it private — anyone holding it can act for
            all users.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {masterToken ? (
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded bg-muted px-2 py-1 font-mono text-sm">
                {masterToken}
              </code>
              <Button size="icon" variant="outline" onClick={() => copy(masterToken)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button onClick={reveal} disabled={loading}>
              <Eye className="mr-2 h-4 w-4" />
              {loading ? "Loading…" : "Reveal master token"}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Deploy on Oracle (24×7)</CardTitle>
          <CardDescription>Run once on your Always-Free Ubuntu VM.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
            <li>
              SSH into the VM, then <code className="rounded bg-muted px-1">cd ~/worker</code> and{" "}
              <code className="rounded bg-muted px-1">git pull</code> to get the latest worker.
            </li>
            <li>
              Edit <code className="rounded bg-muted px-1">nano .env</code> and paste the values
              below (WORKER_TOKEN = the master token).
            </li>
            <li>
              <code className="rounded bg-muted px-1">pip install -r requirements.txt</code>
            </li>
            <li>
              Restart the service:{" "}
              <code className="rounded bg-muted px-1">sudo systemctl restart forwardflow</code>{" "}
              then{" "}
              <code className="rounded bg-muted px-1">
                journalctl -u forwardflow -f
              </code>{" "}
              to watch the logs.
            </li>
            <li>Users log in from the Telegram page — no per-user setup on the server.</li>
          </ol>
          <div className="rounded-md bg-muted p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">.env values</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  copy(
                    `API_BASE_URL=${baseUrl}\nWORKER_TOKEN=${masterToken ?? "<reveal master token above>"}\nTG_API_ID=<from my.telegram.org>\nTG_API_HASH=<from my.telegram.org>\nPOLL_INTERVAL=30\nLOGIN_POLL_INTERVAL=3\nUSERS_POLL_INTERVAL=20`,
                  )
                }
              >
                <Copy className="mr-1 h-3 w-3" /> Copy
              </Button>
            </div>
            <pre className="overflow-x-auto font-mono text-xs text-foreground">
{`API_BASE_URL=${baseUrl}
WORKER_TOKEN=${masterToken ?? "<reveal master token above>"}
TG_API_ID=<from my.telegram.org>
TG_API_HASH=<from my.telegram.org>
POLL_INTERVAL=30
LOGIN_POLL_INTERVAL=3
USERS_POLL_INTERVAL=20`}
            </pre>
          </div>
          <p className="text-xs text-muted-foreground">
            Sessions are stored encrypted in the database, so the worker can be redeployed or moved
            without anyone logging in to Telegram again.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
