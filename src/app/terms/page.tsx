import type { Metadata } from "next";
import { LegalShell, Section } from "../_legal/LegalShell";

export const metadata: Metadata = { title: "Terms of Service — LinxTimes", robots: { index: false } };

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="Draft">
      <p>
        These Terms govern your use of LinxTimes and the booking of tee times through it. By booking
        a tee time or using the service, you agree to these Terms. <em>(Placeholder — replace with
        attorney-reviewed language.)</em>
      </p>
      <Section heading="1. The service">
        <p>LinxTimes provides an online tee-time booking platform on behalf of participating golf
        courses. The golf course, not LinxTimes, provides the round of golf and related services.</p>
      </Section>
      <Section heading="2. Bookings & payment">
        <p>Prices, taxes, and fees are shown before you pay. Payment is processed securely by Stripe;
        card details are never stored by LinxTimes. The golf course is the merchant of record for the
        green and cart fees.</p>
      </Section>
      <Section heading="3. Cancellations & refunds">
        <p>Cancellation and refund terms are set by each course and shown at booking. Unless stated
        otherwise, the booking/convenience fee is non-refundable. Contact the course to cancel a paid
        booking.</p>
      </Section>
      <Section heading="4. Golfer conduct & course rules">
        <p>You agree to follow the course&apos;s rules, dress code, and pace-of-play policies.</p>
      </Section>
      <Section heading="5. Assumption of risk & liability">
        <p>Golf involves inherent risks. To the fullest extent permitted by law, LinxTimes is not
        liable for injury, loss, or damage arising from play or course conditions. LinxTimes&apos;
        total liability is limited as described here. <em>(Placeholder — counsel to finalize
        waiver/limitation language for your jurisdiction.)</em></p>
      </Section>
      <Section heading="6. Disclaimers">
        <p>The service is provided &quot;as is&quot; without warranties of any kind to the extent
        permitted by law.</p>
      </Section>
      <Section heading="7. Changes & contact">
        <p>We may update these Terms; material changes will be posted here. Questions:
        support@linxtimes.com.</p>
      </Section>
    </LegalShell>
  );
}
