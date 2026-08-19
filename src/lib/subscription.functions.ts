import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/lib/oracle-auth-middleware";

export type SubscriptionInfo = {
  plan: "trial" | "pro" | "business" | "expired";
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  isActive: boolean;
  daysLeft: number | null;
};

export const getMySubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SubscriptionInfo> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("subscriptions")
      .select("plan, trial_ends_at, subscription_ends_at, is_active")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!data) {
      return {
        plan: "expired",
        trialEndsAt: null,
        subscriptionEndsAt: null,
        isActive: false,
        daysLeft: null,
      };
    }

    const now = Date.now();
    let endTs: number | null = null;
    let active = data.is_active;
    if (data.plan === "trial" && data.trial_ends_at) {
      endTs = new Date(data.trial_ends_at).getTime();
      if (endTs <= now) active = false;
    } else if ((data.plan === "pro" || data.plan === "business") && data.subscription_ends_at) {
      endTs = new Date(data.subscription_ends_at).getTime();
      if (endTs <= now) active = false;
    }

    const daysLeft = endTs !== null ? Math.max(0, Math.ceil((endTs - now) / (1000 * 60 * 60 * 24))) : null;

    return {
      plan: data.plan as SubscriptionInfo["plan"],
      trialEndsAt: data.trial_ends_at,
      subscriptionEndsAt: data.subscription_ends_at,
      isActive: active,
      daysLeft,
    };
  });
