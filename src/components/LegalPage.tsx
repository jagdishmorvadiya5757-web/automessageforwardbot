import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export const LEGAL_LINKS = [
  { to: "/pricing", label: "Pricing" },
  { to: "/terms", label: "Terms" },
  { to: "/privacy", label: "Privacy" },
  { to: "/refund", label: "Refund & Cancellation" },
  { to: "/contact", label: "Contact" },
] as const;

export function LegalFooter() {
  return (
    <nav className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
      {LEGAL_LINKS.map((l) => (
        <Link key={l.to} to={l.to} className="hover:text-foreground">
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

export function LegalPage({ title, updated, children }: { title: string; updated?: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link to="/" className="font-bold">ForwardFlow</Link>
          <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground">Login</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-10 text-sm leading-relaxed text-muted-foreground [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_ul]:list-disc [&_ul]:pl-5">
        <h1 className="text-3xl font-bold text-foreground">{title}</h1>
        {updated && <p className="text-xs">Last updated: {updated}</p>}
        {children}
      </main>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} ForwardFlow
        <LegalFooter />
      </footer>
    </div>
  );
}

export function legalHead(title: string, description: string) {
  return {
    meta: [
      { title: `${title} — ForwardFlow` },
      { name: "description", content: description },
      { property: "og:title", content: `${title} — ForwardFlow` },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  };
}
