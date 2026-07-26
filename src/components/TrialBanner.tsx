import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMySubscription } from "@/lib/subscription.functions";
import { AlertTriangle, Clock, Sparkles } from "lucide-react";

export function TrialBanner() {
  const fetchSub = useServerFn(getMySubscription);
  const { data } = useQuery({
    queryKey: ["my-subscription"],
    queryFn: () => fetchSub(),
    refetchInterval: 60_000,
  });

  if (!data) return null;

  if (!data.isActive) {
    return (
      <div className="mb-4 flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
        <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
        <div className="flex-1">
          <p className="font-medium text-destructive">
            {data.plan === "trial" ? "Trial expired" : "Subscription expired"}
          </p>
          <p className="text-muted-foreground">
            Message forwarding paused. Subscribe to continue.
          </p>
        </div>
      </div>
    );
  }

  if (data.plan === "trial") {
    return (
      <div className="mb-4 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
        <Sparkles className="h-5 w-5 shrink-0 text-primary" />
        <div className="flex-1">
          <p className="font-medium">Free trial active</p>
          <p className="text-muted-foreground">
            {data.daysLeft} {data.daysLeft === 1 ? "day" : "days"} left. All features unlocked.
          </p>
        </div>
      </div>
    );
  }

  if ((data.plan === "pro" || data.plan === "business") && data.daysLeft !== null && data.daysLeft <= 5) {
    return (
      <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
        <Clock className="h-5 w-5 shrink-0 text-amber-600" />
        <div className="flex-1">
          <p className="font-medium">Subscription ending soon</p>
          <p className="text-muted-foreground">
            {data.daysLeft} {data.daysLeft === 1 ? "day" : "days"} left on your {data.plan} plan.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
