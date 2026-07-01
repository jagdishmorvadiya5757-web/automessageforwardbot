import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Log = {
  id: string;
  rule_id: string | null;
  source_msg_ref: string | null;
  status: "forwarded" | "skipped" | "error";
  detail: string | null;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/app/logs")({
  component: LogsPage,
});

const statusVariant: Record<Log["status"], "default" | "secondary" | "destructive"> = {
  forwarded: "default",
  skipped: "secondary",
  error: "destructive",
};

function LogsPage() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forwarding_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as Log[];
    },
    refetchInterval: 15000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Activity</h1>
        <p className="text-sm text-muted-foreground">Recent forwarding results reported by your worker.</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : logs.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No activity yet</CardTitle>
            <CardDescription>
              Once your worker is running and forwarding messages, results appear here.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-2">
          {logs.map((l) => (
            <Card key={l.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3">
                  <Badge variant={statusVariant[l.status]}>{l.status}</Badge>
                  <span className="text-sm text-foreground">{l.detail ?? l.source_msg_ref ?? "—"}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(l.created_at).toLocaleString()}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
