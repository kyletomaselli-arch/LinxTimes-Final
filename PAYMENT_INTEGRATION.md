# Payment Integration Summary

## Overview
LinxTimes now has complete payment processing for all three scenarios: online bookings, in-person counter payments, and membership enrollment.

---

## Payment Flows

### 1. Online Booking Payment ✅
**File**: `src/app/[slug]/PaymentStep.tsx`
- **Method**: Stripe Elements (card payment)
- **Flow**: Client-side card capture → Stripe → Webhook confirmation
- **Status**: Working (existing implementation)
- **Webhook Handler**: `handlePaymentSucceeded` for `bookingId` metadata

### 2. In-Person Booking Payment ✅
**Files**: 
- `src/app/dashboard/actions.ts` → `collectPayment`
- `src/lib/inperson-payment.ts` → `startTerminalPayment`

- **Methods**: Stripe Terminal (card) or Cash
- **Terminal Flow**: 
  1. Create payment record (pending)
  2. Create Stripe PaymentIntent with `kind: "in_person"`
  3. Push to physical reader
  4. Webhook confirms payment
  5. Booking status updated to "paid_in_person"
- **Cash Flow**: Record immediately as succeeded
- **Fee Calculation**: $1/online player, $0.50/in-person player
- **Webhook Handler**: `handlePaymentSucceeded` for `kind: "in_person"`

### 3. Membership Enrollment Payment ✅ **NEW**
**Files**:
- `src/app/dashboard/(app)/members/_components/EnrollMemberForm.tsx`
- `src/app/dashboard/(app)/members/actions.ts`

- **Methods**: Stripe Terminal (card) or Cash
- **Terminal Flow**:
  1. Form submits → creates Payment record (pending) with metadata
  2. Creates Stripe PaymentIntent with `kind: "membership"`
  3. Pushes to physical reader
  4. Form polls `checkMembershipPaymentStatus` every 1 second
  5. Webhook creates Member on success
  6. Form shows success screen and closes
- **Cash Flow**: Creates member immediately, records payment
- **Fee Calculation**: 2% of tier price capped at $10 + tax (displayed as "Taxes and fees")
- **Webhook Handler**: `handlePaymentSucceeded` for `kind: "membership"`

---

## Database Schema Changes

### Payment Model Updates
**File**: `prisma/schema.prisma`

```prisma
model Payment {
  // ... existing fields ...
  
  // NEW FIELDS for membership support:
  bookingId             String?       // null for membership payments
  description           String?       // for non-booking payments
  metadata              Json?         // stores enrollment data
  
  booking Booking? @relation(...)    // changed from required to optional
}
```

**Migration**: `20260715173614_add_membership_payment_fields`

---

## API Changes

### New Action: `checkMembershipPaymentStatus`
**Location**: `src/app/dashboard/(app)/members/actions.ts`
```typescript
export async function checkMembershipPaymentStatus(
  paymentId: string
): Promise<{ status: "pending" | "succeeded" | "failed"; message?: string }>
```
- Polls payment status by ID
- Returns current state for client-side polling

### Updated Action: `enrollNewMember`
**Location**: `src/app/dashboard/(app)/members/actions.ts`
- Now returns `{ ok: boolean; message: string; paymentId?: string }`
- Initiates Stripe Terminal payment
- For cash: immediately creates member and payment record
- For terminal: creates payment record and returns paymentId for polling

### Webhook Updates
**File**: `src/app/api/webhooks/stripe/route.ts`
- `handlePaymentSucceeded`: Now handles `kind: "membership"` payments
  - Extracts member data from payment metadata
  - Creates member record
  - Marks payment as succeeded
- `handlePaymentFailed`: Now handles `kind: "membership"` failures
  - Marks payment as failed
  - Member is never created

---

## UI/UX Improvements

### EnrollMemberForm Component
**File**: `src/app/dashboard/(app)/members/_components/EnrollMemberForm.tsx`

**New Screens**:
1. **Form Screen** (initial)
   - Member details input
   - Membership tier selection
   - Price breakdown showing "Taxes and fees" combined
   - Payment method selection (Card reader / Cash)

2. **Processing Screen** (terminal payments only)
   - Loading spinner
   - "Hold the card near the reader" message
   - Polls every 1 second for payment status

3. **Success Screen**
   - Green checkmark
   - "Payment successful" message
   - Auto-closes after 1.5 seconds
   - Refreshes page to show new member

4. **Failure Screen**
   - Red X icon
   - Error message from gateway
   - "Try again" button to retry payment
   - Keeps form data for retry

**Key Features**:
- Proper state management for payment lifecycle
- No member created until payment succeeds (terminal only)
- Immediate feedback for cash payments
- Clear error handling and retry flow

---

## Fee Structure

### Membership Enrollment
- **Linx Fee**: 2% of tier price, capped at $10.00
- **Tax**: Based on course tax rate (calculated on tier price)
- **Total Display**: Combined as "Taxes and fees"
- **Example** (Annual Membership at $400):
  - Membership: $400.00
  - Taxes and fees: $41.00 ($8 Linx fee + $33 tax)
  - Total: $441.00

### In-Person Booking
- **Online Players**: $1.00 per player
- **In-Person Players**: $0.50 per player
- **Pro-Shop Add-ons**: Additional $0.50 if items purchased
- **Collected via**: Stripe Terminal or cash (no fee on cash)

---

## Error Handling

### Terminal Payment Failures
1. **Reader Offline**: Returns "Check the reader is online"
2. **Card Declined**: Webhook marks payment as failed, user can retry
3. **Network Error**: Webhook timeout triggers eventual failure
4. **Double-tap Guard**: Prevents multiple payments in-flight

### Validation
- Tier must exist and be active
- Reader must be registered
- Stripe account must be connected and onboarded
- No duplicate member IDs generated

---

## Testing Checklist

- [ ] Cash membership payment creates member immediately
- [ ] Terminal membership payment waits for payment before creating member
- [ ] Payment polling detects success within 1-2 seconds
- [ ] Payment polling detects failure properly
- [ ] Failed payment shows error and allows retry
- [ ] Success screen auto-closes after 1.5s
- [ ] "Taxes and fees" math adds up correctly
- [ ] In-person booking payments still work (regression test)
- [ ] Online booking payments still work (regression test)
- [ ] Webhook handles both success and failure events

---

## Security Notes

1. **Amount Never Trusted**: All fees/taxes calculated server-side
2. **Idempotent Webhook**: Handles Stripe retries correctly
3. **Tenant Isolation**: All payments scoped to course via `requireCourseAdmin`
4. **No Double-Charging**: Guards prevent multiple terminals requests per payment
5. **Metadata Sealed**: Member data stored in sealed Payment record for audit trail

---

## Files Modified

1. `prisma/schema.prisma` - Schema changes
2. `src/app/dashboard/(app)/members/actions.ts` - Enrollment logic
3. `src/app/dashboard/(app)/members/_components/EnrollMemberForm.tsx` - UI
4. `src/app/api/webhooks/stripe/route.ts` - Payment confirmation

## Files Created

1. `prisma/migrations/20260715173614_add_membership_payment_fields/migration.sql` - DB migration
