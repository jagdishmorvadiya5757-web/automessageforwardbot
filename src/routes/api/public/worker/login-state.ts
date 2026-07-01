import { createFileRoute } from "@tanstack/react-router";
import { resolveWorkerUser } from "@/integrations/supabase/worker-auth.server";

// GET /api/public/worker/login-state
// The worker polls this to learn whether it should request a code, submit a
// code, submit a 2FA password, or log out — plus the secrets the user entered.
export const Route = createFileRoute("/api/public/worker/login-state")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await resolveWorkerUser(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("telegram_auth")
          .select("status, pending_action, phone, code, two_fa_password")
          .eq("user_id", auth.userId)
          .maybeSingle();

        if (error) return new Response(error.message, { status: 500 });
        return Response.json(
          data ?? { status: "logged_out", pending_action: null, phone: null, code: null, two_fa_password: null },
        );
      },
    },
  },
});
