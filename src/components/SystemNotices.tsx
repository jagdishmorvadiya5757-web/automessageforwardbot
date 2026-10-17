import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSystemNotices } from "@/lib/system.functions";
import { Megaphone, Wrench, X } from "lucide-react";

export function SystemNotices() {
  const fn = useServerFn(getSystemNotices);
  const { data } = useQuery({ queryKey: ["system-notices"], queryFn: () => fn(), refetchInterval: 120_000, retry: false });
  const [hidden, setHidden] = useState<string[]>([]);
  if (!data) return null;
  const list = data.announcements.filter((a) => !hidden.includes(a.id));
  return (
    <div className="mb-4 space-y-2 empty:hidden">
      {data.maintenance.enabled && (
        <div className="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p>{data.maintenance.message || "Maintenance chal raha hai. Kuch der me sab normal ho jayega."}</p>
        </div>
      )}
      {list.map((a) => (
        <div
          key={a.id}
          className={`flex gap-3 rounded-lg border p-3 text-sm ${
            a.tone === "warning" ? "border-destructive/40 bg-destructive/5" : "border-primary/30 bg-primary/5"
          }`}
        >
          <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{a.title}</p>
            {a.body && <p className="whitespace-pre-wrap text-muted-foreground">{a.body}</p>}
          </div>
          <button aria-label="Hide" onClick={() => setHidden((h) => [...h, a.id])} className="text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
