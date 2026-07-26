import { createFileRoute } from "@tanstack/react-router";
import { requireMasterToken } from "@/integrations/supabase/worker-auth.server";

// GET /api/public/worker/users
// Multi-user worker calls this every N seconds to learn which users it must
// currently service. Returns: users with active subscription (trial or paid)
// AND a logged-in Telegram session ciphertext.
export const Route = createFileRoute("/api/public/worker/users")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!(await requireMasterToken(request))) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Subscriptions that are active right now
        const nowIso = new Date().toISOString();
        const { data: subs, error: subErr } = await supabaseAdmin
          .from("subscriptions")
          .select("user_id, plan, trial_ends_at, subscription_ends_at, is_active");
        if (subErr) return new Response(subErr.message, { status: 500 });

        const activeUserIds = new Set(
          (subs ?? [])
            .filter((s) => {
              if (!s.is_active) return false;
              if (s.plan === "trial") return !!s.trial_ends_at && s.trial_ends_at > nowIso;
              if (s.plan === "pro" || s.plan === "business") {
                return !s.subscription_ends_at || s.subscription_ends_at > nowIso;
              }
              return false;
            })
            .map((s) => s.user_id),
        );

        // Sessions for those users
        const { data: sessions, error: sesErr } = await supabaseAdmin
          .from("telegram_sessions")
          .select("user_id, phone, status");
        if (sesErr) return new Response(sesErr.message, { status: 500 });

        const users = (sessions ?? [])
          .filter((s) => activeUserIds.has(s.user_id))
          .map((s) => ({
            user_id: s.user_id,
            phone: s.phone,
            status: s.status,
          }));

        return Response.json({ users });
      },
    },
  },
});
