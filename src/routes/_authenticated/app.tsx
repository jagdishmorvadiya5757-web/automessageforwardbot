import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { amIAdmin } from "@/lib/license.functions";
import { Button } from "@/components/ui/button";
import {
  Send,
  LayoutGrid,
  ListChecks,
  ScrollText,
  ServerCog,
  LogOut,
  Phone,
  Radio,
  CreditCard,
  Shield,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TrialBanner } from "@/components/TrialBanner";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppLayout,
});

const nav = [
  { to: "/app/home", label: "Home", icon: LayoutGrid, exact: false },
  { to: "/app", label: "Rules", icon: ListChecks, exact: true },
  { to: "/app/login", label: "Telegram", icon: Phone, exact: false },
  { to: "/app/channels", label: "Channels", icon: Radio, exact: false },
  { to: "/app/logs", label: "Activity", icon: ScrollText, exact: false },
  { to: "/app/rewards", label: "Rewards", icon: Gift, exact: false },
  { to: "/app/wallet", label: "Wallet", icon: Wallet, exact: false },
  { to: "/app/plan", label: "Plan", icon: CreditCard, exact: false },
  { to: "/app/profile", label: "Profile", icon: UserCog, exact: false },
];



function AppLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const location = useLocation();
  const adminFn = useServerFn(amIAdmin);
  const { data: adminInfo } = useQuery({
    queryKey: ["am-i-admin"],
    queryFn: () => adminFn(),
    staleTime: 5 * 60_000,
  });
  const navItems = adminInfo?.isAdmin
    ? [
        ...nav,
        { to: "/app/worker", label: "Worker", icon: ServerCog, exact: false },
        { to: "/app/admin", label: "Admin", icon: Shield, exact: false },
      ]
    : nav;


  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-3 py-3 sm:px-4">
          <Link to="/app" className="flex min-w-0 items-center gap-2 font-semibold text-foreground">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Send className="h-4 w-4" />
            </span>
            ForwardFlow
          </Link>
          <Button variant="ghost" size="sm" className="shrink-0" onClick={signOut}>
            <LogOut className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
        <nav className="mx-auto flex w-full max-w-5xl gap-1 overflow-x-auto px-3 [scrollbar-width:none] sm:px-4 [&::-webkit-scrollbar]:hidden">
          {navItems.map((n) => {
            const active = n.exact
              ? location.pathname === n.to
              : location.pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <n.icon className="h-4 w-4 shrink-0" />
                {n.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl px-3 py-6 sm:px-4 sm:py-8">
        <TrialBanner />
        <Outlet />
      </main>
    </div>
  );
}
