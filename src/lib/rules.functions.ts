import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/lib/oracle-auth-middleware";
import { loadEntitlements, gateRule } from "@/lib/plan-limits.server";
import type { Entitlements } from "@/lib/plan-limits";

export type Replacement = { from: string; to: string };

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
  schedule_enabled: boolean;
  schedule_start: string | null;
  schedule_end: string | null;
  schedule_days: number[];
  schedule_tz_offset: number;
  only_video_with_caption: boolean;
  backfill_from: string | null;
  backfill_to: string | null;
  backfill_status: string;
  backfill_done_count: number;
  backfill_detail: string | null;
  header_text: string | null;
  footer_text: string | null;
  replacements: Replacement[];
  media_filter: string;
};

const BASE_RULE_COLUMNS =
  "id, name, source, source_type, destination, destination_type, enabled, include_keywords, exclude_keywords, forwarded_count, max_forward_count, forward_delay";

const SCHEDULE_COLUMNS =
  "schedule_enabled, schedule_start, schedule_end, schedule_days, schedule_tz_offset";

const BACKFILL_COLUMNS =
  "only_video_with_caption, backfill_from, backfill_to, backfill_status, backfill_done_count, backfill_detail";

const EXTRA_COLUMNS = "header_text, footer_text, replacements, media_filter";

/** Column sets tried in order — Oracle DBs missing a migration fall back gracefully. */
const COLUMN_SETS = [
  `${BASE_RULE_COLUMNS}, ${SCHEDULE_COLUMNS}, ${BACKFILL_COLUMNS}, ${EXTRA_COLUMNS}`,
  `${BASE_RULE_COLUMNS}, ${SCHEDULE_COLUMNS}, ${BACKFILL_COLUMNS}`,
  `${BASE_RULE_COLUMNS}, ${SCHEDULE_COLUMNS}`,
  BASE_RULE_COLUMNS,
];

const isMissingColumn = (message?: string | null) =>
  !!message && message.includes("does not exist");

const DEFAULTS = {
  schedule_enabled: false,
  schedule_start: null,
  schedule_end: null,
  schedule_days: [],
  schedule_tz_offset: 0,
  only_video_with_caption: false,
  backfill_from: null,
  backfill_to: null,
  backfill_status: "idle",
  backfill_done_count: 0,
  backfill_detail: null,
  header_text: null,
  footer_text: null,
  replacements: [],
  media_filter: "all",
};

const withDefaults = (rows: any[]): RuleRow[] =>
  rows.map((r) => ({ ...DEFAULTS, ...r })) as RuleRow[];

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
    let lastError: string | null = null;
    for (const columns of COLUMN_SETS) {
      const { data, error } = await supabaseAdmin
        .from("forwarding_rules")
        .select(columns)
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false });
      if (!error) return withDefaults(data ?? []);
      lastError = error.message;
      if (!isMissingColumn(error.message)) break;
    }
    throw new Error(lastError ?? "Failed to load rules");
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
  schedule_enabled?: boolean;
  schedule_start?: string | null;
  schedule_end?: string | null;
  schedule_days?: number[];
  schedule_tz_offset?: number;
  only_video_with_caption?: boolean;
  backfill_from?: string | null;
  backfill_to?: string | null;
  run_backfill?: boolean;
  header_text?: string | null;
  footer_text?: string | null;
  replacements?: Replacement[];
  media_filter?: string;
};

const MEDIA_FILTERS = ["all", "text", "photo", "video", "video_caption", "document", "audio"];

export const getMyEntitlements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Entitlements> => loadEntitlements(context.userId));

export const saveRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: RuleInput) => {
    const source = input.source.trim();
    const destination = input.destination.trim();
    if (!source || !destination) throw new Error("Source and destination are required.");
    if (input.run_backfill && !input.backfill_from) {
      throw new Error("Pick a start date for the history backfill.");
    }
    const media_filter = MEDIA_FILTERS.includes(input.media_filter ?? "all") ? input.media_filter ?? "all" : "all";
    const replacements = (input.replacements ?? [])
      .map((r) => ({ from: String(r.from ?? "").slice(0, 500), to: String(r.to ?? "").slice(0, 500) }))
      .filter((r) => r.from)
      .slice(0, 30);
    return {
      ...input,
      source,
      destination,
      media_filter,
      replacements,
      header_text: (input.header_text ?? "").slice(0, 1000) || null,
      footer_text: (input.footer_text ?? "").slice(0, 1000) || null,
    };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ent = await loadEntitlements(context.userId);
    if (ent.tier === "expired") throw new Error("Your plan has expired. Renew to add or edit rules.");
    if (!data.id) {
      const { count } = await supabaseAdmin
        .from("forwarding_rules")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId);
      if ((count ?? 0) >= ent.maxRules) {
        throw new Error(`${ent.label} allows ${ent.maxRules} rules. Upgrade to add more.`);
      }
    }
    if (data.run_backfill && !ent.backfill) {
      throw new Error("Old posts (backfill) needs Premium Pro.");
    }
    const gated = gateRule(
      {
        header_text: data.header_text,
        footer_text: data.footer_text,
        replacements: data.replacements,
        media_filter: data.media_filter,
        only_video_with_caption: data.media_filter === "video_caption" || !!data.only_video_with_caption,
        schedule_enabled: data.schedule_enabled ?? false,
      },
      ent,
    );

    const base = {
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
    const schedule = {
      schedule_enabled: gated.schedule_enabled,
      schedule_start: data.schedule_start || null,
      schedule_end: data.schedule_end || null,
      schedule_days: data.schedule_days ?? [],
      schedule_tz_offset: data.schedule_tz_offset ?? 0,
    };
    const backfill: Record<string, unknown> = {
      only_video_with_caption: gated.only_video_with_caption,
      backfill_from: data.backfill_from || null,
      backfill_to: data.backfill_to || null,
    };
    if (data.run_backfill) {
      backfill.backfill_status = "pending";
      backfill.backfill_done_count = 0;
      backfill.backfill_detail = null;
    }

    const extra = {
      header_text: gated.header_text,
      footer_text: gated.footer_text,
      replacements: gated.replacements,
      media_filter: gated.media_filter,
    };
    const bodies = [
      { ...base, ...schedule, ...backfill, ...extra },
      { ...base, ...schedule, ...backfill },
      { ...base, ...schedule },
      base,
    ];

    const table = () => supabaseAdmin.from("forwarding_rules") as any;
    const write = (body: Record<string, unknown>) =>
      data.id
        ? table().update(body).eq("id", data.id).eq("user_id", context.userId)
        : table().insert(body);


    let lastError: string | null = null;
    for (const body of bodies) {
      const { error } = await write(body);
      if (!error) return { ok: true };
      lastError = error.message;
      if (!isMissingColumn(error.message)) break;
    }
    throw new Error(lastError ?? "Failed to save rule");
  });

/** Start (or restart) the history backfill for one rule. */
export const startBackfill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; from: string; to?: string | null }) => {
    if (!input.from) throw new Error("Pick a start date.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const ent = await loadEntitlements(context.userId);
    if (!ent.backfill) throw new Error("Old posts (backfill) needs Premium Pro.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin.from("forwarding_rules") as any)
      .update({
        backfill_from: data.from,
        backfill_to: data.to || null,
        backfill_status: "pending",
        backfill_done_count: 0,
        backfill_detail: null,
      })
      .eq("id", data.id)
      .eq("user_id", context.userId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Stop a running/pending backfill. */
export const stopBackfill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin.from("forwarding_rules") as any)
      .update({ backfill_status: "cancelled" })
      .eq("id", data.id)
      .eq("user_id", context.userId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setRuleEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; enabled: boolean }) => input)
  .handler(async ({ data, context }) => {
    if (data.enabled) {
      const ent = await loadEntitlements(context.userId);
      if (ent.tier === "expired") throw new Error("Your plan has expired. Renew to turn rules on.");
    }
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
