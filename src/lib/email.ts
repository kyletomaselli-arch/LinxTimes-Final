import "server-only";
import { Resend } from "resend";
import { prisma } from "./prisma";
import { serverEnv } from "./env";
import { toDateKey } from "./datetime";
import {
  golferConfirmationEmail,
  adminNotificationEmail,
  cancellationEmail,
  passwordResetEmail,
  type BookingEmailData,
} from "./email-templates";

/**
 * Transactional email via Resend. If RESEND_API_KEY is not configured (e.g. in
 * local dev), emails are logged to the console instead of sent, so the booking
 * flow works end-to-end without email credentials. Sending never throws into
 * the caller — a failed email must not fail a paid booking.
 */

let _resend: Resend | null = null;
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!_resend) _resend = new Resend(key);
  return _resend;
}

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export async function sendEmail({ to, subject, html, replyTo }: SendArgs): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.log(`[email:dev] would send "${subject}" -> ${to}`);
    return;
  }
  try {
    await resend.emails.send({
      from: serverEnv.EMAIL_FROM,
      to,
      subject,
      html,
      replyTo,
    });
  } catch (err) {
    console.error(`[email] failed to send "${subject}" to ${to}`, err);
  }
}

/** Load a booking and shape it into the data every email template consumes. */
async function loadBookingEmailData(
  bookingId: string
): Promise<{ data: BookingEmailData; adminTo: string | null; golferEmail: string } | null> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { course: true, layout: true },
  });
  if (!booking) return null;

  const c = booking.course;
  const data: BookingEmailData = {
    courseName: c.name,
    courseCity: c.city,
    courseState: c.state,
    coursePhone: c.phone,
    primaryColor: c.primaryColor || "#0d3522",
    confirmationNo: booking.confirmationNo,
    layoutName: booking.layout.name,
    dateKey: toDateKey(booking.bookingDate),
    slotTime: booking.slotTime,
    numPlayers: booking.numPlayers,
    holes: booking.holes,
    withCart: booking.withCart,
    golferName: booking.golferName,
    golferEmail: booking.golferEmail,
    golferPhone: booking.golferPhone,
    totalCents: booking.totalCents,
    paymentStatus: booking.paymentStatus,
    source: booking.source,
    confirmUrl: `${serverEnv.APP_URL}/${c.slug}/confirm/${booking.confirmationNo}`,
  };
  return { data, adminTo: c.notificationEmail ?? c.email, golferEmail: booking.golferEmail };
}

/**
 * Send the golfer confirmation + course-admin notification for a booking.
 * Safe to call once per booking (webhook for online). Never throws.
 */
export async function sendBookingEmails(bookingId: string): Promise<void> {
  try {
    const loaded = await loadBookingEmailData(bookingId);
    if (!loaded) return;
    const { data, adminTo, golferEmail } = loaded;

    const golfer = golferConfirmationEmail(data);
    await sendEmail({
      to: golferEmail,
      subject: golfer.subject,
      html: golfer.html,
      replyTo: adminTo ?? undefined,
    });

    if (adminTo) {
      const admin = adminNotificationEmail(data);
      await sendEmail({ to: adminTo, subject: admin.subject, html: admin.html });
    }
  } catch (err) {
    console.error("[email] sendBookingEmails failed", err);
  }
}

/**
 * Email a course admin a password-reset link. Never throws into the caller.
 */
export async function sendPasswordResetEmail(
  to: string,
  name: string,
  resetUrl: string
): Promise<void> {
  try {
    const email = passwordResetEmail(name, resetUrl);
    await sendEmail({ to, subject: email.subject, html: email.html });
  } catch (err) {
    console.error("[email] sendPasswordResetEmail failed", err);
  }
}

/**
 * Notify the golfer that their booking was cancelled, including how much was
 * refunded (the LinxTimes convenience fee is non-refundable). Never throws.
 */
export async function sendCancellationEmail(
  bookingId: string,
  refundedCents: number
): Promise<void> {
  try {
    const loaded = await loadBookingEmailData(bookingId);
    if (!loaded) return;
    const email = cancellationEmail(loaded.data, refundedCents);
    await sendEmail({
      to: loaded.golferEmail,
      subject: email.subject,
      html: email.html,
      replyTo: loaded.adminTo ?? undefined,
    });
  } catch (err) {
    console.error("[email] sendCancellationEmail failed", err);
  }
}
