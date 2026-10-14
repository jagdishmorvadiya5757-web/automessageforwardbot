import { entitlementsFor, type Entitlements } from "@/lib/plan-limits";

export async function loadEntitlements(userId: string): Promise<Entitlements> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: sub }, { data: roles }] = await Promise.all([
    supabaseAdmin
      .from("subscriptions")
      .select("plan, trial_ends_at, subscription_ends_at, is_active")
      .eq("user_id", userId)
      .maybeSingle(),
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
  ]);
  const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
  const now = new Date().toISOString();
  let active = !!sub?.is_active;
  if (sub?.plan === "trial") active = active && !!sub.trial_ends_at && sub.trial_ends_at > now;
  else if (sub?.plan === "pro" || sub?.plan === "business")
    active = active && !!sub.subscription_ends_at && sub.subscription_ends_at > now;
  else active = false;
  return entitlementsFor(sub?.plan, active, isAdmin);
}

/** Blank out fields the plan does not unlock (also covers downgrades). */
export function gateRule<T extends Record<string, any>>(rule: T, ent: Entitlements): T {
  const out: Record<string, any> = { ...rule };
  if (!ent.headerFooter) {
    out.header_text = null;
    out.footer_text = null;
  }
  if (!ent.linkReplace) out.replacements = [];
  if (!ent.mediaFilter) {
    out.media_filter = "all";
    out.only_video_with_caption = false;
  }
  if (!ent.schedule) out.schedule_enabled = false;
  return out as T;
}
