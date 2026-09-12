import { createFileRoute } from "@tanstack/react-router";
import { resolveWorkerUser } from "@/integrations/supabase/worker-auth.server";

const BASE_RULE_COLUMNS =
  "id, name, source, source_type, destination, destination_type, enabled, include_keywords, exclude_keywords, forwarded_count, max_forward_count, forward_delay";

const SCHEDULE_COLUMNS =
  "schedule_enabled, schedule_start, schedule_end, schedule_days, schedule_tz_offset";

const isMissingScheduleColumn = (message?: string | null) =>
  !!message && message.includes("schedule_") && message.includes("does not exist");

// GET /api/public/worker/rules — external worker pulls enabled rules for its user.
export const Route = createFileRoute("/api/public/worker/rules")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await resolveWorkerUser(request);
        if (!auth) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const query = (columns: string) => supabaseAdmin
          .from("forwarding_rules")
          .select(columns)
          .eq("user_id", auth.userId)
          .eq("enabled", true);

        const { data, error } = await query(`${BASE_RULE_COLUMNS}, ${SCHEDULE_COLUMNS}`);
        if (!error) return Response.json({ rules: data ?? [] });
        if (!isMissingScheduleColumn(error.message)) {
          return new Response(error.message, { status: 500 });
        }

        const fallback = await query(BASE_RULE_COLUMNS);
        if (fallback.error) return new Response(fallback.error.message, { status: 500 });
        const rules = (fallback.data ?? []).map((rule) => ({
          ...(rule as unknown as Record<string, unknown>),
          schedule_enabled: false,
          schedule_start: null,
          schedule_end: null,
          schedule_days: [],
          schedule_tz_offset: 0,
        }));
        return Response.json({ rules });
      },
    },
  },
});
