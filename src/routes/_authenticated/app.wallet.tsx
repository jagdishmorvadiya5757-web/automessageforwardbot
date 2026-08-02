import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getWallet, listTransactions, transferCredits } from "@/lib/wallet.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Wallet, ArrowUpRight, ArrowDownLeft, Send } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/wallet")({
  component: WalletPage,
  head: () => ({
    meta: [
      { title: "Wallet — ForwardFlow" },
      { name: "description", content: "Your credit balance, transaction history and transfers." },
      { property: "og:title", content: "Wallet — ForwardFlow" },
      { property: "og:description", content: "Your credit balance, transaction history and transfers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const KIND_LABEL: Record<string, string> = {
  checkin: "Daily check-in",
  referral: "Referral bonus",
  referral_signup: "Referral signup",
  transfer_in: "Received",
  transfer_out: "Sent",
  admin_grant: "Admin adjustment",
};

function label(kind: string) {
  if (kind.startsWith("mission:")) return "Mission reward";
  return KIND_LABEL[kind] ?? kind;
}

function WalletPage() {
  const qc = useQueryClient();
  const walletFn = useServerFn(getWallet);
  const txFn = useServerFn(listTransactions);
  const transferFn = useServerFn(transferCredits);

  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  const { data: wallet } = useQuery({ queryKey: ["wallet"], queryFn: () => walletFn({}) });
  const { data: txs = [] } = useQuery({ queryKey: ["wallet-txs"], queryFn: () => txFn({}) });

  async function send() {
    const value = Number(amount);
    if (!Number.isInteger(value) || value <= 0) return toast.error("Enter a whole number of credits");
    setSending(true);
    try {
      const res = await transferFn({ data: { toUserId: to.trim(), amount: value, note: note || undefined } });
      if (!res.success) toast.error(res.message);
      else {
        toast.success(`Sent ${value} credits`);
        setTo("");
        setAmount("");
        setNote("");
        qc.invalidateQueries({ queryKey: ["wallet"] });
        qc.invalidateQueries({ queryKey: ["wallet-txs"] });
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Wallet</h1>
        <p className="text-sm text-muted-foreground">
          Credits earned from check-ins, missions and referrals.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="bg-primary/5">
          <CardContent className="flex items-center gap-4 py-5">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Wallet className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Available balance</p>
              <p className="text-3xl font-semibold text-foreground">{wallet?.balance ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-5">
            <p className="text-xs text-muted-foreground">Lifetime earned</p>
            <p className="text-3xl font-semibold text-foreground">{wallet?.lifetimeEarned ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="h-4 w-4" /> Transfer credits
          </CardTitle>
          <CardDescription>
            Send credits to another account. Ask them for their account ID (shown on their Home tab).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Recipient account ID</Label>
            <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="50" />
            </div>
            <div className="space-y-2">
              <Label>Note (optional)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Thanks!" />
            </div>
          </div>
          <Button onClick={send} disabled={sending || !to.trim() || !amount}>
            {sending ? "Sending…" : "Send credits"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transaction history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {txs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            txs.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      t.amount >= 0 ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {t.amount >= 0 ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{label(t.kind)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t.note ? `${t.note} · ` : ""}
                      {new Date(t.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <Badge variant={t.amount >= 0 ? "default" : "secondary"} className="shrink-0">
                  {t.amount >= 0 ? "+" : ""}
                  {t.amount}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
