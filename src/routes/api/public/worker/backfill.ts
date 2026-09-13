import { createFileRoute } from "@tanstack/react-router";
import { resolveWorkerUser } from "@/integrations/supabase/worker-auth.server";

// POST /api/public/worker/backfill — worker reports history backfill progress.
export const Route = createFileRoute("/api/public/worker/backfill")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await resolveWorkerUser(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });

        const body = (await request.json().catch(() => null)) as
          | {
              rule_id?: string;
              status?: string;
              done_count?: number;
              detail?: string | null;
            }
          | null;
        if (!body?.rule_id) return new Response("rule_id required", { status: 400 });

        const patch: Record<string, unknown> = {};
        if (body.status) patch.backfill_status = body.status;
        if (typeof body.done_count === "number") patch.backfill_done_count = body.done_count;
        if (body.detail !== undefined) patch.backfill_detail = body.detail;
        if (Object.keys(patch).length === 0) return Response.json({ ok: true });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await (supabaseAdmin.from("forwarding_rules") as any)
          .update(patch)
          .eq("id", body.rule_id)
          .eq("user_id", auth.userId);
        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ ok: true });
      },
    },
  },
});
