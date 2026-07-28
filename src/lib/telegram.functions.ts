import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TelegramConnectionState = {
  status: string;
  pending_action: string | null;
  phone: string | null;
  detail: string | null;
};

export const getTelegramConnectionState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TelegramConnectionState> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: authRow, error: authError } = await supabaseAdmin
      .from("telegram_auth")
      .select("status, pending_action, phone, detail")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (authError) throw new Error(authError.message);

    const { data: sessionRow, error: sessionError } = await supabaseAdmin
      .from("telegram_sessions")
      .select("status, phone, session_ciphertext")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (sessionError) throw new Error(sessionError.message);

    if (sessionRow?.status === "logged_in" && sessionRow.session_ciphertext) {
      return {
        status: "logged_in",
        pending_action: null,
        phone: sessionRow.phone ?? authRow?.phone ?? null,
        detail: null,
      };
    }

    return {
      status: authRow?.status ?? "logged_out",
      pending_action: authRow?.pending_action ?? null,
      phone: authRow?.phone ?? sessionRow?.phone ?? null,
      detail: authRow?.detail ?? null,
    };
  });