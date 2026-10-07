import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { directAdminLogin } from "@/lib/direct-auth.functions";
import { saveSessionAndGo } from "./auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/ff-control-7q9x")({
  head: () => ({
    meta: [
      { title: "Restricted · ForwardFlow" },
      { name: "description", content: "Restricted area." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Restricted · ForwardFlow" },
      { property: "og:description", content: "Restricted area." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader><CardTitle>Admin sign in</CardTitle></CardHeader>
        <CardContent><AdminSignIn /></CardContent>
      </Card>
    </div>
  ),
});

function AdminSignIn() {
  const login = useServerFn(directAdminLogin);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const session = await login({ data: { email, password } });
      saveSessionAndGo(session);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSignIn} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="si-email">Email</Label>
        <Input id="si-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="si-pw">Password</Label>
        <Input id="si-pw" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <Button type="submit" className="w-full bg-brand text-brand-foreground hover:bg-brand/90" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
