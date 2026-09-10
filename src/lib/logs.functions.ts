import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/lib/oracle-auth-middleware";

export type LogRow = {
  id: string;
  rule_id: string | null;
  source_msg_ref: string | null;
  status: "forwarded" | "skipped" | "error";
  detail: string | null;
  created_at: string;
};

export const listLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LogRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("forwarding_logs")
      .select("id, rule_id, source_msg_ref, status, detail, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as LogRow[];
  });
