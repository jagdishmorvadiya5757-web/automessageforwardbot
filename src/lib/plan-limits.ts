// Single source of truth for what each plan unlocks. Used by the server
// (rule save + worker feed) and the dashboard (lock icons).
export type Tier = "trial" | "pro" | "business" | "expired" | "admin";

export type Entitlements = {
  tier: Tier;
  label: string;
  maxRules: number;
  mediaFilter: boolean;
  schedule: boolean;
  headerFooter: boolean;
  linkReplace: boolean;
  backfill: boolean;
};

const ALL = { mediaFilter: true, schedule: true, headerFooter: true, linkReplace: true, backfill: true };
const NONE = { mediaFilter: false, schedule: false, headerFooter: false, linkReplace: false, backfill: false };

export const ENTITLEMENTS: Record<Tier, Entitlements> = {
  // Free trial lets new users try everything for 3 days.
  trial: { tier: "trial", label: "Free Trial", maxRules: 25, ...ALL },
  pro: { tier: "pro", label: "Premium", maxRules: 10, ...NONE, mediaFilter: true },
  business: { tier: "business", label: "Premium Pro", maxRules: 25, ...ALL },
  expired: { tier: "expired", label: "Expired", maxRules: 0, ...NONE },
  admin: { tier: "admin", label: "Admin", maxRules: 100000, ...ALL },
};

export function entitlementsFor(plan: string | null | undefined, active: boolean, isAdmin: boolean): Entitlements {
  if (isAdmin) return ENTITLEMENTS.admin;
  if (!active) return ENTITLEMENTS.expired;
  if (plan === "trial" || plan === "pro" || plan === "business") return ENTITLEMENTS[plan];
  return ENTITLEMENTS.expired;
}

export const UPGRADE_HINT = "Upgrade to Premium Pro to unlock";
