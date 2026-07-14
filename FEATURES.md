# LinxTimes — Features & Selling Points

A running list of what LinxTimes does, written to help pitch a golf course. Kept up to date as we build. Grouped by who benefits.

---

## For the golfer (booking experience)
- **Beautiful, branded booking page** — each course gets its own page with its logo, colors, and hero image (not a generic portal).
- **Live pricing as they book** — green fee, cart, taxes & fees, and total update instantly as they pick players, holes, and cart.
- **One clean page, no wizard** — pick a time and the details open right there; no clunky multi-step redirects.
- **Cart or walking** — a clear selector (cart on by default as an upsell), price updates live.
- **Member & guest pricing** — members enter their code for member rates; guests in the same group pay standard rates automatically.
- **Discount / promo codes** — golfers redeem course-created codes (% or $ off) at checkout.
- **Waitlist for full tee times** — golfers join a waitlist and get emailed automatically if a spot opens. *(Most booking services don't offer this.)*
- **Instant confirmation** — on-screen + email, with "Add to calendar" and "Get directions" links.
- **Special requests** — golfers add a note at booking (birthday, club rental, "pair us up") that the pro shop sees on the tee sheet.
- **Secure payment** — card handled by Stripe; card details never touch our servers (PCI-compliant).

## For the pro shop / course staff (daily operations)
- **Live tee sheet** — see the day at a glance: who's booked, party size, cart, and payment status; List or Grid view. Now-time indicator (red dot + current time) updates throughout the day.
- **Cart visibility** — a cart badge on every booking so staff know who's riding.
- **Member badge** — see which groups include members.
- **Check-in & no-show** — one tap to mark arrivals and no-shows.
- **Walk-in & phone bookings** — add bookings at the counter, into any open slot.
- **In-person payments** — charge walk-ins on a Stripe card reader (whole tee time, per player, split across cards, or custom amount); cash too.
- **In-person receipts** — the card reader charge emails the golfer a Stripe receipt (uses the booking's email or one entered at the counter).
- **Pro-shop point-of-sale add-ons** — sell rentals, range balls, merch at the counter: staff tap items and the bill updates live with tax, charged on the same card reader or cash. Turns the tee sheet into a mini POS.
- **Multi-group tee times** — add a second group to a partially-filled time (e.g., a twosome + a new twosome).
- **Smart cancellations** — outside 24h cancels in one click and shows the refund amount; inside 24h asks for confirmation.
- **Tournament / outing blocking** — close a whole time range (e.g., 8–11am) with a note, in one action.
- **Printable tee sheet** — a clean, one-click printout for the counter.
- **Booking management** — filter, search, and CSV export (with tax totals for remittance).

## For the course owner / manager (business)
- **Automatic split payments** — the green/cart fee (and tax) flow straight to the course's own Stripe account; no invoicing, no waiting.
- **Own your money** — the course is the merchant of record; payouts go directly to their bank.
- **Roles & revenue privacy** — owners/managers see revenue; front-desk staff don't.
- **Team management** — invite staff with roles; owners control access.
- **Operational dashboard** — bookings, players, fill rate, and revenue trends (14-day switchable chart with y-axis labels for easy reference).
- **Financial report** — owner/manager-only, date-range: revenue, tax collected, platform fees, refunds, discounts, rain checks, and net to the course — everything the bookkeeper needs, plus CSV export.
- **Member management** — CRUD members, per-member rates, CSV import/export.
- **Flexible pricing** — weekday/weekend/twilight rates, cart fees, 9-hole discounts, per-course fees.
- **Configurable tax** — per-course sales-tax rate, collected and remitted by the course.
- **Discount codes** — run promos to fill slow days (% or $ off, expiry, usage caps).
- **Announcement banner** — post a message on the booking page (frost delays, aeration, twilight rates) — set it in Settings, golfers see it before booking.
- **Rain checks / credits** — issue a golfer a credit (rained-out round, goodwill); they redeem the code at checkout. Single-use, tracked. Most booking tools handle weather poorly — this doesn't.

## Why LinxTimes is better
- **Waitlist + auto-notify** — turns lost "sold out" traffic into recovered bookings. Rare in this space.
- **Direct, split payouts** — money lands in the course's account automatically; no reconciliation or payout delays.
- **Members + guests handled correctly** — member pricing can't leak to non-members; guests always pay full rate.
- **Real in-person point-of-sale** — drives a Stripe reader, so the pro shop replaces its old terminal entirely.
- **Branded, modern experience** — the booking page looks like the course, not a third-party marketplace.
- **Transparent pricing** — golfers see taxes & fees before paying; no surprises, fewer chargebacks.

---

## Coming soon / roadmap
- Real-time reminders *(deferred — not planned)*
- Cancellation fee option (so courses don't absorb Stripe's refund cost)
- Recurring / standing tee times for members
- Automated multi-jurisdiction tax (Stripe Tax)

*(This file is maintained by the build process — update it whenever a feature ships.)*
