import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, legalHead } from "@/components/LegalPage";

export const Route = createFileRoute("/privacy")({
  head: () => legalHead("Privacy Policy", "How ForwardFlow collects, uses and protects your data."),
  component: () => (
    <LegalPage title="Privacy Policy" updated="October 2026">
      <h2>What we collect</h2>
      <ul>
        <li>Phone number (for sign-in), name, optional email and profile photo.</li>
        <li>Your Telegram session, stored encrypted, used only to run your rules.</li>
        <li>Your rules and a short forwarding log (status, time, message ID).</li>
      </ul>
      <h2>What we don't do</h2>
      <ul>
        <li>We do not sell your data.</li>
        <li>We do not store full message content beyond what is needed to forward it.</li>
      </ul>
      <h2>Payments</h2>
      <p>Payments are handled by Razorpay. We never see your card or UPI details.</p>
      <h2>Deleting your data</h2>
      <p>Disconnect Telegram anytime from the app. To delete your account, contact us.</p>
    </LegalPage>
  ),
});
