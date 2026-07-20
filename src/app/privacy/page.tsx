import type { Metadata } from "next";
import { LegalShell, Section } from "../_legal/LegalShell";

export const metadata: Metadata = { title: "Privacy Policy — LinxTimes", robots: { index: false } };

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="2026-07-17">
      <p>
        LinxTimes, Inc. ("LinxTimes," "we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your personal information when you visit our website, use our mobile application, or book a tee time through our Service.
      </p>
      <p>
        Please read this Privacy Policy carefully. If you do not agree with our practices, please do not use the Service.
      </p>

      <Section heading="1. Information We Collect">
        <p><strong>Information You Provide:</strong></p>
        <ul style={{ marginLeft: "1.5rem", marginTop: "0.5rem" }}>
          <li>Name, email address, phone number, and mailing address when you create an account or make a booking</li>
          <li>Booking details including date, time, course, party size, and special requests</li>
          <li>Payment information (processed securely by Stripe; never stored on LinxTimes servers)</li>
          <li>Preferences, feedback, and communications you send us</li>
        </ul>

        <p style={{ marginTop: "1rem" }}><strong>Information Collected Automatically:</strong></p>
        <ul style={{ marginLeft: "1.5rem", marginTop: "0.5rem" }}>
          <li>IP address, browser type, and device information</li>
          <li>Pages visited, time spent, and actions taken on the Service (via cookies and analytics)</li>
          <li>Referral source and geographic location (general, not precise)</li>
          <li>Performance and error logs for troubleshooting and service improvement</li>
        </ul>

        <p style={{ marginTop: "1rem" }}><strong>Information from Third Parties:</strong></p>
        <ul style={{ marginLeft: "1.5rem", marginTop: "0.5rem" }}>
          <li>Payment processors (Stripe) provide transaction confirmations</li>
          <li>Golf courses you book with may provide feedback or operational information</li>
          <li>Third-party services (email, analytics) that help us operate the Service</li>
        </ul>
      </Section>

      <Section heading="2. How We Use Your Information">
        <p>LinxTimes uses your information for the following purposes:</p>
        <ul style={{ marginLeft: "1.5rem", marginTop: "0.5rem" }}>
          <li><strong>To provide the Service:</strong> Creating and managing bookings, processing payments, sending confirmations and updates</li>
          <li><strong>Communication:</strong> Sending booking confirmations, cancellation notices, and customer support responses</li>
          <li><strong>Course operations:</strong> Sharing your booking details with the Course to facilitate your tee time</li>
          <li><strong>Fraud prevention:</strong> Detecting and preventing fraudulent transactions and unauthorized access</li>
          <li><strong>Service improvement:</strong> Analyzing usage patterns to improve features, performance, and user experience</li>
          <li><strong>Legal compliance:</strong> Complying with applicable laws, regulations, and lawful requests from authorities</li>
          <li><strong>Marketing:</strong> Sending promotional content and service updates (with your consent; you may opt out anytime)</li>
        </ul>
      </Section>

      <Section heading="3. How We Share Your Information">
        <p>
          <strong>Golf Courses:</strong> We share your name, contact information, booking details, and any special requests with the Course you booked with to facilitate your tee time and provide customer service.
        </p>
        <p>
          <strong>Service Providers:</strong> We share information with third-party vendors who assist in operating the Service, including:
        </p>
        <ul style={{ marginLeft: "1.5rem", marginTop: "0.5rem" }}>
          <li>Stripe for payment processing</li>
          <li>Resend for transactional emails</li>
          <li>Sentry for error monitoring</li>
          <li>Analytics providers for usage insights</li>
        </ul>
        <p style={{ marginTop: "1rem" }}>
          All service providers are contractually obligated to protect your information and use it only for the purposes we specify.
        </p>
        <p>
          <strong>Legal Requirements:</strong> We may disclose information if required by law, court order, or government request, or to protect our rights and safety.
        </p>
        <p>
          <strong>No Sale of Data:</strong> LinxTimes does not sell, rent, or trade your personal information to third parties for their marketing purposes.
        </p>
      </Section>

      <Section heading="4. Data Retention">
        <p>
          LinxTimes retains your personal information for as long as necessary to provide the Service and fulfill the purposes outlined in this policy. Specifically:
        </p>
        <ul style={{ marginLeft: "1.5rem", marginTop: "0.5rem" }}>
          <li>Booking records are retained for at least 7 years for accounting and tax compliance</li>
          <li>Account information is retained while your account is active and for 2 years after closure</li>
          <li>Payment information is not retained by LinxTimes (Stripe retains per their policy)</li>
          <li>You may request deletion of your data, subject to legal retention obligations</li>
        </ul>
      </Section>

      <Section heading="5. Your Privacy Rights">
        <p>
          Depending on your location, you may have the following rights regarding your personal information:
        </p>
        <ul style={{ marginLeft: "1.5rem", marginTop: "0.5rem" }}>
          <li><strong>Right to Access:</strong> Request a copy of the personal information we hold about you</li>
          <li><strong>Right to Deletion:</strong> Request deletion of your data (subject to legal retention obligations)</li>
          <li><strong>Right to Correction:</strong> Request correction of inaccurate or incomplete information</li>
          <li><strong>Right to Opt-Out:</strong> Opt out of marketing communications or targeted advertising</li>
          <li><strong>Right to Data Portability:</strong> Request your data in a portable format</li>
          <li><strong>Right to Limit Use:</strong> Request limitation of how your data is used</li>
        </ul>
        <p style={{ marginTop: "1rem" }}>
          To exercise any of these rights, contact us at privacy@linxtimes.com with your request and proof of identity. We will respond within 45 days.
        </p>
      </Section>

      <Section heading="6. Cookies & Tracking">
        <p>
          LinxTimes uses cookies and similar tracking technologies to maintain your session, remember preferences, and analyze how you use the Service.
        </p>
        <p>
          <strong>Essential Cookies:</strong> These are required for the Service to function (login sessions, security).
        </p>
        <p>
          <strong>Analytics Cookies:</strong> These help us understand user behavior and improve our Service. You may disable these via your browser settings, though some functionality may be affected.
        </p>
        <p>
          You can control cookies through your browser settings. Disabling cookies may limit your ability to use certain features.
        </p>
      </Section>

      <Section heading="7. Third-Party Links">
        <p>
          The Service may contain links to third-party websites (e.g., golf courses, payment processors). LinxTimes is not responsible for the privacy practices of external sites. We encourage you to review their privacy policies before providing personal information.
        </p>
      </Section>

      <Section heading="8. Data Security">
        <p>
          LinxTimes employs industry-standard security measures to protect your personal information, including:
        </p>
        <ul style={{ marginLeft: "1.5rem", marginTop: "0.5rem" }}>
          <li>Encrypted data transmission (HTTPS/TLS)</li>
          <li>Secure authentication (HttpOnly, signed session cookies)</li>
          <li>Regular security audits and monitoring</li>
          <li>Restricted access to personal information</li>
          <li>PCI-DSS compliance via Stripe for payment handling</li>
        </ul>
        <p style={{ marginTop: "1rem" }}>
          While we implement robust safeguards, no system is 100% secure. You are responsible for maintaining the confidentiality of your login credentials.
        </p>
      </Section>

      <Section heading="9. Children's Privacy">
        <p>
          The Service is not directed to children under 13. We do not knowingly collect personal information from children under 13. If we become aware that we have collected such information, we will delete it promptly. Parents who believe their child has provided information to LinxTimes should contact us immediately.
        </p>
      </Section>

      <Section heading="10. International Data Transfers">
        <p>
          Your information may be transferred to, stored in, and processed in the United States or other countries where LinxTimes operates. By using the Service, you consent to the transfer of your information to jurisdictions outside your country of residence, which may have different privacy laws.
        </p>
      </Section>

      <Section heading="11. Changes to This Privacy Policy">
        <p>
          LinxTimes may update this Privacy Policy from time to time. We will notify you of material changes by posting the updated policy on this page and updating the "Last Updated" date. Continued use of the Service after such changes constitutes your acceptance of the updated Privacy Policy.
        </p>
      </Section>

      <Section heading="12. Contact Us">
        <p>
          If you have questions about this Privacy Policy or our privacy practices, please contact us at:
        </p>
        <p style={{ marginTop: "1rem" }}>
          <strong>LinxTimes, Inc.</strong><br />
          Email: privacy@linxtimes.com<br />
          Response time: Within 45 days
        </p>
        <p style={{ marginTop: "1rem" }}>
          If you are not satisfied with our response, you may have the right to lodge a complaint with a data protection authority in your jurisdiction.
        </p>
      </Section>
    </LegalShell>
  );
}
