export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    confirmed: "bg-green-100 text-green-800",
    checked_in: "bg-blue-100 text-blue-800",
    cancelled: "bg-black/[0.06] text-foreground/50",
    no_show: "bg-red-100 text-red-700",
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status] ?? ""}`}>
      {status.replace("_", " ")}
    </span>
  );
}

export function PaymentBadge({ status }: { status: string }) {
  const label: Record<string, string> = {
    paid_online: "Paid online",
    paid_in_person: "Paid at counter",
    partially_paid: "Part-paid",
    unpaid: "Unpaid",
    pay_at_course: "Pay at course",
    refunded: "Refunded",
  };
  const map: Record<string, string> = {
    paid_online: "bg-green-100 text-green-800",
    paid_in_person: "bg-green-100 text-green-800",
    partially_paid: "bg-blue-100 text-blue-800",
    unpaid: "bg-amber-100 text-amber-800",
    pay_at_course: "bg-black/[0.06] text-foreground/60",
    refunded: "bg-black/[0.06] text-foreground/50",
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status] ?? "bg-black/[0.06] text-foreground/60"}`}>
      {label[status] ?? status.replace(/_/g, " ")}
    </span>
  );
}
