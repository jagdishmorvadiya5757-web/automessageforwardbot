import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { generateWorkerToken, getWorkerStatus } from "@/lib/worker.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, KeyRound, Circle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/worker")({
  component: WorkerPage,
});

function WorkerPage() {
  const generateFn = useServerFn(generateWorkerToken);
  const statusFn = useServerFn(getWorkerStatus);
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const { data: status, refetch } = useQuery({
    queryKey: ["worker-status"],
    queryFn: () => statusFn({}),
    refetchInterval: 20000,
  });

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  async function generate() {
    setGenerating(true);
    try {
      const res = await generateFn({});
      setFreshToken(res.token);
      await refetch();
      toast.success("New worker token generated");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Worker</h1>
        <p className="text-sm text-muted-foreground">
          The forwarding engine runs on your own always-on machine and connects here with a token.
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
            <KeyRound className="h-4 w-4" /> Worker token
          </CardTitle>
          <CardDescription>
            {status?.hasToken
              ? `Current token: ${status.preview}. Generating a new one replaces it.`
              : "Generate a token, then paste it into your worker's .env file."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {freshToken && (
            <div className="rounded-md border border-primary/40 bg-primary/5 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Copy this now — it won't be shown again:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 overflow-x-auto rounded bg-muted px-2 py-1 font-mono text-sm">
                  {freshToken}
                </code>
                <Button size="icon" variant="outline" onClick={() => copy(freshToken)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
          <Button onClick={generate} disabled={generating}>
            {generating ? "Generating…" : status?.hasToken ? "Regenerate token" : "Generate token"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Set up your worker</CardTitle>
          <CardDescription>Run these steps once on any always-on machine (VPS, Railway, Fly.io, Raspberry Pi).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <ol className="list-decimal space-y-3 pl-5 text-muted-foreground">
            <li>Get your <span className="text-foreground">API ID</span> and <span className="text-foreground">API Hash</span> from <a className="text-primary underline" href="https://my.telegram.org" target="_blank" rel="noreferrer">my.telegram.org</a>.</li>
            <li>Download the <code className="rounded bg-muted px-1">worker/</code> folder from your project repo.</li>
            <li>Copy <code className="rounded bg-muted px-1">.env.example</code> to <code className="rounded bg-muted px-1">.env</code> and fill in the values below.</li>
            <li>Run <code className="rounded bg-muted px-1">pip install -r requirements.txt</code> then <code className="rounded bg-muted px-1">python main.py</code> and complete the one-time phone login.</li>
            <li>Keep it running with systemd / pm2 / a screen session.</li>
          </ol>
          <div className="rounded-md bg-muted p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">.env values</span>
              <Button size="sm" variant="ghost" onClick={() => copy(`API_BASE_URL=${baseUrl}\nWORKER_TOKEN=<paste-your-token>\nTG_API_ID=<from my.telegram.org>\nTG_API_HASH=<from my.telegram.org>\nPOLL_INTERVAL=30`)}>
                <Copy className="mr-1 h-3 w-3" /> Copy
              </Button>
            </div>
            <pre className="overflow-x-auto font-mono text-xs text-foreground">
{`API_BASE_URL=${baseUrl}
WORKER_TOKEN=<paste-your-token>
TG_API_ID=<from my.telegram.org>
TG_API_HASH=<from my.telegram.org>
POLL_INTERVAL=30`}
            </pre>
          </div>
          <p className="text-xs text-muted-foreground">
            Note: the worker logs into Telegram with your personal account (userbot) so it can read
            any channel you can see — no bot admin required in source channels. Automated forwarding
            can violate Telegram's Terms of Service; use an account you're comfortable risking.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
