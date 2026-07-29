import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { claimLicenseKey } from "@/lib/plans.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Copy, KeyRound, Send } from "lucide-react";

export const Route = createFileRoute("/claim")({
  component: ClaimPage,
  head: () => ({
    meta: [
      { title: "Claim your license key — ForwardFlow" },
      {
        name: "description",
        content:
          "Enter the claim code you received after payment to instantly generate your ForwardFlow license key.",
      },
      { property: "og:title", content: "Claim your license key — ForwardFlow" },
      {
        property: "og:description",
        content: "Turn your purchase claim code into a ForwardFlow license key.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ClaimPage() {
  const claimFn = useServerFn(claimLicenseKey);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ key: string; plan: string; days: number } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    try {
      const res = await claimFn({ data: { code: code.trim() } });
      if (res.success && res.licenseCode) {
        setResult({
          key: res.licenseCode,
          plan: String(res.plan ?? ""),
          days: Number(res.durationDays ?? 0),
        });
        await navigator.clipboard.writeText(res.licenseCode).catch(() => {});
        toast.success("License key generated and copied");
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
    <div className="min-h-svh bg-background">
      <header className="mx-auto flex w-full max-w-3xl items-center gap-2 px-4 py-4 font-semibold text-foreground">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Send className="h-4 w-4" />
        </span>
        ForwardFlow
      </header>

      <main className="mx-auto w-full max-w-lg px-4 pb-16 pt-6 sm:pt-12">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Claim your license key</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Paid already? Enter the claim code from your purchase confirmation and your license key
          is generated instantly.
        </p>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Claim code</CardTitle>
            <CardDescription>Each code can only be used the number of times it was issued for.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label htmlFor="claim">Code</Label>
                <Input
                  id="claim"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="PRO-2026"
                  autoCapitalize="characters"
                />
              </div>
              <Button type="submit" disabled={busy} className="sm:w-auto">
                <KeyRound className="mr-2 h-4 w-4" />
                {busy ? "Generating…" : "Generate key"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {result && (
          <Card className="mt-4 border-primary/40">
            <CardHeader>
              <CardTitle className="text-base">Your license key</CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-2">
                <Badge className="capitalize">{result.plan}</Badge>
                <span>{result.days} days</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
                <code className="min-w-0 flex-1 truncate font-mono text-sm font-medium">
                  {result.key}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => {
                    navigator.clipboard.writeText(result.key);
                    toast.success("Copied");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Save this key now — it is shown only once. Activate it under Plan &amp; License in
                your dashboard.
              </p>
              <Button asChild className="w-full sm:w-auto">
                <Link to="/app/plan">Go to Plan &amp; License</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
