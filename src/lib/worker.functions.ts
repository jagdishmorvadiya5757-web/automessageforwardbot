import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Generates a fresh worker token for the current user, stores only its hash,
 * and returns the plaintext token exactly once (never stored in plaintext).
 */
export const generateWorkerToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { randomBytes, createHash } = await import("crypto");
    const pepper = process.env.WORKER_TOKEN_PEPPER;
    if (!pepper) throw new Error("Server not configured");

    const token = `wtk_${randomBytes(24).toString("base64url")}`;
    const tokenHash = createHash("sha256").update(pepper + token).digest("hex");
    const preview = `${token.slice(0, 12)}…${token.slice(-4)}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("worker_tokens")
      .upsert(
        {
          user_id: context.userId,
          token_hash: tokenHash,
          token_preview: preview,
          last_heartbeat: null,
        },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);

    return { token, preview };
  });

/** Returns metadata about the current user's worker token (never the token itself). */
export const getWorkerStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("worker_tokens")
      .select("token_preview, last_heartbeat, created_at")
      .eq("user_id", context.userId)
      .maybeSingle();

    const online =
      !!data?.last_heartbeat &&
      Date.now() - new Date(data.last_heartbeat).getTime() < 120_000;

    return {
      hasToken: !!data,
      preview: data?.token_preview ?? null,
      lastHeartbeat: data?.last_heartbeat ?? null,
      online,
    };
  });
