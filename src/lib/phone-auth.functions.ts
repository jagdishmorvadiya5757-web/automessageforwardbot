import { createServerFn } from "@tanstack/react-start";

// Phone + Telegram OTP sign-in for regular users.
//  - "otp" mode: number not connected yet -> Telegram sends its official login
//    code; signing in also connects the Telegram account for forwarding.
//  - "saved" mode: number already connected -> the worker sends a one-time
//    website code to the user's Telegram "Saved Messages". The live Telegram
//    session (and its forwarding) is never touched.

type Mode = "otp" | "saved";
type Ticket = { uid: string; phone: string; mode: Mode; iat: number };

const TICKET_TTL = 15 * 60;

function normPhone(raw: string) {
  const phone = raw.replace(/[\s()-]/g, "");
  if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
    throw new Error("Enter a valid phone number with country code, e.g. +919876543210");
  }
  return phone;
}

async function secretOrThrow() {
  const s = process.env["ORACLE_JWT_SECRET"];
  if (!s) throw new Error("Sign-in is not configured yet.");
  return s;
}

async function readTicket(ticket: string): Promise<Ticket> {
  const { verifySupabaseJwt } = await import("./direct-auth.server");
  const c = verifySupabaseJwt(ticket, await secretOrThrow()) as Record<string, unknown> | null;
  if (!c || c.typ !== "ff_phone_login" || typeof c.uid !== "string") {
    throw new Error("This sign-in attempt expired. Please start again.");
  }
  return { uid: c.uid, phone: c.phone as string, mode: c.mode as Mode, iat: c.iat as number };
}

async function sha(text: string) {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(text).digest("hex");
}

async function issueSession(t: Ticket) {
  const { buildUserSession } = await import("./direct-auth.server");
  return buildUserSession({ userId: t.uid, phone: t.phone, name: t.phone }, await secretOrThrow());
}

export const startPhoneSignIn = createServerFn({ method: "POST" })
  .inputValidator((input: { phone: string }) => ({ phone: normPhone(input.phone) }))
  .handler(async ({ data }) => {
    const secret = await secretOrThrow();
    const { signTicket } = await import("./direct-auth.server");
    const { randomInt } = await import("node:crypto");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // The Oracle DB has no auth.users table, so accounts are resolved from the
    // app's own tables (Telegram session/auth rows) and created directly.
    const digits = data.phone.replace(/\D/g, "");
    const variants = [data.phone, digits];
    let userId: string | null = null;
    const { data: sesRow } = await supabaseAdmin
      .from("telegram_sessions")
      .select("user_id, status")
      .in("phone" as never, variants as never)
      .order("updated_at", { ascending: false })
      .limit(5);
    const rows = (sesRow ?? []) as { user_id: string; status: string }[];
    userId = (rows.find((r) => r.status === "logged_in") ?? rows[0])?.user_id ?? null;
    if (!userId) {
      const { data: authRow } = await supabaseAdmin
        .from("telegram_auth")
        .select("user_id")
        .in("phone" as never, variants as never)
        .limit(1)
        .maybeSingle();
      userId = (authRow as { user_id: string } | null)?.user_id ?? null;
    }
    if (!userId) {
      userId = crypto.randomUUID();
      const name = "+" + digits;
      const steps = [
        supabaseAdmin.from("profiles").insert({ id: userId, display_name: name } as never),
        supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "user" } as never),
        supabaseAdmin.from("subscriptions").insert({
          user_id: userId,
          plan: "trial",
          trial_ends_at: new Date(Date.now() + 3 * 864e5).toISOString(),
          is_active: true,
        } as never),
        supabaseAdmin.from("wallets").insert({ user_id: userId, balance: 0 } as never),
      ];
      for (const step of steps) {
        const { error } = await step;
        if (error) {
          console.error("phone signup create failed", error.message);
          throw new Error("Could not start sign-in right now. Please try again shortly.");
        }
      }
    }

    const { data: prev } = await supabaseAdmin
      .from("telegram_auth")
      .select("updated_at, pending_action")
      .eq("user_id", userId)
      .maybeSingle();
    if (prev?.pending_action && Date.now() - new Date(prev.updated_at).getTime() < 30_000) {
      throw new Error("A code was just requested. Please wait 30 seconds.");
    }

    const { data: ses } = await supabaseAdmin
      .from("telegram_sessions")
      .select("status, session_ciphertext")
      .eq("user_id", userId)
      .maybeSingle();
    const mode: Mode = ses?.status === "logged_in" && ses.session_ciphertext ? "saved" : "otp";

    if (mode === "saved") {
      const code = String(randomInt(100000, 1000000));
      const { error: upErr } = await supabaseAdmin
        .from("telegram_auth")
        .update({
          pending_action: "send_web_code",
          code,
          phone_code_hash: await sha(`${userId}:${code}`),
          detail: null,
        } as never)
        .eq("user_id", userId);
      if (upErr) throw new Error(upErr.message);
    } else {
      const { error: upErr } = await supabaseAdmin.from("telegram_auth").upsert(
        {
          user_id: userId,
          phone: data.phone,
          status: "code_requested",
          pending_action: "request_code",
          code: null,
          two_fa_password: null,
          phone_code_hash: null,
          detail: null,
        } as never,
        { onConflict: "user_id" },
      );
      if (upErr) throw new Error(upErr.message);
    }

    const ticket = signTicket(
      { typ: "ff_phone_login", uid: userId, phone: data.phone, mode },
      secret,
      TICKET_TTL,
    );
    return { ticket, mode };
  });

export const checkPhoneSignIn = createServerFn({ method: "POST" })
  .inputValidator((input: { ticket: string }) => input)
  .handler(async ({ data }) => {
    const t = await readTicket(data.ticket);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: a } = await supabaseAdmin
      .from("telegram_auth")
      .select("status, pending_action, detail")
      .eq("user_id", t.uid)
      .maybeSingle();

    if (t.mode === "otp") {
      const { data: s } = await supabaseAdmin
        .from("telegram_sessions")
        .select("status, session_ciphertext, updated_at")
        .eq("user_id", t.uid)
        .maybeSingle();
      const fresh =
        s?.status === "logged_in" &&
        !!s.session_ciphertext &&
        new Date(s.updated_at).getTime() >= t.iat * 1000 - 5_000;
      if (fresh) return { state: "done" as const, session: await issueSession(t) };
    }

    const status = a?.status ?? "logged_out";
    if (t.mode === "saved") {
      if (a?.pending_action === "send_web_code") return { state: "sending" as const };
      if (a?.detail === "web_code_sent") return { state: "awaiting_code" as const };
      return { state: "error" as const, detail: a?.detail ?? "Could not send the code." };
    }
    if (status === "awaiting_code") return { state: "awaiting_code" as const };
    if (status === "password_needed") return { state: "password_needed" as const };
    if (status === "error") return { state: "error" as const, detail: a?.detail ?? "Telegram error" };
    return { state: "sending" as const };
  });

export const submitPhoneCode = createServerFn({ method: "POST" })
  .inputValidator((input: { ticket: string; code: string }) => {
    const code = input.code.replace(/\D/g, "");
    if (code.length < 4 || code.length > 8) throw new Error("Enter the code you received.");
    return { ticket: input.ticket, code };
  })
  .handler(async ({ data }) => {
    const t = await readTicket(data.ticket);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (t.mode === "saved") {
      const { data: a } = await supabaseAdmin
        .from("telegram_auth")
        .select("phone_code_hash")
        .eq("user_id", t.uid)
        .maybeSingle();
      const expected = a?.phone_code_hash ?? "";
      // One attempt per code: always burn it.
      await supabaseAdmin
        .from("telegram_auth")
        .update({ phone_code_hash: null, detail: null } as never)
        .eq("user_id", t.uid);
      if (!expected || expected !== (await sha(`${t.uid}:${data.code}`))) {
        throw new Error("Wrong code. Please request a new one.");
      }
      return { state: "done" as const, session: await issueSession(t) };
    }

    const { error } = await supabaseAdmin
      .from("telegram_auth")
      .update({ code: data.code, pending_action: "submit_code", detail: null } as never)
      .eq("user_id", t.uid);
    if (error) throw new Error(error.message);
    return { state: "verifying" as const };
  });

export const submitPhonePassword = createServerFn({ method: "POST" })
  .inputValidator((input: { ticket: string; password: string }) => {
    if (!input.password) throw new Error("Enter your Telegram 2-step password.");
    return input;
  })
  .handler(async ({ data }) => {
    const t = await readTicket(data.ticket);
    if (t.mode !== "otp") throw new Error("Not needed for this sign-in.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("telegram_auth")
      .update({ two_fa_password: data.password, pending_action: "submit_password", detail: null } as never)
      .eq("user_id", t.uid);
    if (error) throw new Error(error.message);
    return { state: "verifying" as const };
  });
