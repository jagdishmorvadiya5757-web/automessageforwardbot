import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, legalHead } from "@/components/LegalPage";

export const Route = createFileRoute("/refund")({
  head: () => legalHead("Refund & Cancellation", "ForwardFlow refund and cancellation policy."),
  component: () => (
    <LegalPage title="Refund & Cancellation" updated="October 2026">
      <h2>Try before you pay</h2>
      <p>Every new user gets a 3-day free trial with all features, so you can test before buying.</p>
      <h2>Cancellation</h2>
      <p>You can cancel a subscription anytime. Your plan keeps working until its end date and will not renew.</p>
      <h2>Refunds</h2>
      <ul>
        <li>If you were charged twice or the service did not work due to our fault, request a refund within 7 days of payment.</li>
        <li>Approved refunds are returned to the original payment method within 5–7 working days.</li>
        <li>No refunds for partially used periods or for accounts blocked due to misuse.</li>
      </ul>
      <p>To request a refund, use the Contact page.</p>
    </LegalPage>
  ),
});
