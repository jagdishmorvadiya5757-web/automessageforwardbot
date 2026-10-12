import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  checkPhoneSignIn,
  startPhoneSignIn,
  submitPhoneCode,
  submitPhonePassword,
} from "@/lib/phone-auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

const COUNTRIES = [
  { code: "IN", name: "India", dial: "+91", flag: "🇮🇳" },
  { code: "US", name: "United States", dial: "+1", flag: "🇺🇸" },
  { code: "GB", name: "United Kingdom", dial: "+44", flag: "🇬🇧" },
  { code: "AE", name: "UAE", dial: "+971", flag: "🇦🇪" },
  { code: "SA", name: "Saudi Arabia", dial: "+966", flag: "🇸🇦" },
  { code: "PK", name: "Pakistan", dial: "+92", flag: "🇵🇰" },
  { code: "BD", name: "Bangladesh", dial: "+880", flag: "🇧🇩" },
  { code: "NP", name: "Nepal", dial: "+977", flag: "🇳🇵" },
  { code: "LK", name: "Sri Lanka", dial: "+94", flag: "🇱🇰" },
  { code: "NG", name: "Nigeria", dial: "+234", flag: "🇳🇬" },
  { code: "ID", name: "Indonesia", dial: "+62", flag: "🇮🇩" },
  { code: "PH", name: "Philippines", dial: "+63", flag: "🇵🇭" },
  { code: "BR", name: "Brazil", dial: "+55", flag: "🇧🇷" },
  { code: "RU", name: "Russia", dial: "+7", flag: "🇷🇺" },
  { code: "DE", name: "Germany", dial: "+49", flag: "🇩🇪" },
  { code: "FR", name: "France", dial: "+33", flag: "🇫🇷" },
  { code: "TR", name: "Turkey", dial: "+90", flag: "🇹🇷" },
  { code: "CA", name: "Canada", dial: "+1", flag: "🇨🇦" },
  { code: "AU", name: "Australia", dial: "+61", flag: "🇦🇺" },
];
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export function saveSessionAndGo(session: unknown) {
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
            <PhoneSignIn />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

type Step = "phone" | "code" | "password" | "verifying";

function PhoneSignIn() {
  const start = useServerFn(startPhoneSignIn);
  const check = useServerFn(checkPhoneSignIn);
  const sendCode = useServerFn(submitPhoneCode);
  const sendPassword = useServerFn(submitPhonePassword);

  const [step, setStep] = useState<Step>("phone");
  const [country, setCountry] = useState("IN");
  const [local, setLocal] = useState("");
  const dial = COUNTRIES.find((c) => c.code === country)?.dial ?? "+91";
  const phone = `${dial}${local.replace(/\D/g, "")}`;
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"otp" | "saved">("otp");
  const [busy, setBusy] = useState(false);
  const ticket = useRef<string | null>(null);

  // Poll in the background while the code box is already visible.
  useEffect(() => {
    if (step !== "code" && step !== "verifying") return;
    let stop = false;
    const startedAt = Date.now();
    const tick = async () => {
      if (stop || !ticket.current) return;
      try {
        const r = await check({ data: { ticket: ticket.current } });
        if (stop) return;
        if (r.state === "done") return saveSessionAndGo(r.session);
        if (r.state === "password_needed") return setStep("password");
        if (r.state === "error" && "detail" in r) {
          // Keep the code box open: the code may already have been delivered.
          toast.error(r.detail);
          if (mode === "saved") return setStep("phone");
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong");
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
      setStep("code");
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

  if (step === "verifying") {
    return <p className="py-6 text-center text-sm text-muted-foreground">Verifying…</p>;
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
        <Label>Country</Label>
        <Select value={country} onValueChange={setCountry}>
          <SelectTrigger aria-label="Country"><SelectValue /></SelectTrigger>
          <SelectContent>
            {COUNTRIES.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.flag} {c.name} ({c.dial})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Telegram phone number</Label>
        <div className="flex items-center gap-2">
          <span className="flex h-9 shrink-0 items-center rounded-md border bg-muted px-3 text-sm text-muted-foreground">{dial}</span>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            required
            value={local}
            onChange={(e) => setLocal(e.target.value.replace(/[^\d\s]/g, ""))}
            placeholder="98765 43210"
          />
        </div>
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
