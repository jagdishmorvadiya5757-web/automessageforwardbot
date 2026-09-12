import { createFileRoute } from "@tanstack/react-router";
import { requireMasterToken, resolveWorkerUser } from "@/integrations/supabase/worker-auth.server";

type HeartbeatBody = {
  version?: string;
  active_clients?: number;
  queued_messages?: number;
};

// POST /api/public/worker/heartbeat — external worker signals it is alive.
export const Route = createFileRoute("/api/public/worker/heartbeat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await resolveWorkerUser(request, { requireUserId: false });
        const isMaster = auth?.isMaster || (await requireMasterToken(request));
        if (!auth && !isMaster) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let body: HeartbeatBody = {};
        try {
          body = (await request.json()) as HeartbeatBody;
        } catch {
          body = {};
        }
        const now = new Date().toISOString();

        if (isMaster) {
          const { error } = await supabaseAdmin.from("worker_health").upsert({
            id: 1,
            last_heartbeat: now,
            version: body.version ?? null,
            active_clients: Math.max(0, Number(body.active_clients) || 0),
            queued_messages: Math.max(0, Number(body.queued_messages) || 0),
            detail: "Multi-user worker connected",
            updated_at: now,
          }, { onConflict: "id" });
          if (error) return new Response(error.message, { status: 500 });
        } else if (auth?.userId) {
          const { error } = await supabaseAdmin
            .from("worker_tokens")
            .update({ last_heartbeat: now })
            .eq("user_id", auth.userId);
          if (error) return new Response(error.message, { status: 500 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
