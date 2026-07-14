import type { Course, Pricing, Member, DiscountKind } from "../generated/prisma";
import { hourOf, isWeekend, dayOfWeek } from "./datetime";

export interface AppliedPromo {
  code: string;
  kind: DiscountKind; // "percent" | "amount"
  value: number; // percent (1-100) or cents off
}

export type RateType = "weekday" | "weekend" | "twilight" | "member";

export interface PricingInput {
  course: Pick<Course, "linxtimesFee" | "taxRateBps">;
  pricing: Pricing;
  dateKey: string;
  slotTime: string; // "HH:mm"
  numPlayers: number; // 1-4
  holes: 9 | 18;
  withCart: boolean;
  /**
   * Validated, active members in the group. The member rate applies to ONE slot
   * per member (and only on a date their discount is valid); every remaining
   * player pays the standard guest rate. This makes it impossible to get member
   * pricing for non-members.
   */
  members: Member[];
  /** A validated promo/discount code, applied to green + cart (course-funded). */
  promo?: AppliedPromo | null;
  /** A validated rain-check credit, applied after any promo discount. */
  credit?: { code: string; amountCents: number } | null;
}

export interface PriceBreakdown {
  rateType: RateType;
  perPlayerGreenCents: number; // representative (avg) per-player green fee
  greenFeeCents: number;
  cartFeeCents: number;
  bookingFeeCents: number; // LinxTimes convenience fee — guest slots only
  discountCents: number; // promo discount applied to green + cart
  promoCode: string | null;
  creditCents: number; // rain-check credit applied after the promo discount
  creditCode: string | null;
  taxCents: number; // sales tax on (green + cart − discount − credit + booking fee)
  totalCents: number;
  memberCount: number; // players priced at the member rate
  /** Whether any member benefit applied. */
  memberApplied: boolean;
}

/**
 * Does this member's discount apply on the given date?
 * discountDays "all" → always; "mon_thu" → Mon(1)..Thu(4) only.
 */
export function memberDiscountApplies(member: Member, dateKey: string): boolean {
  if (!member.isActive) return false;
  if (member.discountDays === "all") return true;
  const d = dayOfWeek(dateKey); // 0=Sun..6=Sat
  return d >= 1 && d <= 4;
}

/** The standard (guest / non-member) rate type for this date & time. */
export function guestRateType(
  input: Pick<PricingInput, "pricing" | "dateKey" | "slotTime">
): Exclude<RateType, "member"> {
  if (hourOf(input.slotTime) >= input.pricing.twilightHour) return "twilight";
  return isWeekend(input.dateKey) ? "weekend" : "weekday";
}

/** Standard (guest) per-player green fee in cents for the given rate type. */
function guestGreenFee(rateType: Exclude<RateType, "member">, input: PricingInput): number {
  const { pricing, holes } = input;
  switch (rateType) {
    case "twilight":
      return pricing.twilightFee; // flat — not halved for 9 holes
    case "weekend": {
      const base = pricing.weekendFee;
      return holes === 9 && pricing.nineHoleDiscount ? Math.round(base / 2) : base;
    }
    case "weekday":
    default: {
      const base = pricing.weekdayFee;
      return holes === 9 && pricing.nineHoleDiscount ? Math.round(base / 2) : base;
    }
  }
}

/** Per-member green fee (flat member rate; per-member override wins). */
function memberGreenFee(member: Member, pricing: Pricing): number {
  return member.greenFeeOverride ?? pricing.memberFee;
}

export function computePricing(input: PricingInput): PriceBreakdown {
  const { course, pricing, numPlayers, withCart } = input;

  // Only members whose discount is valid today get the member rate; cap at group
  // size so extra codes can't over-discount.
  const eligibleMembers = input.members
    .filter((m) => memberDiscountApplies(m, input.dateKey))
    .slice(0, numPlayers);
  const memberCount = eligibleMembers.length;
  const guestCount = numPlayers - memberCount;

  const gRateType = guestRateType(input);
  const guestPerPlayer = guestGreenFee(gRateType, input);

  // Green fee = each member's own rate + guests at the standard rate.
  const memberGreenTotal = eligibleMembers.reduce((n, m) => n + memberGreenFee(m, pricing), 0);
  const greenFeeCents = memberGreenTotal + guestPerPlayer * guestCount;

  // Cart: members with cart included ride free; everyone else pays per-player.
  let cartFeeCents = 0;
  if (withCart && pricing.cartAvailable) {
    const freeCarts = eligibleMembers.filter((m) => m.cartIncluded).length;
    const paidCarts = numPlayers - freeCarts;
    cartFeeCents = pricing.cartFee * paidCarts;
  }

  // LinxTimes convenience fee: guest slots only. A member's own slot is fee-free;
  // the fee applies to the guest slots they're paying for.
  const bookingFeeCents = course.linxtimesFee * guestCount;

  // Promo/discount — applies to the course's green + cart revenue (not the
  // LinxTimes fee). The course funds it. Capped so it never goes negative.
  const promo = input.promo ?? null;
  const discountBase = greenFeeCents + cartFeeCents;
  let discountCents = 0;
  if (promo) {
    discountCents =
      promo.kind === "percent"
        ? Math.round((discountBase * Math.min(100, Math.max(0, promo.value))) / 100)
        : Math.min(discountBase, Math.max(0, promo.value));
  }

  // Rain-check credit applies after any promo discount, capped to what's left of
  // the course revenue (green + cart − promo).
  const afterPromo = discountBase - discountCents;
  const credit = input.credit ?? null;
  const creditCents = credit ? Math.min(Math.max(0, credit.amountCents), afterPromo) : 0;
  const netCourse = afterPromo - creditCents;

  // Sales tax on (green + cart − discount − credit) + convenience fee (bundled
  // with the fee in the UI as "Taxes & fees"). The course remits it.
  const taxableCents = netCourse + bookingFeeCents;
  const taxCents = Math.round((taxableCents * (course.taxRateBps ?? 0)) / 10000);

  const totalCents = netCourse + bookingFeeCents + taxCents;

  return {
    rateType: memberCount > 0 ? "member" : gRateType,
    perPlayerGreenCents: numPlayers > 0 ? Math.round(greenFeeCents / numPlayers) : 0,
    greenFeeCents,
    cartFeeCents,
    bookingFeeCents,
    discountCents,
    promoCode: discountCents > 0 ? promo?.code ?? null : null,
    creditCents,
    creditCode: creditCents > 0 ? credit?.code ?? null : null,
    taxCents,
    totalCents,
    memberCount,
    memberApplied: memberCount > 0,
  };
}
