import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getStoredSession } from "@/lib/direct-session";

// Protected layout: relies on the locally stored session (no auth-server round trip),
// so the dashboard stays reachable while the hosted auth service is offline.
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const session = getStoredSession();
      if (!session) throw redirect({ to: "/auth" });
      return { user: session.user };
    } catch (error) {
      if (error && typeof error === "object" && "to" in error) throw error;
      throw redirect({ to: "/auth" });
    }
  },
  component: () => <Outlet />,
});
