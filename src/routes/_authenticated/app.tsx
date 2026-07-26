import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Send, ListChecks, ScrollText, ServerCog, LogOut, Phone, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { TrialBanner } from "@/components/TrialBanner";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppLayout,
});

const nav = [
  { to: "/app", label: "Rules", icon: ListChecks, exact: true },
  { to: "/app/login", label: "Telegram", icon: Phone, exact: false },
  { to: "/app/channels", label: "Channels", icon: Radio, exact: false },
  { to: "/app/logs", label: "Activity", icon: ScrollText, exact: false },
  { to: "/app/worker", label: "Worker", icon: ServerCog, exact: false },
];

function AppLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const location = useLocation();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/app" className="flex items-center gap-2 font-semibold text-foreground">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Send className="h-4 w-4" />
            </span>
            ForwardFlow
          </Link>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 px-4">
          {nav.map((n) => {
            const active = n.exact
              ? location.pathname === n.to
              : location.pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <TrialBanner />
        <Outlet />
      </main>
    </div>
  );
}
