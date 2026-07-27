import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type LicenseKeyRow = {
  id: string;
  code: string;
  plan: "trial" | "pro" | "business" | "expired";
  duration_days: number;
  note: string | null;
  redeemed_by: string | null;
  redeemed_at: string | null;
  created_at: string;
  redeemed_by_name?: string | null;
};

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden");
}

/** Is the current user an admin? Used to show/hide the admin nav. */
export const amIAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { isAdmin: !!data };
  });

/** Redeem a license key for the signed-in user. */
export const redeemLicenseKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ code: z.string().min(4).max(64) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("redeem_license_key", {
      _code: data.code,
      _user_id: context.userId,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(rows) ? rows[0] : rows;
    return {
      success: !!row?.success,
      message: row?.message ?? "Unknown error",
      plan: row?.plan ?? null,
      endsAt: row?.ends_at ?? null,
    };
  });

/** Admin: list all license keys. */
export const listLicenseKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LicenseKeyRow[]> => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("license_keys")
      .select("id, code, plan, duration_days, note, redeemed_by, redeemed_at, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const ids = [...new Set((data ?? []).map((k) => k.redeemed_by).filter(Boolean))] as string[];
    let names: Record<string, string | null> = {};
    if (ids.length) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, display_name")
        .in("id", ids);
      names = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.display_name]));
    }
    return (data ?? []).map((k) => ({
      ...k,
      redeemed_by_name: k.redeemed_by ? (names[k.redeemed_by] ?? null) : null,
    })) as LicenseKeyRow[];
  });

function randomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const block = () =>
    Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `FF-${block()}-${block()}-${block()}`;
}

/** Admin: generate one or more license keys. */
export const createLicenseKeys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        plan: z.enum(["pro", "business"]),
        durationDays: z.number().int().min(1).max(3650),
        count: z.number().int().min(1).max(50),
        note: z.string().max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = Array.from({ length: data.count }, () => ({
      code: randomCode(),
      plan: data.plan,
      duration_days: data.durationDays,
      note: data.note || null,
      created_by: context.userId,
    }));
    const { data: inserted, error } = await supabaseAdmin
      .from("license_keys")
      .insert(rows)
      .select("code");
    if (error) throw new Error(error.message);
    return { codes: (inserted ?? []).map((r) => r.code) };
  });

/** Admin: delete an unused license key. */
export const deleteLicenseKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("license_keys")
      .delete()
      .eq("id", data.id)
      .is("redeemed_by", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin: list all users with their subscription state. */
export const listUsersAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: subs, error } = await supabaseAdmin
      .from("subscriptions")
      .select("user_id, plan, trial_ends_at, subscription_ends_at, is_active, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const ids = (subs ?? []).map((s) => s.user_id);
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, display_name").in("id", ids)
      : { data: [] as { id: string; display_name: string | null }[] };
    const names = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.display_name]));

    const { data: sessions } = ids.length
      ? await supabaseAdmin.from("telegram_sessions").select("user_id, status").in("user_id", ids)
      : { data: [] as { user_id: string; status: string }[] };
    const statuses = Object.fromEntries((sessions ?? []).map((s) => [s.user_id, s.status]));

    return (subs ?? []).map((s) => ({
      userId: s.user_id,
      name: names[s.user_id] ?? null,
      plan: s.plan,
      trialEndsAt: s.trial_ends_at,
      subscriptionEndsAt: s.subscription_ends_at,
      isActive: s.is_active,
      telegramStatus: statuses[s.user_id] ?? "logged_out",
      createdAt: s.created_at,
    }));
  });

/** Admin: manually set a user's plan / expiry. */
export const setUserPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        userId: z.string().uuid(),
        plan: z.enum(["trial", "pro", "business", "expired"]),
        days: z.number().int().min(0).max(3650),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const end = new Date(Date.now() + data.days * 86400_000).toISOString();
    const patch =
      data.plan === "trial"
        ? { plan: data.plan, trial_ends_at: end, is_active: data.days > 0 }
        : data.plan === "expired"
          ? { plan: data.plan, is_active: false }
          : { plan: data.plan, subscription_ends_at: end, is_active: data.days > 0 };

    const { error } = await supabaseAdmin
      .from("subscriptions")
      .upsert({ user_id: data.userId, ...patch }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
