import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getTelegramConnectionState, type TelegramConnectionState } from "@/lib/telegram.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Phone, KeyRound, ShieldCheck, LogOut, RefreshCw, Circle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/login")({
  component: TelegramLoginPage,
});

const STATUS_LABEL: Record<string, string> = {
  logged_out: "Not connected",
  code_requested: "Requesting code…",
  awaiting_code: "Code sent — enter it below",
  password_needed: "Two-step password required",
  logged_in: "Connected",
  error: "Error",
};

function TelegramLoginPage() {
  const qc = useQueryClient();
  const fetchTelegramState = useServerFn(getTelegramConnectionState);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");

  const { data: state } = useQuery({
    queryKey: ["telegram-auth"],
    queryFn: (): Promise<TelegramConnectionState> => fetchTelegramState({}),
    refetchInterval: 2500,
  });

  const status = state?.status ?? "logged_out";

  async function uid() {
    const { data } = await supabase.auth.getUser();
    const id = data.user?.id;
    if (!id) throw new Error("Not signed in");
    return id;
  }

  const requestCode = useMutation({
    mutationFn: async () => {
      const id = await uid();
      const { error } = await supabase.from("telegram_auth").upsert(
        {
          user_id: id,
          phone: phone.trim(),
          status: "code_requested",
          pending_action: "request_code",
          code: null,
          two_fa_password: null,
          detail: null,
        },
        { onConflict: "user_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["telegram-auth"] });
      toast.success("Sent to worker — check your Telegram app for the code");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitCode = useMutation({
    mutationFn: async () => {
      const id = await uid();
      const { error } = await supabase
        .from("telegram_auth")
        .update({ code: code.trim(), pending_action: "submit_code", detail: null })
        .eq("user_id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setCode("");
      qc.invalidateQueries({ queryKey: ["telegram-auth"] });
      toast.success("Code submitted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitPassword = useMutation({
    mutationFn: async () => {
      const id = await uid();
      const { error } = await supabase
        .from("telegram_auth")
        .update({ two_fa_password: password, pending_action: "submit_password", detail: null })
        .eq("user_id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setPassword("");
      qc.invalidateQueries({ queryKey: ["telegram-auth"] });
      toast.success("Password submitted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const logout = useMutation({
    mutationFn: async () => {
      const id = await uid();
      const { error } = await supabase
        .from("telegram_auth")
        .update({ pending_action: "logout", status: "code_requested", detail: null })
        .eq("user_id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["telegram-auth"] });
      toast.success("Disconnect requested");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const connected = status === "logged_in";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Telegram account</h1>
        <p className="text-sm text-muted-foreground">
          Connect your Telegram number so the worker can read the channels you've joined.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Status</CardTitle>
            <CardDescription>
              {STATUS_LABEL[status] ?? status}
              {state?.phone ? ` · ${state.phone}` : ""}
            </CardDescription>
          </div>
          <Badge
            variant={connected ? "outline" : "secondary"}
            className={connected ? "gap-1 border-transparent bg-success text-success-foreground" : "gap-1"}
          >
            <Circle className="h-2 w-2 fill-current" />
            {connected ? "Connected" : "Offline"}
          </Badge>
        </CardHeader>
        {state?.detail && status === "error" && (
          <CardContent>
            <p className="text-sm text-destructive">{state.detail}</p>
          </CardContent>
        )}
      </Card>

      {connected ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Account connected
            </CardTitle>
            <CardDescription>
              Your worker is logged in. Go to Channels to sync and pick sources & destinations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => logout.mutate()} disabled={logout.isPending}>
              <LogOut className="mr-2 h-4 w-4" /> Disconnect account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-4 w-4" /> 1. Phone number
              </CardTitle>
              <CardDescription>Include your country code, e.g. +14155552671.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>Phone number</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 415 555 2671"
                  inputMode="tel"
                />
              </div>
              <Button
                onClick={() => requestCode.mutate()}
                disabled={requestCode.isPending || !phone.trim()}
              >
                {status === "code_requested" ? (
                  <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Waiting for worker…</>
                ) : (
                  "Send code"
                )}
              </Button>
            </CardContent>
          </Card>

          {(status === "awaiting_code" ||
            status === "password_needed" ||
            status === "code_requested" ||
            status === "error") && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4" /> 2. Verification code
                </CardTitle>
                <CardDescription>Enter the code Telegram sent to your app.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label>Code</Label>
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="12345"
                    inputMode="numeric"
                  />
                </div>
                <Button onClick={() => submitCode.mutate()} disabled={submitCode.isPending || !code.trim()}>
                  Submit code
                </Button>
              </CardContent>
            </Card>
          )}

          {status === "password_needed" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" /> 3. Two-step password
                </CardTitle>
                <CardDescription>Your account has two-step verification enabled.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your 2FA password"
                  />
                </div>
                <Button
                  onClick={() => submitPassword.mutate()}
                  disabled={submitPassword.isPending || !password}
                >
                  Submit password
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
