import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/lib/oracle-auth-middleware";

export type EndpointType = "channel" | "bot";

export type ChannelRow = {
  id: string;
  chat_id: string;
  title: string;
  username: string | null;
  kind: string;
  can_post: boolean;
};

export type RuleRow = {
  id: string;
  name: string | null;
  source: string;
  source_type: EndpointType;
  destination: string;
  destination_type: EndpointType;
  enabled: boolean;
  include_keywords: string[];
  exclude_keywords: string[];
  forwarded_count: number;
  max_forward_count: number | null;
  forward_delay: number;
};

export const listChannels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ChannelRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("telegram_channels")
      .select("id, chat_id, title, username, kind, can_post")
      .eq("user_id", context.userId)
      .order("title", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as ChannelRow[];
  });

export const requestChannelSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("telegram_auth")
      .upsert(
        { user_id: context.userId, pending_action: "sync_channels" },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RuleRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("forwarding_rules")
      .select(
        "id, name, source, source_type, destination, destination_type, enabled, include_keywords, exclude_keywords, forwarded_count, max_forward_count, forward_delay",
      )
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as RuleRow[];
  });

type RuleInput = {
  id?: string | null;
  name?: string | null;
  source: string;
  source_type: EndpointType;
  destination: string;
  destination_type: EndpointType;
  include_keywords: string[];
  exclude_keywords: string[];
  max_forward_count: number | null;
  forward_delay: number;
};

export const saveRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: RuleInput) => {
    const source = input.source.trim();
    const destination = input.destination.trim();
    if (!source || !destination) throw new Error("Source and destination are required.");
    return { ...input, source, destination };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      user_id: context.userId,
      name: data.name || null,
      source: data.source,
      source_type: data.source_type,
      destination: data.destination,
      destination_type: data.destination_type,
      include_keywords: data.include_keywords,
      exclude_keywords: data.exclude_keywords,
      max_forward_count: data.max_forward_count,
      forward_delay: data.forward_delay,
    };
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("forwarding_rules")
        .update(payload)
        .eq("id", data.id)
        .eq("user_id", context.userId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("forwarding_rules").insert(payload);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const setRuleEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; enabled: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("forwarding_rules")
      .update({ enabled: data.enabled })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("forwarding_rules")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetRuleCounter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("forwarding_rules")
      .update({ forwarded_count: 0, enabled: true })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
