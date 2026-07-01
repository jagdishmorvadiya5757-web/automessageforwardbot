import { createFileRoute } from "@tanstack/react-router";
import { resolveWorkerUser } from "@/integrations/supabase/worker-auth.server";

// POST /api/public/worker/heartbeat — external worker signals it is alive.
export const Route = createFileRoute("/api/public/worker/heartbeat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await resolveWorkerUser(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin
          .from("worker_tokens")
          .update({ last_heartbeat: new Date().toISOString() })
          .eq("user_id", auth.userId);
        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ ok: true });
      },
    },
  },
});
