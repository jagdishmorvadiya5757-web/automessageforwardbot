import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Send,
  ArrowRight,
  ArrowLeft,
  Filter,
  ShieldCheck,
  Clock,
  Zap,
  Ban,
  CheckCircle2,
  RefreshCw,
  Languages,
  Repeat,
  AlignLeft,
  Sparkles,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ForwardFlow · Telegram Auto Forward Made Simple" },
      {
        name: "description",
        content:
          "Automatically forward Telegram messages between channels, groups and bots with smart filters, scheduling and delivery controls.",
      },
      { property: "og:title", content: "ForwardFlow · Telegram Auto Forward Made Simple" },
      {
        property: "og:description",
        content:
          "Set up forwarding rules once and let ForwardFlow mirror Telegram messages in real time with filters and delays.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Onboarding,
});

function Pill({ icon: Icon, label, tone = "default" }: { icon?: React.ElementType; label: string; tone?: "default" | "brand" | "danger" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-semibold shadow-sm",
        tone === "brand" && "border-brand/30 text-brand",
        tone === "danger" && "border-destructive/30 text-destructive",
        tone === "default" && "text-foreground",
      )}
    >
      {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
      {label}
    </span>
  );
}

function TgTile({ size = "lg" }: { size?: "lg" | "sm" }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-[#2AABEE] text-white shadow-lg",
        size === "lg" ? "h-20 w-20" : "h-14 w-14",
      )}
    >
      <Send className={size === "lg" ? "h-9 w-9 -ml-1" : "h-6 w-6 -ml-0.5"} />
    </span>
  );
}

function Dots() {
  return (
    <span className="flex items-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-1.5 w-1.5 rounded-full bg-brand/50" />
      ))}
    </span>
  );
}

const slides = [
  {
    key: "Overview",
    title: "Auto Forward Made Simple",
    desc: "Automatically forward messages from any Telegram group, channel, user, or bot. Set it once and let the worker do the rest.",
    art: (
      <div className="flex items-center justify-center gap-3">
        <div className="flex flex-col items-center gap-3">
          <TgTile />
          <span className="text-sm font-semibold text-brand">Source</span>
        </div>
        <Dots />
        <div className="flex flex-col items-center gap-3">
          <TgTile />
          <span className="text-sm font-semibold text-brand">Destination</span>
        </div>
      </div>
    ),
  },
  {
    key: "Setup",
    title: "Launch In Minutes",
    desc: "Connect Telegram, choose source and destination, then start forwarding right away.",
    art: (
      <div className="grid grid-cols-2 gap-4">
        {["Source", "Destination"].map((label) => (
          <div key={label} className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 border-b pb-3">
              <TgTile size="sm" />
              <span className="text-sm font-semibold text-brand">{label}</span>
            </div>
            <div className="mt-3 flex flex-col items-start gap-2">
              {["Automation", "Filters", "Delay", "Limits"].map((t) => (
                <span key={t} className="rounded-lg bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand">
                  {t}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    key: "Schedule",
    title: "Delay Every Delivery",
    desc: "Give each rule its own delay so Telegram never rate-limits you, and no message is ever skipped.",
    art: (
      <div className="flex items-center justify-center gap-3">
        <TgTile size="sm" />
        <div className="rounded-2xl border bg-card px-4 py-3 shadow-md">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-brand" />
            <span className="font-semibold">2.0s delay</span>
          </div>
          <div className="mt-2 flex items-center gap-3 border-t pt-2 text-brand">
            <CheckCircle2 className="h-4 w-4" />
            <RefreshCw className="h-4 w-4" />
            <Zap className="h-4 w-4" />
          </div>
        </div>
        <TgTile size="sm" />
      </div>
    ),
  },
  {
    key: "Control",
    title: "Safe & Secure",
    desc: "Your data stays private. Messages move through Telegram's API, and sessions are encrypted at rest.",
    art: (
      <div className="flex flex-col items-center gap-5">
        <div className="grid h-40 w-40 place-items-center rounded-full border-4 border-brand/25 bg-brand-soft">
          <ShieldCheck className="h-9 w-9 text-brand" />
          <span className="text-3xl font-extrabold text-brand">100%</span>
          <span className="text-xs text-muted-foreground">uptime</span>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Pill icon={ShieldCheck} label="Protected" tone="brand" />
          <Pill icon={CheckCircle2} label="Healthy" />
          <Pill icon={RefreshCw} label="Auto retry" />
        </div>
      </div>
    ),
  },
  {
    key: "Filters",
    title: "Smart Filtering",
    desc: "Use whitelist and blacklist keywords to forward only the messages that matter.",
    art: (
      <div className="flex flex-col items-center gap-5">
        <div className="flex items-center gap-4">
          <TgTile size="sm" />
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-brand">
            <Filter className="h-5 w-5" />
          </span>
          <div className="flex flex-col gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-destructive/30 text-destructive">
              <Ban className="h-4 w-4" />
            </span>
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-brand/30 text-brand">
              <MessageSquare className="h-4 w-4" />
            </span>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Pill icon={CheckCircle2} label="Whitelist" tone="brand" />
          <Pill icon={Ban} label="Blacklist" tone="danger" />
          <Pill icon={Filter} label="Keyword filters" />
        </div>
      </div>
    ),
  },
  {
    key: "Stack",
    title: "Stack Powerful Automation",
    desc: "Combine filters, limits, delays and live counters in one forwarding flow.",
    art: (
      <div className="flex flex-col items-center gap-3">
        <TgTile size="sm" />
        <div className="grid w-full grid-cols-2 gap-2">
          {[
            { icon: Filter, label: "Filters" },
            { icon: Repeat, label: "Replace" },
            { icon: Languages, label: "Language" },
            { icon: Sparkles, label: "Auto stop" },
            { icon: AlignLeft, label: "Header / Footer" },
            { icon: Clock, label: "Delay" },
          ].map((f) => (
            <span key={f.label} className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-xs font-semibold shadow-sm">
              <f.icon className="h-4 w-4 shrink-0 text-brand" />
              <span className="truncate">{f.label}</span>
            </span>
          ))}
        </div>
        <TgTile size="sm" />
      </div>
    ),
  },
  {
    key: "Finish",
    title: "Ready To Start?",
    desc: "Create an account or log in to launch your first Telegram forwarding workflow.",
    art: (
      <div className="flex flex-col items-center gap-5">
        <div className="flex w-full items-center justify-between">
          <div className="flex flex-col items-center gap-2">
            <TgTile />
            <span className="text-sm font-semibold text-brand">Source</span>
          </div>
          <Dots />
          <div className="flex flex-col items-center gap-2">
            <TgTile />
            <span className="text-sm font-semibold text-brand">Destination</span>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Pill icon={Zap} label="Automation" tone="brand" />
          <Pill icon={Filter} label="Smart filters" />
          <Pill icon={Clock} label="Delays" />
        </div>
      </div>
    ),
  },
];

function Onboarding() {
  const [i, setI] = useState(0);
  const startX = useRef<number | null>(null);
  const last = i === slides.length - 1;
  const s = slides[i];

  function go(n: number) {
    setI((v) => Math.min(slides.length - 1, Math.max(0, v + n)));
  }

  return (
    <div className="flex min-h-svh flex-col bg-gradient-to-b from-brand-soft via-background to-background">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4 px-4 pt-5">
        <div className="flex min-w-0 items-center gap-1.5">
          {slides.map((sl, idx) => (
            <button
              key={sl.key}
              aria-label={`Go to ${sl.key}`}
              onClick={() => setI(idx)}
              className={cn(
                "h-2 rounded-full transition-all",
                idx === i ? "w-7 bg-brand" : "w-2 bg-brand-muted",
              )}
            />
          ))}
        </div>
        <Link to="/auth" className="shrink-0 text-sm font-semibold text-muted-foreground hover:text-foreground">
          Skip
        </Link>
      </header>

      <main
        className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-6"
        onTouchStart={(e) => (startX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (startX.current === null) return;
          const dx = e.changedTouches[0].clientX - startX.current;
          if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
          startX.current = null;
        }}
      >
        <section className="rounded-[2rem] border bg-card/80 p-6 shadow-xl backdrop-blur sm:p-10">
          <h1 className="text-center text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            {s.title}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-center text-base text-muted-foreground">{s.desc}</p>
          <div className="mt-8">{s.art}</div>
        </section>
        <p className="mt-5 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Swipe to explore
        </p>
      </main>

      <footer className="mx-auto w-full max-w-2xl px-4 pb-8">
        {last ? (
          <div className="space-y-3">
            <Button asChild size="lg" className="h-14 w-full rounded-2xl bg-brand text-base font-bold text-brand-foreground hover:bg-brand/90">
              <Link to="/auth">Register</Link>
            </Button>
            <Button asChild size="lg" variant="secondary" className="h-14 w-full rounded-2xl text-base font-bold">
              <Link to="/auth">Login</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
            <Button
              variant="secondary"
              size="lg"
              className={cn("h-14 w-14 rounded-2xl", i === 0 && "invisible")}
              onClick={() => go(-1)}
              aria-label="Previous"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Button
              size="lg"
              className="h-14 w-full rounded-2xl bg-brand text-base font-bold text-brand-foreground hover:bg-brand/90"
              onClick={() => go(1)}
            >
              Next <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        )}
        <p className="mt-3 text-center text-sm font-medium text-muted-foreground">
          {i + 1}/{slides.length} · {s.key}
        </p>
      </footer>
    </div>
  );
}
