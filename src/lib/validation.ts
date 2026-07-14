import { z } from "zod";

/**
 * Shared input schemas. Every value that crosses the network boundary and
 * influences pricing, availability, or stored data is validated here so route
 * handlers never operate on unverified input.
 */

export const dateKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "Invalid date");

export const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:mm (24h)");

// Layout/course IDs are UUIDs except our fixed seed ids; accept a safe charset.
export const idSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, "Invalid id");

// Member IDs are human-entered; keep tight and length-bounded.
export const memberIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[A-Za-z0-9 _.-]+$/, "Invalid member id");

export const availabilityQuerySchema = z.object({
  layoutId: idSchema,
  date: dateKeySchema,
});

// One member code per member in the group (each validated server-side). Accepts
// a single `memberId` too for backward compatibility.
export const memberIdsSchema = z
  .array(memberIdSchema)
  .max(4)
  .optional()
  .default([]);

export const quoteSchema = z.object({
  layoutId: idSchema,
  date: dateKeySchema,
  slotTime: timeSchema,
  numPlayers: z.coerce.number().int().min(1).max(4),
  holes: z.union([z.literal(9), z.literal(18)]).default(18),
  withCart: z.boolean().default(false),
  memberId: memberIdSchema.nullable().optional(),
  memberIds: memberIdsSchema,
});

export type QuoteInput = z.infer<typeof quoteSchema>;

// Golfer-supplied PII for a booking. Kept tight; emails normalized to lowercase.
export const bookingSchema = z.object({
  layoutId: idSchema,
  date: dateKeySchema,
  slotTime: timeSchema,
  numPlayers: z.coerce.number().int().min(1).max(4),
  holes: z.union([z.literal(9), z.literal(18)]).default(18),
  withCart: z.boolean().default(false),
  memberId: memberIdSchema.nullable().optional(),
  memberIds: memberIdsSchema,
  agreedToTerms: z.boolean().default(false),
  golferName: z.string().trim().min(2).max(120),
  golferEmail: z.string().trim().toLowerCase().email().max(160),
  golferPhone: z
    .string()
    .trim()
    .max(40)
    .regex(/^[0-9+()\-.\s]*$/, "Invalid phone")
    .optional()
    .or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export type BookingInput = z.infer<typeof bookingSchema>;

export const waitlistSchema = z.object({
  layoutId: idSchema,
  date: dateKeySchema,
  slotTime: timeSchema,
  numPlayers: z.coerce.number().int().min(1).max(4),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(160),
  phone: z
    .string()
    .trim()
    .max(40)
    .regex(/^[0-9+()\-.\s]*$/, "Invalid phone")
    .optional()
    .or(z.literal("")),
});

export type WaitlistFormInput = z.infer<typeof waitlistSchema>;
