import { createFileRoute } from "@tanstack/react-router";
import { requireMasterToken, resolveWorkerUser } from "@/integrations/supabase/worker-auth.server";

// POST /api/public/worker/heartbeat — external worker signals it is alive.
export const Route = createFileRoute("/api/public/worker/heartbeat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await resolveWorkerUser(request, { requireUserId: false });
        const isMaster = auth?.isMaster || (await requireMasterToken(request));
        if (!auth && !isMaster) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const query = supabaseAdmin
          .from("worker_tokens")
          .update({ last_heartbeat: new Date().toISOString() });
        const { error } = auth?.userId ? await query.eq("user_id", auth.userId) : await query;
        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ ok: true });
      },
    },
  },
});
