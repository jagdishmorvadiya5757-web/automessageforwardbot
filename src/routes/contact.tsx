import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, legalHead } from "@/components/LegalPage";

export const Route = createFileRoute("/contact")({
  head: () => legalHead("Contact Us", "Contact ForwardFlow support for help, billing or refunds."),
  component: () => (
    <LegalPage title="Contact Us">
      <p>We usually reply within 24 hours.</p>
      <ul>
        <li>Email: <a className="text-primary underline" href="mailto:jagdishmorvadiya5757@gmail.com">jagdishmorvadiya5757@gmail.com</a></li>
        <li>Location: Gujarat, India</li>
      </ul>
    </LegalPage>
  ),
});
