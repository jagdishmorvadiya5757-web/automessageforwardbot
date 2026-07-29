import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type PlanRow = {
  id: string;
  slug: string;
  name: string;
  price: string;
  period: string;
  perks: string[];
  duration_days: number;
  payment_link: string | null;
  plan: "trial" | "pro" | "business" | "expired";
  sort_order: number;
  visible: boolean;
};

export type ClaimCodeRow = {
  id: string;
  code: string;
  plan: "trial" | "pro" | "business" | "expired";
  duration_days: number;
  max_uses: number;
  used_count: number;
  active: boolean;
  note: string | null;
  created_at: string;
};

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden");
}

/** Public: list visible pricing plans. */
export const listPlans = createServerFn({ method: "GET" }).handler(async (): Promise<PlanRow[]> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("plans")
    .select("id, slug, name, price, period, perks, duration_days, payment_link, plan, sort_order, visible")
    .eq("visible", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as PlanRow[];
});

/** Admin: list every plan (including hidden). */
export const listAllPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlanRow[]> => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("plans")
      .select("id, slug, name, price, period, perks, duration_days, payment_link, plan, sort_order, visible")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as PlanRow[];
  });

/** Admin: update a plan shown on the public plan page. */
export const updatePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().min(1).max(60),
        price: z.string().max(40),
        period: z.string().max(40),
        perks: z.array(z.string().max(120)).max(12),
        durationDays: z.number().int().min(1).max(3650),
        paymentLink: z.string().max(500).nullable(),
        visible: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("plans")
      .update({
        name: data.name,
        price: data.price,
        period: data.period,
        perks: data.perks,
        duration_days: data.durationDays,
        payment_link: data.paymentLink || null,
        visible: data.visible,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin: list claim codes used on the public /claim page. */
export const listClaimCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ClaimCodeRow[]> => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("claim_codes")
      .select("id, code, plan, duration_days, max_uses, used_count, active, note, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as ClaimCodeRow[];
  });

/** Admin: create a claim code for a plan. */
export const createClaimCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        code: z.string().min(4).max(64),
        plan: z.enum(["pro", "business"]),
        durationDays: z.number().int().min(1).max(3650),
        maxUses: z.number().int().min(1).max(10000),
        note: z.string().max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("claim_codes").insert({
      code: data.code.trim().toUpperCase(),
      plan: data.plan,
      duration_days: data.durationDays,
      max_uses: data.maxUses,
      note: data.note || null,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin: enable/disable or delete a claim code. */
export const setClaimCodeActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("claim_codes")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteClaimCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("claim_codes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Public: exchange a claim code (given after payment) for a fresh license key. */
export const claimLicenseKey = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ code: z.string().min(4).max(64) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("claim_license_key", {
      _code: data.code.trim(),
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(rows) ? rows[0] : rows;
    return {
      success: !!row?.success,
      message: row?.message ?? "Unknown error",
      licenseCode: row?.license_code ?? null,
      plan: row?.plan ?? null,
      durationDays: row?.duration_days ?? null,
    };
  });
