import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { resolveWorkerUser } from "@/integrations/supabase/worker-auth.server";

const slotSchema = z.object({
  rule_id: z.string().uuid(),
  action: z.enum(["reserve", "release"]),
});

// POST /api/public/worker/forward-slots — reserve/release a counted forwarding slot.
export const Route = createFileRoute("/api/public/worker/forward-slots")({
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

        const parsed = slotSchema.safeParse(body);
        if (!parsed.success) return new Response("Invalid payload", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const fn = parsed.data.action === "reserve" ? "reserve_forwarding_slot" : "release_forwarding_slot";
        const { data, error } = await supabaseAdmin.rpc(fn, {
          _rule_id: parsed.data.rule_id,
          _user_id: auth.userId,
        });

        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ ok: true, result: data?.[0] ?? null });
      },
    },
  },
});