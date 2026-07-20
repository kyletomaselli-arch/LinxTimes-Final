import type { Metadata } from "next";
import { LegalShell, Section } from "../_legal/LegalShell";

export const metadata: Metadata = { title: "Terms of Service — LinxTimes", robots: { index: false } };

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="2026-07-17">
      <p>
        These Terms of Service ("Terms") govern your access to and use of LinxTimes, including our website, mobile application, and services (collectively, the "Service"). By accessing, browsing, or booking a tee time through LinxTimes, you agree to be bound by these Terms. If you do not agree to all the terms and conditions herein, do not use the Service.
      </p>

      <Section heading="1. Description of Service">
        <p>
          LinxTimes is an online tee-time booking platform operated by LinxTimes, Inc. ("LinxTimes," "we," "us," or "our"). We facilitate bookings for golf courses and related services. Each golf course ("Course") is an independent operator and the merchant of record for all fees charged for green fees, cart rentals, and associated services. LinxTimes acts as a booking platform only and does not operate, manage, or control any golf course.
        </p>
      </Section>

      <Section heading="2. Booking & Payment">
        <p>
          When you book a tee time ("Booking"), you agree to pay all quoted fees, including green fees, cart fees, taxes, and the LinxTimes convenience fee. All prices are shown and confirmed before payment. Payment is processed securely by Stripe, Inc., a PCI-compliant payment processor. LinxTimes does not store or handle your credit card information directly. The Course is the merchant of record for fees and is responsible for remittance of applicable taxes.
        </p>
        <p>
          You authorize LinxTimes to charge your payment method for the full amount quoted. All transactions are final upon payment confirmation. Duplicate charges due to system errors will be refunded in full.
        </p>
      </Section>

      <Section heading="3. Cancellations & Refunds">
        <p>
          Each Course sets its own cancellation policy, which is displayed at the time of booking. Most Courses offer a 24-hour cancellation window before the tee time. After that period, cancellations may not be permitted or may be subject to a cancellation fee.
        </p>
        <p>
          The LinxTimes convenience fee is generally non-refundable. If you cancel within the Course&apos;s refund window, you will receive a refund of the green and cart fees minus the convenience fee. Refunds are processed to your original payment method within 5-7 business days.
        </p>
        <p>
          If a Course closes or cancels a tee time due to weather, maintenance, or other circumstances beyond your control, you will receive a full refund including the convenience fee. To request a cancellation, log into your account or contact the Course directly.
        </p>
      </Section>

      <Section heading="4. User Responsibilities & Conduct">
        <p>
          You agree to follow all applicable Course rules, including dress codes, pace-of-play policies, and safety regulations. You are responsible for arriving on time for your reserved tee time. No-shows or late arrivals may result in loss of your tee time without refund, at the Course&apos;s discretion.
        </p>
        <p>
          You agree not to engage in harassment, discrimination, or any conduct that violates the Course&apos;s policies or local laws.
        </p>
      </Section>

      <Section heading="5. Assumption of Risk & Limitation of Liability">
        <p>
          Golf is an inherently risky sport involving moving objects, outdoor conditions, and physical exertion. By booking and playing through LinxTimes, you acknowledge these risks and assume full responsibility for any injury, loss, or damage that may occur.
        </p>
        <p>
          TO THE FULLEST EXTENT PERMITTED BY LAW, LINXTIMES AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, OR DATA, ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE, EVEN IF LINXTIMES HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
        </p>
        <p>
          LINXTIMES&apos; TOTAL LIABILITY TO YOU FOR ANY CLAIM ARISING OUT OF OR RELATING TO THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE AMOUNT YOU PAID TO LINXTIMES IN THE 12 MONTHS PRECEDING THE CLAIM.
        </p>
        <p>
          The Course operator, not LinxTimes, is responsible for course conditions, safety equipment, and the quality of your golfing experience. LinxTimes is not liable for any claims arising from Course operations, weather, or course conditions.
        </p>
      </Section>

      <Section heading="6. Disclaimers">
        <p>
          The Service is provided "AS IS" and "AS AVAILABLE" without warranties of any kind, express or implied, including warranties of merchantability, fitness for a particular purpose, or non-infringement. LinxTimes does not warrant that the Service will be uninterrupted, error-free, or secure.
        </p>
        <p>
          We do not guarantee Course availability, tee time availability, or the quality of any Course or service. Course closures, weather delays, or operational changes may affect your booking.
        </p>
      </Section>

      <Section heading="7. Indemnification">
        <p>
          You agree to indemnify, defend, and hold harmless LinxTimes, its affiliates, and their respective officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses (including attorneys&apos; fees) arising from your use of the Service, violation of these Terms, or any claim that you injured or harmed any third party.
        </p>
      </Section>

      <Section heading="8. Privacy & Data">
        <p>
          Your personal information, including name, email, and payment details, is collected and processed in accordance with our Privacy Policy. By using the Service, you consent to our collection and use of your data as described in the Privacy Policy.
        </p>
      </Section>

      <Section heading="9. Modifications to Terms">
        <p>
          LinxTimes may modify these Terms at any time. Continued use of the Service after such modifications constitutes your acceptance of the updated Terms. We encourage you to review these Terms periodically for changes.
        </p>
      </Section>

      <Section heading="10. Governing Law & Dispute Resolution">
        <p>
          These Terms are governed by and construed in accordance with the laws of the State of Delaware, without regard to its conflict-of-law principles. Any legal action or proceeding arising under these Terms shall be brought exclusively in the state and federal courts located in Delaware, and you consent to the personal jurisdiction and venue of such courts.
        </p>
      </Section>

      <Section heading="11. Severability">
        <p>
          If any provision of these Terms is found to be invalid or unenforceable, that provision shall be modified to the minimum extent necessary to make it enforceable, or if that is not possible, severed, and the remaining provisions shall remain in full force and effect.
        </p>
      </Section>

      <Section heading="12. Contact & Support">
        <p>
          For questions about these Terms or the Service, contact LinxTimes at support@linxtimes.com.
        </p>
      </Section>
      <Section heading="7. Changes & contact">
        <p>We may update these Terms; material changes will be posted here. Questions:
        support@linxtimes.com.</p>
      </Section>
    </LegalShell>
  );
}
