"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * While a booking's payment is still "unpaid" (webhook in flight), quietly
 * re-fetch the page every 3 seconds — up to 20 tries — so "Almost there"
 * flips to the green check on its own instead of asking the golfer to reload.
 */
export function PendingRefresher() {
  const router = useRouter();
  const tries = useRef(0);

  useEffect(() => {
    const t = setInterval(() => {
      tries.current += 1;
      if (tries.current > 20) {
        clearInterval(t);
        return;
      }
      router.refresh();
    }, 3000);
    return () => clearInterval(t);
  }, [router]);

  return null;
}
