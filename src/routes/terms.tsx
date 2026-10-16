import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, legalHead } from "@/components/LegalPage";

export const Route = createFileRoute("/terms")({
  head: () => legalHead("Terms & Conditions", "Terms of use for the ForwardFlow Telegram auto-forwarding service."),
  component: () => (
    <LegalPage title="Terms & Conditions" updated="October 2026">
      <p>By using ForwardFlow you agree to these terms.</p>
      <h2>Service</h2>
      <p>ForwardFlow automatically copies messages between Telegram chats you connect, based on rules you set.</p>
      <h2>Your responsibility</h2>
      <ul>
        <li>You must only forward content you have the right to share.</li>
        <li>You must follow Telegram's Terms of Service. We are not responsible for any action Telegram takes on your account.</li>
        <li>No spam, illegal, or abusive content. We may block accounts that misuse the service.</li>
      </ul>
      <h2>Plans</h2>
      <p>Paid plans run until their end date. When a plan ends, forwarding stops until it is renewed. Your rules are kept.</p>
      <h2>Availability</h2>
      <p>We aim for 24×7 uptime but do not guarantee uninterrupted service.</p>
      <h2>Changes</h2>
      <p>We may update these terms. Continued use means you accept the updated terms.</p>
    </LegalPage>
  ),
});
