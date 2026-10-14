import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

// POST /api/public/razorpay/webhook — Razorpay calls this after a payment.
// Signature is verified with RAZORPAY_WEBHOOK_SECRET; the paid amount is
// matched against the plans table (price), the payer's phone to the account.
const PAID_EVENTS = new Set([
  "payment.captured",
  "order.paid",
  "payment_link.paid",
  "subscription.charged",
]);

function verify(body: string, signature: string, secret: string) {
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

const toPaise = (price: string) => {
  const n = Number(String(price).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : -1;
};

export const Route = createFileRoute("/api/public/razorpay/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!secret) return new Response("Webhook not configured", { status: 500 });

        const body = await request.text();
        const signature = request.headers.get("x-razorpay-signature") ?? "";
        if (!signature || !verify(body, signature, secret)) {
          return new Response("Bad signature", { status: 401 });
        }

        let event: any;
        try {
          event = JSON.parse(body);
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }
        if (!PAID_EVENTS.has(event?.event)) return Response.json({ ignored: event?.event });

        const payment = event?.payload?.payment?.entity;
        if (!payment?.id) return Response.json({ ignored: "no payment" });

        const amount = Number(payment.amount ?? 0);
        const notes = { ...(event?.payload?.subscription?.entity?.notes ?? {}), ...(payment.notes ?? {}) };
        const phone = String(payment.contact || notes.phone || notes.mobile || notes.contact || "");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: plans } = await supabaseAdmin
          .from("plans")
          .select("slug, price, plan, duration_days")
          .order("sort_order", { ascending: true });
        const match = (plans ?? []).find((p: any) => toPaise(p.price) === amount);
        if (!match) {
          console.error("[razorpay] no plan matches amount", amount);
          return Response.json({ ok: false, reason: "amount does not match any plan" });
        }

        const { data, error } = await (supabaseAdmin as any).rpc("activate_paid_plan", {
          _event_id: payment.id,
          _phone: phone,
          _plan: match.plan,
          _days: match.duration_days,
          _amount: amount,
          _raw: event,
        });
        if (error) {
          console.error("[razorpay] activate failed", error.message);
          return new Response("Activation failed", { status: 500 });
        }
        const row = Array.isArray(data) ? data[0] : data;
        return Response.json({ ok: !!row?.success, message: row?.message ?? null });
      },
    },
  },
});
