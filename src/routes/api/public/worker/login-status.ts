import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { resolveWorkerUser } from "@/integrations/supabase/worker-auth.server";

const bodySchema = z.object({
  status: z.enum([
    "logged_out",
    "code_requested",
    "awaiting_code",
    "password_needed",
    "logged_in",
    "error",
  ]),
  detail: z.string().max(500).optional(),
  pending_action: z.string().max(50).nullable().optional(),
  phone_code_hash: z.string().max(500).nullable().optional(),
});

// POST /api/public/worker/login-status
// The worker reports login progress. Secrets (code, 2FA password) are always
// cleared here because the worker has just consumed them.
export const Route = createFileRoute("/api/public/worker/login-status")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await resolveWorkerUser(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });

        const parsed = bodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Bad request", { status: 400 });

        const shouldClearCodeHash = parsed.data.status === "logged_in" || parsed.data.status === "logged_out";
        const updatePayload: Record<string, string | null> = {
          status: parsed.data.status,
          detail: parsed.data.detail ?? null,
          pending_action: parsed.data.pending_action ?? null,
          code: null,
          two_fa_password: null,
        };

        if (parsed.data.phone_code_hash !== undefined) {
          updatePayload.phone_code_hash = parsed.data.phone_code_hash;
        } else if (shouldClearCodeHash) {
          updatePayload.phone_code_hash = null;
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin
          .from("telegram_auth")
          .update(updatePayload as never)
          .eq("user_id", auth.userId);

        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ ok: true });
      },
    },
  },
});
