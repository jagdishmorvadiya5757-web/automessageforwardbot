import { createFileRoute } from "@tanstack/react-router";
import { resolveWorkerUser } from "@/integrations/supabase/worker-auth.server";

const BASE_RULE_COLUMNS =
  "id, name, source, source_type, destination, destination_type, enabled, include_keywords, exclude_keywords, forwarded_count, max_forward_count, forward_delay";

const SCHEDULE_COLUMNS =
  "schedule_enabled, schedule_start, schedule_end, schedule_days, schedule_tz_offset";

const BACKFILL_COLUMNS =
  "only_video_with_caption, backfill_from, backfill_to, backfill_status, backfill_done_count";

const COLUMN_SETS = [
  `${BASE_RULE_COLUMNS}, ${SCHEDULE_COLUMNS}, ${BACKFILL_COLUMNS}`,
  `${BASE_RULE_COLUMNS}, ${SCHEDULE_COLUMNS}`,
  BASE_RULE_COLUMNS,
];

const DEFAULTS = {
  schedule_enabled: false,
  schedule_start: null,
  schedule_end: null,
  schedule_days: [] as number[],
  schedule_tz_offset: 0,
  only_video_with_caption: false,
  backfill_from: null,
  backfill_to: null,
  backfill_status: "idle",
  backfill_done_count: 0,
};

const isMissingColumn = (message?: string | null) =>
  !!message && message.includes("does not exist");

// GET /api/public/worker/rules — external worker pulls enabled rules for its user.
export const Route = createFileRoute("/api/public/worker/rules")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await resolveWorkerUser(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let lastError = "Failed to load rules";
        for (const columns of COLUMN_SETS) {
          const { data, error } = await supabaseAdmin
            .from("forwarding_rules")
            .select(columns)
            .eq("user_id", auth.userId)
            .eq("enabled", true);
          if (!error) {
            const rules = (data ?? []).map((rule) => ({
              ...DEFAULTS,
              ...(rule as unknown as Record<string, unknown>),
            }));
            return Response.json({ rules });
          }
          lastError = error.message;
          if (!isMissingColumn(error.message)) break;
        }
        return new Response(lastError, { status: 500 });
      },
    },
  },
});
