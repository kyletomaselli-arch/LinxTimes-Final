import "dotenv/config";
import { writeFileSync } from "node:fs";
import { cancellationEmail, type BookingEmailData } from "../src/lib/email-templates";
import { teeTimeEpochMs } from "../src/lib/datetime";

const WINDOW = 24;

function hoursUntil(dateKey: string, slot: string, tz: string, now: number): number {
  return (teeTimeEpochMs(dateKey, slot, tz) - now) / 3_600_000;
}

function check(label: string, dateKey: string, slot: string, now: number) {
  const hrs = hoursUntil(dateKey, slot, "America/Chicago", now);
  const blocked = hrs < WINDOW;
  console.log(
    `${label}: tee=${dateKey} ${slot}  hoursAway=${hrs.toFixed(1)}  -> ${
      blocked ? "BLOCKED (needs override)" : "allowed"
    }`
  );
}

// A "now" of 2026-07-01 12:00 America/Chicago for deterministic checks.
const now = teeTimeEpochMs("2026-07-01", "12:00", "America/Chicago");

console.log("=== 24-hour rule enforcement ===");
check("Well ahead (4 days)", "2026-07-05", "09:00", now); // allowed
check("Exactly ~26h", "2026-07-02", "14:00", now); // allowed
check("Inside window (~5h)", "2026-07-01", "17:00", now); // blocked
check("Tomorrow but <24h (~20h)", "2026-07-02", "08:00", now); // blocked

// Cancellation email preview — realistic paid-online scenario.
const total = 14800;
const fee = 200; // LinxTimes convenience fee (non-refundable)
const refunded = total - fee;

const data: BookingEmailData = {
  courseName: "Winged Pheasant Golf Links",
  courseCity: "Nashville",
  courseState: "TN",
  coursePhone: "615-555-0100",
  primaryColor: "#0d3522",
  confirmationNo: "WINGED-PHEASANT-GOLF-LINKS-20260705-0001",
  layoutName: "The Liberator",
  dateKey: "2026-07-05",
  slotTime: "09:00",
  numPlayers: 2,
  holes: 18,
  withCart: true,
  golferName: "Jane Golfer",
  golferEmail: "jane@example.com",
  golferPhone: null,
  totalCents: total,
  paymentStatus: "refunded",
  source: "online",
  confirmUrl: "http://localhost:3000/winged-pheasant-golf-links/confirm/x",
};

const email = cancellationEmail(data, refunded);
writeFileSync("public/email-cancellation.html", email.html);
console.log("\n=== Refund split ===");
console.log(`total=$${(total / 100).toFixed(2)}  refunded=$${(refunded / 100).toFixed(2)}  keptFee=$${(fee / 100).toFixed(2)}`);
console.log("Subject:", email.subject);
console.log("Wrote public/email-cancellation.html");
