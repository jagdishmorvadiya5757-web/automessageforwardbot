import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/lib/oracle-auth-middleware";
import { z } from "zod";

export type MyProfile = {
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  phone: string | null;
};

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyProfile> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = (context as any).userId as string;
    let p = await supabaseAdmin
      .from("profiles")
      .select("display_name, email, avatar_url" as never)
      .eq("id", userId)
      .maybeSingle();
    if (p.error) {
      // Columns not migrated yet — fall back to name only.
      p = await supabaseAdmin.from("profiles").select("display_name").eq("id", userId).maybeSingle() as never;
    }
    const row = (p.data ?? {}) as { display_name?: string; email?: string; avatar_url?: string };
    const { data: ses } = await supabaseAdmin
      .from("telegram_sessions")
      .select("phone")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    return {
      name: row.display_name ?? null,
      email: row.email ?? null,
      avatarUrl: row.avatar_url ?? null,
      phone: (ses as { phone: string | null } | null)?.phone ?? null,
    };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        name: z.string().trim().min(1).max(60),
        email: z.string().trim().email().max(255).or(z.literal("")),
        // Small resized data URL from the browser (max ~300KB).
        avatarUrl: z.string().max(400_000).startsWith("data:image/").or(z.literal("")).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = (context as any).userId as string;
    const { error } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: userId,
          display_name: data.name,
          email: data.email || null,
          avatar_url: data.avatarUrl || null,
        } as never,
        { onConflict: "id" },
      );
    if (error) {
      throw new Error(
        /column/i.test(error.message)
          ? "Profile update needs the latest database update (07_profile_and_blocking.sql)."
          : error.message,
      );
    }
    return { ok: true };
  });

/** Returns the set of blocked user IDs; empty if the column is not migrated yet. */
export async function getBlockedUserIds(supabaseAdmin: any): Promise<Set<string>> {
  const { data, error } = await supabaseAdmin.from("profiles").select("id").eq("is_blocked", true);
  if (error) return new Set();
  return new Set((data ?? []).map((r: { id: string }) => r.id));
}
