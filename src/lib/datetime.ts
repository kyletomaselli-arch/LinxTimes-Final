/**
 * Date/time helpers. Tee times are stored as "HH:mm" strings and dates as
 * @db.Date. We treat a course's local day as the unit of booking. Date math
 * here uses plain Y-M-D strings to avoid timezone drift; timezone-aware
 * comparisons (e.g. the 24-hour cancellation rule) live alongside this.
 */

/** "2026-06-30" for a Date (UTC date portion). */
export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Parse "2026-06-30" into a UTC midnight Date (suitable for @db.Date). */
export function fromDateKey(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

/** Today's date key in a given IANA timezone. */
export function todayKeyInTz(timezone: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date()); // en-CA gives YYYY-MM-DD
}

/** Current minutes-since-midnight in a given IANA timezone. */
export function nowMinutesInTz(timezone: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  let h = Number(parts.find((p) => p.type === "hour")?.value);
  if (h === 24) h = 0; // some engines emit 24 for midnight
  const m = Number(parts.find((p) => p.type === "minute")?.value);
  return h * 60 + m;
}

/** Online booking closes this many minutes before the tee time. */
export const BOOKING_LEAD_MINUTES = 5;

/**
 * True if a tee time (date + "HH:mm") is no longer bookable in the course tz —
 * i.e. it has passed or is within the lead-time cutoff (default 5 min before).
 */
export function isPastSlot(
  dateKey: string,
  hhmm: string,
  timezone: string,
  leadMinutes: number = BOOKING_LEAD_MINUTES
): boolean {
  const today = todayKeyInTz(timezone);
  if (dateKey < today) return true;
  if (dateKey > today) return false;
  return timeToMinutes(hhmm) <= nowMinutesInTz(timezone) + leadMinutes;
}

/** Day of week for a date key: 0=Sun .. 6=Sat (interpreted in UTC). */
export function dayOfWeek(key: string): number {
  return fromDateKey(key).getUTCDay();
}

export function isWeekend(key: string): boolean {
  const d = dayOfWeek(key);
  return d === 0 || d === 6;
}

/** Add n days to a date key. */
export function addDays(key: string, n: number): string {
  const d = fromDateKey(key);
  d.setUTCDate(d.getUTCDate() + n);
  return toDateKey(d);
}

/** Compare date keys: negative if a<b, 0 if equal, positive if a>b. */
export function compareDateKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** "07:00" -> minutes since midnight (420). */
export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** 420 -> "07:00" */
export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Hour (0-23) from "HH:mm". */
export function hourOf(hhmm: string): number {
  return Number(hhmm.split(":")[0]);
}

/** Human label "7:00 AM". */
export function formatTimeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/**
 * Compute the absolute instant of a tee time in a course's timezone, returned
 * as epoch milliseconds. Used to enforce the 24-hour cancellation rule.
 *
 * We derive the timezone offset for that wall-clock moment by formatting a
 * candidate UTC instant back into the target tz and measuring the delta.
 */
export function teeTimeEpochMs(
  dateKey: string,
  hhmm: string,
  timezone: string
): number {
  const [y, mo, d] = dateKey.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);

  // Start from the naive UTC interpretation of the wall clock.
  const naiveUtc = Date.UTC(y, mo - 1, d, h, mi, 0);

  // What wall-clock time does that instant show in the target tz?
  const tzWall = wallClockInTz(naiveUtc, timezone);
  const naiveWall = Date.UTC(
    tzWall.year,
    tzWall.month - 1,
    tzWall.day,
    tzWall.hour,
    tzWall.minute,
    0
  );

  // The difference is the tz offset; subtract it to land on the real instant.
  const offset = naiveWall - naiveUtc;
  return naiveUtc - offset;
}

function wallClockInTz(epochMs: number, timezone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date(epochMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  let hour = get("hour");
  if (hour === 24) hour = 0; // some engines emit 24 for midnight
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour,
    minute: get("minute"),
  };
}
