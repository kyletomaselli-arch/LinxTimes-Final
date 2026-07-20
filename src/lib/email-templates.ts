import { formatCentsCompact } from "./money";
import { formatTimeLabel, toDateKey } from "./datetime";

/**
 * Pure email HTML templates. No server-only imports so they can be rendered in
 * scripts/tests. Sending lives in email.ts.
 */

export interface BookingEmailData {
  courseName: string;
  courseCity: string | null;
  courseState: string | null;
  coursePhone: string | null;
  primaryColor: string;
  confirmationNo: string;
  layoutName: string;
  dateKey: string;
  slotTime: string;
  numPlayers: number;
  holes: number;
  withCart: boolean;
  golferName: string;
  golferEmail: string;
  golferPhone: string | null;
  totalCents: number;
  paymentStatus: string;
  source: string;
  confirmUrl: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(dateKey: string): string {
  return toDateKey(new Date(dateKey + "T00:00:00Z"));
}

function shell(primary: string, inner: string): string {
  return `<!doctype html><html><body style="margin:0;background:#eef5e9;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0b2418;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 10px 40px -20px rgba(11,36,24,.4);">
      <tr><td style="background:${primary};padding:22px 28px;">
        <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-.01em;">LinxTimes</span>
      </td></tr>
      ${inner}
      <tr><td style="padding:18px 28px;background:#f4f9ef;color:#5a7a68;font-size:12px;line-height:1.6;">
        You're receiving this because a tee time was booked at this course through LinxTimes. No LinxTimes account is required.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

/**
 * Course-admin password reset link. Not built on `shell()` because that footer
 * refers to a booking — this is an account-security email, not a booking one.
 */
export function passwordResetEmail(
  name: string,
  resetUrl: string
): { subject: string; html: string } {
  const html = `<!doctype html><html><body style="margin:0;background:#eef5e9;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0b2418;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 10px 40px -20px rgba(11,36,24,.4);">
      <tr><td style="background:#0d3522;padding:22px 28px;">
        <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-.01em;">LinxTimes</span>
      </td></tr>
      <tr><td style="padding:28px;">
        <h1 style="margin:0 0 12px;font-size:20px;color:#0b2418;">Reset your password</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#33473d;">Hi ${escapeHtml(name)}, we received a request to reset the password for your LinxTimes course dashboard.</p>
        <p style="margin:0 0 24px;"><a href="${resetUrl}" style="display:inline-block;background:#0d3522;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:999px;">Reset password</a></p>
        <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#5a7a68;">This link expires in 1 hour and can only be used once.</p>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#5a7a68;">If you didn't request this, you can safely ignore this email — your password won't change.</p>
      </td></tr>
      <tr><td style="padding:18px 28px;background:#f4f9ef;color:#5a7a68;font-size:12px;line-height:1.6;">
        This is a security email for your LinxTimes course dashboard account.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
  return { subject: "Reset your LinxTimes password", html };
}

function detailRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;color:#5a7a68;font-size:14px;">${label}</td>
    <td style="padding:6px 0;text-align:right;font-size:14px;font-weight:600;">${value}</td>
  </tr>`;
}

function paymentLabel(status: string): string {
  switch (status) {
    case "paid_online":
      return "Paid online";
    case "pay_at_course":
      return "Pay at the course";
    case "refunded":
      return "Refunded";
    default:
      return "Unpaid";
  }
}

export function golferConfirmationEmail(d: BookingEmailData): { subject: string; html: string } {
  const loc = [d.courseCity, d.courseState].filter(Boolean).join(", ");
  const inner = `
    <tr><td style="padding:30px 28px 8px;">
      <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#12a06f;font-weight:600;">Booking confirmed</div>
      <h1 style="margin:8px 0 4px;font-size:26px;font-weight:700;">See you on the first tee${d.golferName ? ", " + escapeHtml(d.golferName.split(" ")[0]) : ""}.</h1>
      <p style="margin:0;color:#5a7a68;font-size:15px;">${escapeHtml(d.courseName)}${loc ? " · " + escapeHtml(loc) : ""}</p>
    </td></tr>
    <tr><td style="padding:18px 28px;">
      <div style="background:#f4f9ef;border-radius:12px;padding:14px 18px;text-align:center;margin-bottom:18px;">
        <div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#5a7a68;">Confirmation number</div>
        <div style="font-family:ui-monospace,Menlo,monospace;font-size:15px;font-weight:700;color:${d.primaryColor};margin-top:4px;word-break:break-all;">${escapeHtml(d.confirmationNo)}</div>
      </div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${detailRow("Course", escapeHtml(d.layoutName))}
        ${detailRow("Date", fmtDate(d.dateKey))}
        ${detailRow("Time", formatTimeLabel(d.slotTime))}
        ${detailRow("Players", `${d.numPlayers} · ${d.holes} holes${d.withCart ? " · cart" : ""}`)}
        <tr><td colspan="2" style="padding:8px 0;"><hr style="border:none;border-top:1px solid #e4ece0;margin:0;"></td></tr>
        ${detailRow(paymentLabel(d.paymentStatus), formatCentsCompact(d.totalCents))}
      </table>
      <div style="text-align:center;margin-top:24px;">
        <a href="${d.confirmUrl}" style="display:inline-block;background:${d.primaryColor};color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:13px 28px;border-radius:999px;">View booking</a>
        <a href="https://www.google.com/maps/dir/?api=1&amp;destination=${encodeURIComponent([d.courseName, loc].filter(Boolean).join(", "))}" style="display:inline-block;margin-left:8px;background:#f4f9ef;color:${d.primaryColor};text-decoration:none;font-weight:600;font-size:14px;padding:13px 24px;border-radius:999px;">Get directions</a>
      </div>
      ${
        d.paymentStatus === "pay_at_course"
          ? `<p style="margin:20px 0 0;color:#5a7a68;font-size:13px;text-align:center;">Please pay at the course when you arrive${d.coursePhone ? ". Questions? Call " + escapeHtml(d.coursePhone) : "."}</p>`
          : ""
      }
    </td></tr>`;
  return {
    subject: `Tee time confirmed · ${d.courseName} · ${fmtDate(d.dateKey)}`,
    html: shell(d.primaryColor, inner),
  };
}

export function cancellationEmail(
  d: BookingEmailData,
  refundedCents: number
): { subject: string; html: string } {
  const feeCents = Math.max(0, d.totalCents - refundedCents);
  const refundBlock =
    refundedCents > 0
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px;">
          ${detailRow("Refunded to your card", formatCentsCompact(refundedCents))}
          ${detailRow("Convenience fee (non-refundable)", formatCentsCompact(feeCents))}
        </table>
        <p style="margin:14px 0 0;color:#5a7a68;font-size:13px;line-height:1.6;">Your green fee${d.withCart ? " and cart fee have" : " has"} been refunded to your original payment method. As noted at booking, the LinxTimes convenience fee is non-refundable. Refunds typically take 5–10 business days to appear.</p>`
      : `<p style="margin:14px 0 0;color:#5a7a68;font-size:13px;line-height:1.6;">No online payment was collected for this booking, so there is nothing to refund.</p>`;

  const inner = `
    <tr><td style="padding:30px 28px 8px;">
      <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#a3421d;font-weight:600;">Booking cancelled</div>
      <h1 style="margin:8px 0 4px;font-size:24px;font-weight:700;">Your tee time has been cancelled.</h1>
      <p style="margin:0;color:#5a7a68;font-size:15px;">${escapeHtml(d.courseName)} · ${escapeHtml(d.layoutName)}</p>
    </td></tr>
    <tr><td style="padding:18px 28px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${detailRow("Confirmation", escapeHtml(d.confirmationNo))}
        ${detailRow("Date", fmtDate(d.dateKey))}
        ${detailRow("Time", formatTimeLabel(d.slotTime))}
        ${detailRow("Players", `${d.numPlayers} · ${d.holes} holes`)}
      </table>
      <div style="margin-top:16px;border-top:1px solid #e4ece0;padding-top:14px;">${refundBlock}</div>
      ${d.coursePhone ? `<p style="margin:16px 0 0;color:#5a7a68;font-size:13px;">Questions? Call the course at ${escapeHtml(d.coursePhone)}.</p>` : ""}
    </td></tr>`;
  return {
    subject: `Cancelled · ${d.courseName} · ${fmtDate(d.dateKey)} ${formatTimeLabel(d.slotTime)}`,
    html: shell(d.primaryColor, inner),
  };
}

export interface WaitlistEmailData {
  courseName: string;
  primaryColor: string;
  layoutName: string;
  dateKey: string;
  slotTime: string;
  name: string;
  bookUrl: string;
}

export function waitlistSpotEmail(d: WaitlistEmailData): { subject: string; html: string } {
  const inner = `
    <tr><td style="padding:30px 28px 8px;">
      <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#12a06f;font-weight:600;">A spot opened up</div>
      <h1 style="margin:8px 0 4px;font-size:24px;font-weight:700;">Good news${d.name ? ", " + escapeHtml(d.name.split(" ")[0]) : ""} — a tee time is available.</h1>
      <p style="margin:0;color:#5a7a68;font-size:15px;">${escapeHtml(d.courseName)} · ${escapeHtml(d.layoutName)}</p>
    </td></tr>
    <tr><td style="padding:18px 28px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${detailRow("Date", fmtDate(d.dateKey))}
        ${detailRow("Time", formatTimeLabel(d.slotTime))}
      </table>
      <p style="margin:14px 0 0;color:#5a7a68;font-size:13px;line-height:1.6;">You&apos;re on the waitlist for this tee time and a spot just freed up. Times fill fast — book now to claim it.</p>
      <div style="text-align:center;margin-top:22px;">
        <a href="${d.bookUrl}" style="display:inline-block;background:${d.primaryColor};color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:13px 28px;border-radius:999px;">Book this tee time</a>
      </div>
    </td></tr>`;
  return {
    subject: `A spot opened · ${d.courseName} · ${fmtDate(d.dateKey)} ${formatTimeLabel(d.slotTime)}`,
    html: shell(d.primaryColor, inner),
  };
}

export function adminNotificationEmail(d: BookingEmailData): { subject: string; html: string } {
  const inner = `
    <tr><td style="padding:30px 28px 8px;">
      <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#12a06f;font-weight:600;">New booking</div>
      <h1 style="margin:8px 0 4px;font-size:24px;font-weight:700;">${escapeHtml(d.layoutName)} · ${formatTimeLabel(d.slotTime)}</h1>
      <p style="margin:0;color:#5a7a68;font-size:15px;">${fmtDate(d.dateKey)} · ${d.source} booking</p>
    </td></tr>
    <tr><td style="padding:18px 28px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${detailRow("Golfer", escapeHtml(d.golferName))}
        ${detailRow("Email", escapeHtml(d.golferEmail))}
        ${d.golferPhone ? detailRow("Phone", escapeHtml(d.golferPhone)) : ""}
        ${detailRow("Players", `${d.numPlayers} · ${d.holes} holes${d.withCart ? " · cart" : ""}`)}
        ${detailRow("Confirmation", escapeHtml(d.confirmationNo))}
        <tr><td colspan="2" style="padding:8px 0;"><hr style="border:none;border-top:1px solid #e4ece0;margin:0;"></td></tr>
        ${detailRow(paymentLabel(d.paymentStatus), formatCentsCompact(d.totalCents))}
      </table>
    </td></tr>`;
  return {
    subject: `New booking · ${d.layoutName} ${formatTimeLabel(d.slotTime)} · ${escapeHtml(d.golferName)}`,
    html: shell(d.primaryColor, inner),
  };
}
