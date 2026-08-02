import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type RewardState = {
  referralCode: string | null;
  referralCount: number;
  referralCredits: number;
  usedReferral: boolean;
  streak: number;
  checkedInToday: boolean;
  lastCheckin: string | null;
  balance: number;
  missions: { id: string; label: string; description: string; reward: number; done: boolean }[];
};

export const getRewardState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RewardState> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = context.userId;

    const [profile, checkins, referralsOut, referralIn, wallet, rules, session] = await Promise.all([
      supabaseAdmin.from("profiles").select("referral_code").eq("id", uid).maybeSingle(),
      supabaseAdmin
        .from("daily_checkins")
        .select("day, streak")
        .eq("user_id", uid)
        .order("day", { ascending: false })
        .limit(1),
      supabaseAdmin.from("referrals").select("credits_awarded").eq("referrer_id", uid),
      supabaseAdmin.from("referrals").select("id").eq("referred_id", uid).maybeSingle(),
      supabaseAdmin.from("wallets").select("balance").eq("user_id", uid).maybeSingle(),
      supabaseAdmin.from("forwarding_rules").select("id, forwarded_count").eq("user_id", uid),
      supabaseAdmin.from("telegram_sessions").select("status").eq("user_id", uid).maybeSingle(),
    ]);

    const today = new Date().toISOString().slice(0, 10);
    const last = checkins.data?.[0] ?? null;
    const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
    const streak = last ? (last.day === today || last.day === yesterday ? last.streak : 0) : 0;

    const ruleRows = rules.data ?? [];
    const totalForwarded = ruleRows.reduce((n, r) => n + (r.forwarded_count ?? 0), 0);
    const refCount = (referralsOut.data ?? []).length;

    return {
      referralCode: profile.data?.referral_code ?? null,
      referralCount: refCount,
      referralCredits: (referralsOut.data ?? []).reduce((n, r) => n + (r.credits_awarded ?? 0), 0),
      usedReferral: !!referralIn.data,
      streak,
      checkedInToday: last?.day === today,
      lastCheckin: last?.day ?? null,
      balance: wallet.data?.balance ?? 0,
      missions: [
        {
          id: "connect",
          label: "Connect Telegram",
          description: "Log in with your Telegram account.",
          reward: 30,
          done: session.data?.status === "logged_in",
        },
        {
          id: "first_rule",
          label: "Create your first rule",
          description: "Set up one forwarding route.",
          reward: 20,
          done: ruleRows.length > 0,
        },
        {
          id: "five_rules",
          label: "Run 5 rules",
          description: "Have five forwarding rules configured.",
          reward: 50,
          done: ruleRows.length >= 5,
        },
        {
          id: "hundred_forwards",
          label: "Forward 100 messages",
          description: "Reach 100 forwarded messages in total.",
          reward: 100,
          done: totalForwarded >= 100,
        },
        {
          id: "invite",
          label: "Invite a friend",
          description: "Someone signs up with your referral code.",
          reward: 50,
          done: refCount > 0,
        },
      ],
    };
  });

export const claimMission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ missionId: z.enum(["connect", "first_rule", "five_rules", "hundred_forwards"]) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = context.userId;
    const kind = `mission:${data.missionId}`;

    const { data: already } = await supabaseAdmin
      .from("credit_transactions")
      .select("id")
      .eq("user_id", uid)
      .eq("kind", kind)
      .maybeSingle();
    if (already) return { success: false, message: "Already claimed", credits: 0 };

    const [{ data: rules }, { data: session }] = await Promise.all([
      supabaseAdmin.from("forwarding_rules").select("id, forwarded_count").eq("user_id", uid),
      supabaseAdmin.from("telegram_sessions").select("status").eq("user_id", uid).maybeSingle(),
    ]);
    const ruleRows = rules ?? [];
    const forwarded = ruleRows.reduce((n, r) => n + (r.forwarded_count ?? 0), 0);

    const spec: Record<string, { ok: boolean; reward: number }> = {
      connect: { ok: session?.status === "logged_in", reward: 30 },
      first_rule: { ok: ruleRows.length > 0, reward: 20 },
      five_rules: { ok: ruleRows.length >= 5, reward: 50 },
      hundred_forwards: { ok: forwarded >= 100, reward: 100 },
    };
    const target = spec[data.missionId]!;
    if (!target.ok) return { success: false, message: "Mission not completed yet", credits: 0 };

    const { error } = await supabaseAdmin.rpc("award_credits", {
      _user_id: uid,
      _amount: target.reward,
      _kind: kind,
      _note: "Mission reward",
    });
    if (error) throw new Error(error.message);
    return { success: true, message: "Reward claimed", credits: target.reward };
  });

export const doDailyCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("daily_checkin", {
      _user_id: context.userId,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(rows) ? rows[0] : rows;
    return {
      success: !!row?.success,
      message: row?.message ?? "Unknown error",
      streak: row?.streak ?? 0,
      credits: row?.credits ?? 0,
      balance: row?.balance ?? 0,
    };
  });

export const applyReferralCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ code: z.string().min(4).max(32) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("redeem_referral", {
      _referred: context.userId,
      _code: data.code,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(rows) ? rows[0] : rows;
    return {
      success: !!row?.success,
      message: row?.message ?? "Unknown error",
      credits: row?.credits ?? 0,
    };
  });
