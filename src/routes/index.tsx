import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Send, ArrowRight, Radio, Bot, Filter, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

const features = [
  { icon: Radio, title: "Any channel → any channel", desc: "Mirror posts from any channel your account can see into your own channels." },
  { icon: Bot, title: "Channels ↔ bots", desc: "Route messages from channels to bots, or from bots into channels." },
  { icon: Filter, title: "Keyword filters", desc: "Include or exclude posts by keyword so only what matters gets through." },
  { icon: ShieldCheck, title: "No source admin needed", desc: "A userbot engine reads sources without adding a bot as admin." },
];

function Landing() {
  return (
    <div className="min-h-svh bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Send className="h-4 w-4" />
          </span>
          ForwardFlow
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <section className="mx-auto max-w-3xl px-4 py-20 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-primary" /> Telegram auto-forwarding
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Auto-forward Telegram messages between any channels and bots
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
          Set up forwarding rules in a simple dashboard. A worker on your own machine
          mirrors messages in real time — with keyword filters and live activity logs.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/auth">
              Get started <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-4 pb-24 sm:grid-cols-2">
        {features.map((f) => (
          <div key={f.title} className="rounded-xl border bg-card p-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <f.icon className="h-5 w-5" />
            </span>
            <h3 className="mt-4 font-semibold text-foreground">{f.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
