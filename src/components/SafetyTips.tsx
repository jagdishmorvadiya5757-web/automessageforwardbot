import { ShieldAlert } from "lucide-react";

const TIPS = [
  "Do not use virtual phone numbers.",
  "Avoid numbers that have never been used with the official Telegram app.",
  "Do not use newly acquired or VoIP phone numbers.",
  "Do not abuse, spam, or use the account for suspicious activity.",
  "Only use a phone number that you already use in the Telegram app.",
];

export function SafetyTips() {
  return (
    <div className="rounded-xl border border-warning/40 bg-warning/10 p-4">
      <div className="flex min-w-0 items-center gap-2">
        <ShieldAlert className="h-4 w-4 shrink-0 text-warning" />
        <p className="truncate text-sm font-medium text-foreground">
          Avoid a Telegram ban
        </p>
      </div>
      <ul className="mt-3 space-y-2">
        {TIPS.map((t) => (
          <li key={t} className="flex gap-2 text-xs text-muted-foreground">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
