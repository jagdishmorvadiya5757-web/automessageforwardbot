import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/lib/oracle-auth-middleware";
import { z } from "zod";

export type WalletSummary = {
  balance: number;
  lifetimeEarned: number;
};

export type CreditTx = {
  id: string;
  amount: number;
  kind: string;
  note: string | null;
  counterparty_id: string | null;
  created_at: string;
};

export const getWallet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WalletSummary> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("wallets")
      .select("balance, lifetime_earned")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!data) {
      await supabaseAdmin.from("wallets").insert({ user_id: context.userId }).select();
      return { balance: 0, lifetimeEarned: 0 };
    }
    return { balance: data.balance, lifetimeEarned: data.lifetime_earned };
  });

export const listTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CreditTx[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("credit_transactions")
      .select("id, amount, kind, note, counterparty_id, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []) as CreditTx[];
  });

export const transferCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        toUserId: z.string().uuid("Enter a valid account ID"),
        amount: z.number().int().min(1).max(100000),
        note: z.string().max(140).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("transfer_credits", {
      _from: context.userId,
      _to: data.toUserId,
      _amount: data.amount,
      _note: data.note ?? undefined,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(rows) ? rows[0] : rows;
    return {
      success: !!row?.success,
      message: row?.message ?? "Unknown error",
      balance: row?.balance ?? 0,
    };
  });

/** Admin: grant or deduct credits for any user. */
export const adminAdjustCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        userId: z.string().uuid(),
        amount: z.number().int().min(-100000).max(100000),
        note: z.string().max(140).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: balance, error } = await supabaseAdmin.rpc("award_credits", {
      _user_id: data.userId,
      _amount: data.amount,
      _kind: "admin_grant",
      _note: data.note ?? "Adjusted by admin",
      _counterparty: context.userId,
    });
    if (error) throw new Error(error.message);
    return { balance: balance as unknown as number };
  });
