import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { resolveWorkerUser } from "@/integrations/supabase/worker-auth.server";

const logSchema = z.object({
  rule_id: z.string().uuid().nullable().optional(),
  source_msg_ref: z.string().max(500).nullable().optional(),
  status: z.enum(["forwarded", "skipped", "error", "waiting"]),
  detail: z.string().max(2000).nullable().optional(),
});

// POST /api/public/worker/logs — external worker reports a forwarding result.
export const Route = createFileRoute("/api/public/worker/logs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await resolveWorkerUser(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const parsed = logSchema.safeParse(body);
        if (!parsed.success) return new Response("Invalid payload", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.from("forwarding_logs").insert({
          user_id: auth.userId,
          rule_id: parsed.data.rule_id ?? null,
          source_msg_ref: parsed.data.source_msg_ref ?? null,
          status: parsed.data.status,
          detail: parsed.data.detail ?? null,
        });
        if (error) return new Response(error.message, { status: 500 });

        // Count every forwarded message server-side so the dashboard total is
        // always accurate regardless of the worker version. Auto-disables the
        // rule once its limit is reached.
        if (parsed.data.status === "forwarded" && parsed.data.rule_id) {
          await supabaseAdmin.rpc("record_forwarded_count", {
            _rule_id: parsed.data.rule_id,
            _user_id: auth.userId,
          });
        }

        return Response.json({ ok: true });
      },
    },
  },
});
