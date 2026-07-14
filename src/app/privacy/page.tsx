import type { Metadata } from "next";
import { LegalShell, Section } from "../_legal/LegalShell";

export const metadata: Metadata = { title: "Privacy Policy — LinxTimes", robots: { index: false } };

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="Draft">
      <p>
        This policy explains what information LinxTimes collects and how it is used.{" "}
        <em>(Placeholder — replace with attorney-reviewed language covering the laws that apply to
        you, e.g. California CCPA/CPRA.)</em>
      </p>
      <Section heading="1. Information we collect">
        <p>When you book, we collect your name, email, phone, and booking details. Payment card data
        is collected and processed by Stripe — never stored on LinxTimes servers.</p>
      </Section>
      <Section heading="2. How we use it">
        <p>To create and manage your booking, send confirmations, provide it to the golf course you
        booked with, prevent fraud, and comply with law.</p>
      </Section>
      <Section heading="3. Sharing">
        <p>We share booking details with the relevant golf course and with service providers (e.g.
        Stripe for payments, our email provider). We do not sell your personal information.</p>
      </Section>
      <Section heading="4. Retention & your rights">
        <p>We keep booking records as long as needed for the service, accounting, and legal
        obligations. Depending on where you live, you may have rights to access or delete your data.
        <em> (Placeholder — counsel to specify rights, retention periods, and request process.)</em></p>
      </Section>
      <Section heading="5. Cookies">
        <p>We use essential cookies to keep you signed in and secure. <em>(Placeholder — add any
        analytics/consent details.)</em></p>
      </Section>
      <Section heading="6. Security & contact">
        <p>We use industry-standard safeguards; no method is 100% secure. Privacy questions:
        privacy@linxtimes.com.</p>
      </Section>
    </LegalShell>
  );
}
