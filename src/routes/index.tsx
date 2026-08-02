import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Send,
  ArrowRight,
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
  Link2,
  Image as ImageIcon,
  Bitcoin,
  Activity,
  Lock,
  Plug,
  Gauge,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ForwardFlow · Telegram Auto Forward Made Simple" },
      {
        name: "description",
        content:
          "Automatically forward Telegram messages between channels, groups and bots with smart filters, AI rewriting, scheduling and enterprise-grade reliability.",
      },
      { property: "og:title", content: "ForwardFlow · Telegram Auto Forward Made Simple" },
      {
        property: "og:description",
        content:
          "Set forwarding rules once and let the autonomous cloud worker mirror your Telegram messages with filters, delays and AI rewriting.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Glass({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-border/60 bg-card/70 p-6 shadow-xl backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-brand/40 hover:shadow-2xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Node({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-3 rounded-3xl border border-brand/25 bg-card/80 px-6 py-6 shadow-lg backdrop-blur-xl">
      <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[#2AABEE] text-white shadow-lg">
        <Send className="-ml-1 h-7 w-7" />
      </span>
      <span className="text-sm font-bold text-brand">{label}</span>
      <span className="text-xs text-muted-foreground">{sub}</span>
    </div>
  );
}

function SectionHead({ eyebrow, title, desc }: { eyebrow: string; title: string; desc?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <span className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand-soft px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-brand">
        {eyebrow}
      </span>
      <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h2>
      {desc ? <p className="mt-3 text-base text-muted-foreground">{desc}</p> : null}
    </div>
  );
}

const setupSteps = [
  {
    icon: Plug,
    title: "Instant Connection",
    desc: "Link Telegram via secure API and user sessions — no bot admin gymnastics, no message copying by hand.",
  },
  {
    icon: Clock,
    title: "Automation & Scheduling",
    desc: "Queue and delay posts precisely using custom per-rule time settings, so nothing is skipped or rate-limited.",
  },
  {
    icon: Sparkles,
    title: "AI-Powered Rewrite",
    desc: "Transform, translate, or rewrite text dynamically before delivery — every post lands on-brand.",
  },
];

const pipeline = [
  {
    step: "01",
    icon: Filter,
    title: "Filters & Whitelist / Blacklist",
    desc: "Filter out spam using keyword or user rules before anything leaves the source.",
    tags: [
      { icon: CheckCircle2, label: "Whitelist" },
      { icon: Ban, label: "Blacklist" },
      { icon: Filter, label: "Keyword rules" },
    ],
  },
  {
    step: "02",
    icon: Repeat,
    title: "Content Modifiers",
    desc: "Text replacement, header/footer injection, and multi-language translation applied in flight.",
    tags: [
      { icon: Repeat, label: "Replace" },
      { icon: AlignLeft, label: "Header / Footer" },
      { icon: Languages, label: "Translate" },
    ],
  },
  {
    step: "03",
    icon: Zap,
    title: "Advanced Add-ons",
    desc: "Anti-forward bypass, smart image cropping, crypto mode, and link button injection on delivery.",
    tags: [
      { icon: ShieldCheck, label: "Bypass" },
      { icon: ImageIcon, label: "Smart crop" },
      { icon: Bitcoin, label: "Crypto mode" },
      { icon: Link2, label: "Link buttons" },
    ],
  },
];

function Landing() {
  return (
    <div className="min-h-svh bg-gradient-to-b from-brand-soft via-background to-background">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand text-brand-foreground">
            <Send className="-ml-0.5 h-4 w-4" />
          </span>
          <span className="truncate text-lg font-extrabold tracking-tight">ForwardFlow</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild variant="ghost" className="font-semibold">
            <Link to="/auth">Login</Link>
          </Button>
          <Button asChild className="bg-brand font-bold text-brand-foreground hover:bg-brand/90">
            <Link to="/auth">Get started</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-12 lg:grid-cols-2 lg:py-20">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand-soft px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-brand">
            <Activity className="h-3.5 w-3.5" /> Autonomous cloud worker
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            Auto Forward <span className="text-brand">Made Simple</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            Automatically forward messages from any Telegram group, channel, user, or bot. Set it once and let the
            autonomous cloud worker do the rest.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="h-13 rounded-2xl bg-brand px-7 text-base font-bold text-brand-foreground hover:bg-brand/90">
              <Link to="/auth">
                Start forwarding <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary" className="h-13 rounded-2xl px-7 text-base font-bold">
              <Link to="/auth">Login</Link>
            </Button>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-muted-foreground">
            <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-brand" /> No message skipped</span>
            <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-brand" /> Per-rule delays</span>
            <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-brand" /> Encrypted sessions</span>
          </div>
        </div>

        <Glass className="relative overflow-hidden p-8">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
            <Node label="Source" sub="Channel / Group" />
            <div className="flex flex-col items-center gap-2">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-2 w-2 rounded-full bg-brand/70 animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]"
                  style={{ animationDelay: `${i * 0.25}s` }}
                />
              ))}
              <ArrowRight className="h-5 w-5 text-brand" />
            </div>
            <Node label="Destination" sub="Channel / Bot" />
          </div>
          <div className="mt-6 grid gap-2 rounded-2xl border border-border/60 bg-background/60 p-4 text-sm">
            {[
              { icon: CheckCircle2, text: "Message forwarded · 240 ms" },
              { icon: Filter, text: "Keyword filter passed" },
              { icon: Clock, text: "Queued with 2.0s delay" },
            ].map((r) => (
              <div key={r.text} className="flex min-w-0 items-center gap-2">
                <r.icon className="h-4 w-4 shrink-0 text-brand" />
                <span className="truncate font-medium text-muted-foreground">{r.text}</span>
              </div>
            ))}
          </div>
        </Glass>
      </section>

      {/* Launch in minutes */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16">
        <SectionHead
          eyebrow="Launch in minutes"
          title="From zero to forwarding in three moves"
          desc="Connect, configure, and let automation handle every message that follows."
        />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {setupSteps.map((f) => (
            <Glass key={f.title}>
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-brand">
                <f.icon className="h-6 w-6" />
              </span>
              <h3 className="mt-5 text-lg font-bold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </Glass>
          ))}
        </div>
      </section>

      {/* Security */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand-soft px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-brand">
              <Lock className="h-3.5 w-3.5" /> Security
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Enterprise-Grade Cloud Security
            </h2>
            <p className="mt-4 text-base text-muted-foreground">
              Your data stays private. Messages route securely through Telegram’s API with zero extra storage or
              message snooping.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                { icon: ShieldCheck, label: "AES-256 encrypted sessions" },
                { icon: RefreshCw, label: "Automatic retry on failure" },
                { icon: Gauge, label: "Fast mode delivery" },
                { icon: Activity, label: "Live worker health checks" },
              ].map((x) => (
                <div key={x.label} className="flex min-w-0 items-center gap-3 rounded-2xl border bg-card/70 px-4 py-3 backdrop-blur">
                  <x.icon className="h-5 w-5 shrink-0 text-brand" />
                  <span className="truncate text-sm font-semibold">{x.label}</span>
                </div>
              ))}
            </div>
          </div>

          <Glass className="p-7">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">System health</p>
                <p className="truncate text-2xl font-extrabold">All systems operational</p>
              </div>
              <span className="flex shrink-0 items-center gap-2 rounded-full border border-brand/30 bg-brand-soft px-3 py-1.5 text-xs font-bold text-brand">
                <span className="h-2 w-2 rounded-full bg-brand" /> Live
              </span>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {[
                { k: "Uptime", v: "100%" },
                { k: "Worker", v: "Active" },
                { k: "Mode", v: "Fast" },
                { k: "Retries", v: "Auto" },
              ].map((m) => (
                <div key={m.k} className="rounded-2xl border bg-background/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{m.k}</p>
                  <p className="mt-1 text-xl font-extrabold text-brand">{m.v}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 space-y-2">
              {[92, 78, 96, 64, 88, 99].map((h, i) => (
                <div key={i} className="h-2 overflow-hidden rounded-full bg-brand-muted/40">
                  <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${h}%` }} />
                </div>
              ))}
            </div>
          </Glass>
        </div>
      </section>

      {/* Pipeline */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16">
        <SectionHead
          eyebrow="Stack powerful automation"
          title="Rules that stack, step by step"
          desc="Every message flows through your pipeline in order — filter, modify, then deliver."
        />
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {pipeline.map((p) => (
            <Glass key={p.step} className="relative">
              <span className="text-5xl font-black text-brand/15">{p.step}</span>
              <div className="mt-2 flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                  <p.icon className="h-5 w-5" />
                </span>
                <h3 className="min-w-0 truncate text-lg font-bold">{p.title}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.desc}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {p.tags.map((t) => (
                  <span
                    key={t.label}
                    className="inline-flex items-center gap-1.5 rounded-full border bg-background/70 px-3 py-1.5 text-xs font-semibold transition-colors hover:border-brand/40 hover:text-brand"
                  >
                    <t.icon className="h-3.5 w-3.5 shrink-0" />
                    {t.label}
                  </span>
                ))}
              </div>
            </Glass>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-20 pt-6">
        <div className="relative overflow-hidden rounded-[2.5rem] border border-brand/30 bg-brand-soft/70 p-10 text-center shadow-2xl backdrop-blur-xl sm:p-16">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-5xl">Ready to start?</h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
            Create an account or log in to launch your first automated Telegram workflow — it takes less than a minute.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="h-14 rounded-2xl bg-brand px-8 text-base font-bold text-brand-foreground hover:bg-brand/90">
              <Link to="/auth">
                Register free <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary" className="h-14 rounded-2xl px-8 text-base font-bold">
              <Link to="/auth">Login</Link>
            </Button>
          </div>
        </div>
        <p className="mt-8 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} ForwardFlow · Telegram automation for teams and creators.
        </p>
      </section>
    </div>
  );
}
