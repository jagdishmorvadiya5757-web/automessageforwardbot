import { createFileRoute } from "@tanstack/react-router";
import { requireMasterToken } from "@/integrations/supabase/worker-auth.server";

// GET /api/public/worker/users
// Multi-user worker calls this every N seconds to learn which users it must
// currently service. Returns active subscribers that either already have a
// Telegram session OR are in the middle of first-time Telegram login.
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

        // Admins can always connect Telegram, including the direct-admin recovery
        // account which may not have received a signup-triggered subscription row.
        const { data: adminRows, error: adminErr } = await supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");
        if (adminErr) return new Response(adminErr.message, { status: 500 });
        for (const row of adminRows ?? []) activeUserIds.add(row.user_id);

        // Existing saved sessions for those users.
        const { data: sessions, error: sesErr } = await supabaseAdmin
          .from("telegram_sessions")
          .select("user_id, phone, status");
        if (sesErr) return new Response(sesErr.message, { status: 500 });

        const byUser = new Map<
          string,
          { user_id: string; phone: string | null; status: string; pending: boolean }
        >();

        for (const s of sessions ?? []) {
          if (!activeUserIds.has(s.user_id)) continue;
          byUser.set(s.user_id, {
            user_id: s.user_id,
            phone: s.phone,
            status: s.status,
            pending: s.status !== "logged_in",
          });
        }

        // First-time logins have no saved session yet, but the worker must still
        // spawn them so it can request/send the Telegram OTP.
        const { data: authRows, error: authErr } = await supabaseAdmin
          .from("telegram_auth")
          .select("user_id, phone, status, pending_action")
          .not("pending_action", "is", null);
        if (authErr) return new Response(authErr.message, { status: 500 });

        for (const a of authRows ?? []) {
          if (!activeUserIds.has(a.user_id)) continue;
          const existing = byUser.get(a.user_id);
          if (existing) {
            // A queued action (logout / sync_channels / re-login) needs fast polling.
            existing.pending = true;
            continue;
          }
          byUser.set(a.user_id, {
            user_id: a.user_id,
            phone: a.phone,
            status: a.status,
            pending: true,
          });
        }

        const users = [...byUser.values()];

        return Response.json({ users });

      },
    },
  },
});
