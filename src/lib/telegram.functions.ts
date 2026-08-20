import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/lib/oracle-auth-middleware";

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

export const requestTelegramCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { phone: string }) => {
    const phone = input.phone.replace(/\s/g, "");
    if (!/^\+[1-9]\d{6,14}$/.test(phone)) throw new Error("Enter a valid phone number with country code.");
    return { phone };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("telegram_auth").upsert(
      {
        user_id: context.userId,
        phone: data.phone,
        status: "code_requested",
        pending_action: "request_code",
        code: null,
        two_fa_password: null,
        phone_code_hash: null,
        detail: null,
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const submitTelegramCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => {
    const code = input.code.replace(/\s/g, "");
    if (!/^\d{4,8}$/.test(code)) throw new Error("Enter the Telegram verification code.");
    return { code };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("telegram_auth")
      .update({ code: data.code, pending_action: "submit_code", detail: null })
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const submitTelegramPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { password: string }) => {
    if (!input.password || input.password.length > 256) throw new Error("Enter your Telegram two-step password.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("telegram_auth")
      .update({ two_fa_password: data.password, pending_action: "submit_password", detail: null })
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const disconnectTelegram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("telegram_auth")
      .update({ pending_action: "logout", status: "code_requested", detail: null, phone_code_hash: null })
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });