import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, legalHead } from "@/components/LegalPage";

export const Route = createFileRoute("/pricing")({
  head: () => legalHead("Pricing", "ForwardFlow plans: 3-day free trial, Premium ₹99/month and Premium Pro ₹319/month."),
  component: Pricing,
});

const PLANS = [
  { name: "Free Trial", price: "₹0", period: "3 days, new users only", perks: ["Everything unlocked", "Up to 25 rules"] },
  { name: "Premium", price: "₹99/month · ₹999/year", period: "", perks: ["Up to 10 rules", "Allow/block words", "Delay & auto-stop", "Media filters"] },
  { name: "Premium Pro", price: "₹319/month · ₹2999/year", period: "", perks: ["Up to 25 rules", "Header/footer text", "Link replace", "Schedule & history backfill", "Dedicated support"] },
];

function Pricing() {
  return (
    <LegalPage title="Pricing">
      <p>All prices are in Indian Rupees (INR). Payment is processed securely by Razorpay.</p>
      <div className="grid gap-4 sm:grid-cols-3">
        {PLANS.map((p) => (
          <div key={p.name} className="rounded-xl border bg-card p-4">
            <p className="font-semibold text-foreground">{p.name}</p>
            <p className="mt-1 text-foreground">{p.price}</p>
            {p.period && <p className="text-xs">{p.period}</p>}
            <ul className="mt-3 space-y-1">{p.perks.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
        ))}
      </div>
      <p>Refer a friend: get +3 days when they join, and +1 month Premium when they buy their first plan.</p>
      <p><Link to="/auth" className="text-primary underline">Start your free trial</Link></p>
    </LegalPage>
  );
}
