import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { resolveWorkerUser } from "@/integrations/supabase/worker-auth.server";
import { decryptSession, encryptSession } from "@/integrations/supabase/session-crypto.server";

const postSchema = z.object({
  session_string: z.string().min(1).max(20000),
  phone: z.string().max(32).optional(),
});

// GET  /api/public/worker/session  -> returns decrypted session string (worker
//                                     needs it in memory to reconnect on restart)
// POST /api/public/worker/session  -> worker saves an updated session string
// DELETE                            -> clears session (user logged out)
export const Route = createFileRoute("/api/public/worker/session")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await resolveWorkerUser(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("telegram_sessions")
          .select("session_ciphertext, phone, status")
          .eq("user_id", auth.userId)
          .maybeSingle();
        if (error) return new Response(error.message, { status: 500 });

        let session: string | null = null;
        if (data?.session_ciphertext) {
          try {
            session = decryptSession(data.session_ciphertext);
          } catch {
            return new Response("Session decrypt failed", { status: 500 });
          }
        }
        return Response.json({
          session_string: session,
          phone: data?.phone ?? null,
          status: data?.status ?? "logged_out",
        });
      },

      POST: async ({ request }) => {
        const auth = await resolveWorkerUser(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });
        const parsed = postSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Bad request", { status: 400 });

        const ct = encryptSession(parsed.data.session_string);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.from("telegram_sessions").upsert(
          {
            user_id: auth.userId,
            session_ciphertext: ct,
            phone: parsed.data.phone ?? null,
            status: "logged_in",
          },
          { onConflict: "user_id" },
        );
        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ ok: true });
      },

      DELETE: async ({ request }) => {
        const auth = await resolveWorkerUser(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.from("telegram_sessions").upsert(
          { user_id: auth.userId, session_ciphertext: null, status: "logged_out" },
          { onConflict: "user_id" },
        );
        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ ok: true });
      },
    },
  },
});
