import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { resolveWorkerUser } from "@/integrations/supabase/worker-auth.server";

const channelSchema = z.object({
  chat_id: z.string().min(1).max(64),
  title: z.string().min(1).max(256),
  username: z.string().max(64).nullable().optional(),
  kind: z.enum(["channel", "group", "bot"]).default("channel"),
  can_post: z.boolean().default(false),
});

const bodySchema = z.object({
  channels: z.array(channelSchema).max(2000),
});

// POST /api/public/worker/channels
// The worker pushes the list of chats the user has joined so the dashboard can
// offer them as source/destination dropdown choices.
export const Route = createFileRoute("/api/public/worker/channels")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await resolveWorkerUser(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });

        const parsed = bodySchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Bad request", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const rows = parsed.data.channels.map((c) => ({
          user_id: auth.userId,
          chat_id: c.chat_id,
          title: c.title,
          username: c.username ?? null,
          kind: c.kind,
          can_post: c.can_post,
        }));

        if (rows.length > 0) {
          const { error } = await supabaseAdmin
            .from("telegram_channels")
            .upsert(rows, { onConflict: "user_id,chat_id" });
          if (error) return new Response(error.message, { status: 500 });
        }

        return Response.json({ ok: true, count: rows.length });
      },
    },
  },
});
