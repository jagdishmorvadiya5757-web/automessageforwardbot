import { createFileRoute } from "@tanstack/react-router";
import { resolveWorkerUser } from "@/integrations/supabase/worker-auth.server";

// GET /api/public/worker/rules — external worker pulls enabled rules for its user.
export const Route = createFileRoute("/api/public/worker/rules")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await resolveWorkerUser(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("forwarding_rules")
          .select(
            "id, name, source, source_type, destination, destination_type, enabled, include_keywords, exclude_keywords",
          )
          .eq("user_id", auth.userId)
          .eq("enabled", true);

        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ rules: data ?? [] });
      },
    },
  },
});
