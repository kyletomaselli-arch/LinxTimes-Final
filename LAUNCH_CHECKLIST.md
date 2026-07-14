# LinxTimes — Pre-Launch Test Checklist

Nothing ships to a real course until every box here is checked in a **production build** (`npm run build && npm start`), not just dev. Test-mode Stripe keys are fine for the dry run; switch to live keys only at the very end.

Legend: ☐ = not tested · ✅ = passed · ❌ = failed (needs fix)

---

## 1. Public booking (golfer-facing)
- ☐ Course page loads at `/[slug]` with correct branding (logo, colors, hero)
- ☐ Unknown slug → branded 404
- ☐ Suspended/inactive course → not bookable
- ☐ Tee-time grid shows correct available times for each layout & day
- ☐ Past dates and beyond the booking window are not selectable
- ☐ On TODAY, tee times already passed (in the course's timezone) are not bookable (grid + server guard); future times same-day still work
- ☐ Timezone edge: a course in a different tz sees the correct "passed" cutoff (not the server's local time)
- ☐ Selecting a slot opens the inline details drawer under that row
- ☐ Player count, holes (9/18), and **cart selector (defaults to Ride)** all update the live price
- ☐ Switching to **Walking** removes the cart fee from the quote
- ☐ Layout with no cart available → cart selector hidden, no cart fee ever charged
- ☐ Convenience fee shows correctly in the summary
- ☐ Booking a full tee time is blocked ("full")
- ☐ Booking more players than spots left is blocked with the right message
- ☐ Confirmation page shows correct details incl. Cart/Walking + "Add to calendar" works

## 2. Online payment (Stripe)
- ☐ Card `4242 4242 4242 4242` completes payment
- ☐ Declined card `4000 0000 0000 0002` shows a friendly error, slot released
- ☐ Amount charged matches the quote exactly (server-computed, not client)
- ☐ Application fee (LinxTimes) split out; remainder to course's connected account
- ☐ Webhook `payment_intent.succeeded` marks booking `paid_online`
- ☐ Confirmation email sent to golfer (once, not duplicated on webhook retry)
- ☐ New-booking email sent to course notification address
- ☐ Course NOT connected to Stripe → booking blocked with 402 message
- ☐ Double-submit / refresh does not create two bookings or two charges (idempotency)

## 3. In-person payment (counter)
- ☐ Owner can register a card reader (auto-creates Terminal Location)
- ☐ Reader form shows success/error message
- ☐ Collect **whole** amount on card → reader prompts, tap succeeds, booking `paid_in_person`
- ☐ In-person fee ($/player) added on top and taken as application fee
- ☐ Collect **by player** (e.g. 2 of 4) → booking becomes `partially_paid`, remaining correct
- ☐ Collect **custom amount** works and caps at remaining
- ☐ Split across multiple cards (pay remaining in 2+ taps) reaches `paid_in_person`
- ☐ **Cash** payment records correctly, no platform fee, booking marked paid
- ☐ Double-clicking "charge" is blocked (no duplicate in-flight charge)
- ☐ Already-paid booking cannot be collected again
- ☐ **In-person receipt** — card-reader charge sets receipt_email (booking email or counter-entered); confirm Stripe emails the receipt in LIVE mode (test mode won't send). Cash = no Stripe receipt (decide if you want a custom one).

## 4. Cancellation & refund
- ☐ Cancel outside 24h → partial refund (green+cart), LinxTimes fee kept
- ☐ Refund pulls from the course's account (reverse_transfer), booking `refunded`
- ☐ Cancel inside 24h is blocked unless override + reason
- ☐ Override logs the reason
- ☐ Cancelling a walk-in / unpaid booking → no refund attempted, just cancelled
- ☐ Cancellation email sent (notes non-refundable convenience fee)
- ☐ Cancelled slot frees the spot back on the tee sheet
- ☐ **DECIDE: who eats the Stripe fee on a refund?** On a refund Stripe keeps the original 2.9%+$0.30 (not returned); currently the COURSE absorbs it (they're the settlement merchant). Consider a per-course optional **cancellation fee** so courses don't lose money on cancellations. Confirm courses are OK with this or build the option.

## 5. Capacity & multi-group
- ☐ Two separate groups can share one tee time up to max players
- ☐ Adding a group beyond capacity is rejected (advisory-lock, no overbooking)
- ☐ Concurrent bookings for the same slot can't oversell
- ☐ Editing a walk-in's group size re-checks capacity and recomputes price
- ☐ Online booking edit = contact details only (group size locked)

## 6. Members
- ☐ Valid member ID applies member pricing in the quote
- ☐ Invalid/inactive member ID → no discount, clear feedback
- ☐ Member CRUD works (add/edit/deactivate)
- ☐ Member CSV import and export work
- ☐ Member pricing is correct at checkout (server-side, not just the quote)
- ☐ **$0 / comp member** (free green + cart included) checks out with NO payment step → booking confirmed + emailed (Stripe has no sub-$0.50 charge)
- ☐ **Member/guest split**: a member + guests → member rate for the member ONLY, guests at standard rate (member pricing can NEVER apply to non-members)
- ☐ **Multiple members**: each member enters their own code, each validated; N valid codes = N member-priced slots (extra/invalid codes don't over-discount)
- ☐ Member lookup is submit-based ("Apply member pricing"), not search-as-you-type
- ☐ Member-only slot carries no LinxTimes fee; guest slots do
- ☐ Course sees the ★ Member badge (+ count) on tee sheet and Bookings

## 6b. Sales tax
- ☐ Per-course tax rate set in super-admin (Sales tax %) saves and applies
- ☐ Quote + confirmation show a single **"Taxes & fees"** line (LinxTimes fee + tax bundled)
- ☐ Tax = rate × (green + cart + LinxTimes fee); math correct to the cent
- ☐ Tax flows to the **course's** Stripe account (NOT taken as LinxTimes application fee)
- ☐ Tax rate 0% → no tax line, totals unchanged
- ☐ **LEGAL:** confirm sales-tax obligations per course location AND whether marketplace-facilitator laws make LinxTimes the collector/remitter — consult a CPA/tax attorney before live charges
- ✅ In-person (counter) sales are now taxed — collecting a payment applies the course tax rate to the green/cart + pro-shop items (avoids double-taxing an already-taxed online booking)
- ☐ Pro-shop POS: add items in Shop, verify tapping them updates the live bill + tax, charges correctly on card + cash, and receipt/refund handling for merch is acceptable

## 7. Course admin dashboard
- ☐ Login works; bad password rejected; rate-limited
- ☐ Tee sheet: day nav shows the **selected** date (not "Today"), arrows + Jump to today
- ☐ Tee sheet shows carts at a glance (list + grid + popover)
- ☐ Payment status labels are correct everywhere (Paid online / Paid at counter / Part-paid / Unpaid / Refunded)
- ☐ Chart: metric toggle (Players / Bookings / Fill rate / Revenue) all render
- ☐ Add walk-in / phone booking from an open slot works
- ☐ Bookings page grouped by date, filters + search + CSV export work
- ☐ Tee Times: weekly templates + daily overrides (close day / close slot) apply
- ☐ Pricing edits reflect in public quotes
- ☐ Settings: profile, colors, notification email, password change

## 8. Roles & permissions
- ☐ Staff role does NOT see revenue (dashboard card, chart Revenue metric, Total column, CSV money)
- ☐ Owner/manager DO see revenue
- ☐ Only owners can manage team (invite / change role / remove)
- ☐ Owner can't remove self or the last owner
- ☐ Only owners can connect Stripe / register reader

## 9. Onboarding
- ☐ `/request` self-service form creates a pending request + internal email
- ☐ Super-admin approve → creates course + token, sends `/onboard?token=` link
- ☐ Whitelisted email path works
- ☐ Set-password creates admin + session → dashboard
- ☐ "Go live" flips course to active and opens the public page
- ☐ Onboarding re-verifies eligibility server-side (can't claim someone else's course)

## 10. Super-admin (LinxTimes backend)
- ☐ Separate login; course-admin cookie can't access it and vice-versa
- ☐ Requests: approve / decline (with reason)
- ☐ Courses: list, whitelist, edit online & in-person fees, suspend/activate
- ☐ Platform stats: revenue, per-course breakdown, fees kept on cancel
- ☐ Per-course fees actually apply to that course's bookings

## 11. Security (money + PII — zero tolerance)
- ☐ Card data never touches our server (Stripe Elements only)
- ☐ All amounts computed server-side; tampering the client payload can't change price
- ☐ Every query scoped by courseId (no cross-tenant data leak) — try another course's IDs
- ☐ Webhook rejects missing/invalid signature (400)
- ☐ Secrets only in gitignored `.env`; none in the repo or client bundle
- ☐ Public endpoints rate-limited
- ☐ Auth cookies HttpOnly, signed, expire; expired/tampered cookie rejected
- ☐ Rotate Neon DB password + any exposed keys before launch

## 12. Reliability & ops
- ✅ Error monitoring (Sentry) wired — client + server + edge; DSN in .env. TODO for readable prod stack traces: add SENTRY_AUTH_TOKEN + org/project to withSentryConfig for source-map upload. Confirm the test event landed in the Sentry dashboard.
- ☐ Production build succeeds (`npm run build`) with no type errors
- ☐ Emails send via real Resend key (not dev no-op)
- ☐ Stripe **live** keys + a **dashboard webhook endpoint** (not CLI) configured
- ☐ Account onboarding edge: connected-but-not-verified shows "Refresh status" and recovers
- ☐ Timezone correctness: a course in its own tz sees correct day boundaries & 24h rule
- ☐ Load/latency acceptable on the deployed environment (not dev)
- ☐ Backups / DB migration plan confirmed

## 12b. Legal & accessibility
- ☐ **★ Replace DRAFT legal text** — /terms & /privacy are placeholder scaffolding with a "pending legal review" banner; a lawyer must write the real Terms, Privacy Policy, and course contracts before live payments
- ☐ Booking terms-consent checkbox blocks booking when unchecked; `termsAcceptedAt` is stored (built ✓ — verify)
- ☐ **Accessibility (ADA/WCAG)** — skip link, focus-visible ring, and main landmarks added; still needs a full audit: screen-reader pass, color-contrast check, form-label association, third-party scan (axe/Lighthouse)
- ☐ Marketplace-facilitator status, business entity (LLC) + insurance (E&O, cyber) — for counsel
- ☐ Add /terms & /privacy links to a site footer (currently linked only at the booking checkbox)

## 12c. Waitlist
- ☐ Full tee time shows "Full · Join waitlist"; modal submits and stores entry
- ☐ Duplicate join (same email + slot) is rejected
- ☐ Cancelling a booking on that slot emails everyone waiting (once) + sets notifiedAt
- ☐ **Auto-expiry** — waitlist entries for past dates need cleanup (no scheduled job yet); build a cron or delete-on-read before launch
- ☐ Waitlist PII covered by the Privacy Policy

## 12d. Discounts, rain checks, receipts
- ☐ Promo code applies correctly (% and $), respects expiry + max redemptions; timesRedeemed increments
- ☐ Rain check applies as a credit, is single-use (marked redeemed + linked to booking), void works
- ☐ **EDGE:** a rain check is consumed at booking creation (before payment). If the golfer abandons/fails payment, the booking is cancelled but the rain check is NOT restored — build a restore-on-cancel/fail, or accept it
- ☐ Confirmation page reconciles: green + cart − discount − rain check + taxes & fees = total
- ☐ Decide if the confirmation EMAIL should be itemized too (currently total-only)

## 13. Known edge cases to re-check
- ☐ Stranded `pending` terminal payment (golfer never taps) — confirm it can be cleared, doesn't permanently block collection
- ☐ Reader offline when charging → friendly error
- ☐ Partial refund math when a booking was split across multiple in-person payments
- ☐ Very long course names / addresses / special characters in branding
