import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { directAdminLogin } from "@/lib/direct-auth.functions";
import {
  checkPhoneSignIn,
  startPhoneSignIn,
  submitPhoneCode,
  submitPhonePassword,
} from "@/lib/phone-auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Send } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · ForwardFlow" },
      { name: "description", content: "Sign in with your phone and Telegram code to manage auto-forwarding." },
      { property: "og:title", content: "Sign in · ForwardFlow" },
      { property: "og:description", content: "Access your Telegram auto-forwarding dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function saveSessionAndGo(session: unknown) {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const ref = url ? new URL(url).hostname.split(".")[0] : null;
  if (!ref) throw new Error("Session storage is unavailable in this browser.");
  window.localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(session));
  toast.success("Welcome!");
  window.location.href = "/app";
}

function AuthPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-gradient-to-b from-brand-soft via-background to-background px-4 py-8">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2 text-foreground">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-brand-foreground">
            <Send className="h-5 w-5" />
          </span>
          <span className="text-xl font-semibold">ForwardFlow</span>
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Sign in or create account</CardTitle>
            <CardDescription>
              New here? Enter your Telegram number — you get a free 3-day trial instantly.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="phone">
              <TabsList className="mb-4 grid w-full grid-cols-2">
                <TabsTrigger value="phone">Phone</TabsTrigger>
                <TabsTrigger value="admin">Admin</TabsTrigger>
              </TabsList>
              <TabsContent value="phone">
                <PhoneSignIn />
              </TabsContent>
              <TabsContent value="admin">
                <AdminSignIn />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

type Step = "phone" | "sending" | "code" | "password" | "verifying";

function PhoneSignIn() {
  const start = useServerFn(startPhoneSignIn);
  const check = useServerFn(checkPhoneSignIn);
  const sendCode = useServerFn(submitPhoneCode);
  const sendPassword = useServerFn(submitPhonePassword);

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("+91");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"otp" | "saved">("otp");
  const [busy, setBusy] = useState(false);
  const ticket = useRef<string | null>(null);

  // Poll while waiting on the worker.
  useEffect(() => {
    if (step !== "sending" && step !== "verifying") return;
    let stop = false;
    const startedAt = Date.now();
    const tick = async () => {
      if (stop || !ticket.current) return;
      try {
        const r = await check({ data: { ticket: ticket.current } });
        if (stop) return;
        if (r.state === "done") return saveSessionAndGo(r.session);
        if (r.state === "awaiting_code" && step === "sending") return setStep("code");
        if (r.state === "password_needed") return setStep("password");
        if (r.state === "error" && "detail" in r) {
          toast.error(r.detail);
          return setStep(step === "verifying" ? (mode === "otp" ? "code" : "phone") : "phone");
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong");
        return setStep("phone");
      }
      if (Date.now() - startedAt > 90_000) {
        toast.error("Telegram is taking too long. Please try again.");
        return setStep("phone");
      }
      setTimeout(tick, 2000);
    };
    const t = setTimeout(tick, 1500);
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [step, mode, check]);

  async function onPhone(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await start({ data: { phone } });
      ticket.current = r.ticket;
      setMode(r.mode);
      setCode("");
      setStep("sending");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send code");
    } finally {
      setBusy(false);
    }
  }

  async function onCode(e: React.FormEvent) {
    e.preventDefault();
    if (!ticket.current) return;
    setBusy(true);
    try {
      const r = await sendCode({ data: { ticket: ticket.current, code } });
      if (r.state === "done") return saveSessionAndGo(r.session);
      setStep("verifying");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Wrong code");
      if (mode === "saved") setStep("phone");
    } finally {
      setBusy(false);
    }
  }

  async function onPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!ticket.current) return;
    setBusy(true);
    try {
      await sendPassword({ data: { ticket: ticket.current, password } });
      setPassword("");
      setStep("verifying");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not verify");
    } finally {
      setBusy(false);
    }
  }

  if (step === "sending" || step === "verifying") {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        {step === "sending" ? "Sending code to your Telegram…" : "Verifying…"}
      </p>
    );
  }

  if (step === "code") {
    return (
      <form onSubmit={onCode} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {mode === "otp"
            ? "Telegram sent a login code to your Telegram app (chat named “Telegram”)."
            : "We sent a code to your Telegram “Saved Messages”."}
        </p>
        <div className="space-y-2">
          <Label htmlFor="otp">Code</Label>
          <Input
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full bg-brand text-brand-foreground hover:bg-brand/90" disabled={busy}>
          {busy ? "Checking…" : "Verify & sign in"}
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={() => setStep("phone")}>
          Change number
        </Button>
      </form>
    );
  }

  if (step === "password") {
    return (
      <form onSubmit={onPassword} className="space-y-4">
        <p className="text-sm text-muted-foreground">Your Telegram has 2-step verification. Enter that password.</p>
        <div className="space-y-2">
          <Label htmlFor="tg-pw">Telegram password</Label>
          <Input id="tg-pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" className="w-full bg-brand text-brand-foreground hover:bg-brand/90" disabled={busy}>
          {busy ? "Checking…" : "Continue"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={onPhone} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="phone">Telegram phone number</Label>
        <Input
          id="phone"
          type="tel"
          autoComplete="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+919876543210"
        />
      </div>
      <Button type="submit" className="w-full bg-brand text-brand-foreground hover:bg-brand/90" disabled={busy}>
        {busy ? "Sending…" : "Send code on Telegram"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Signing in also connects this Telegram account for forwarding.
      </p>
    </form>
  );
}

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
