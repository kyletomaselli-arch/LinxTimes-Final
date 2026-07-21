"use client";

import { useEffect, useState } from "react";

export function SaveToast() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handleSubmit = (e: Event) => {
      if (e.target instanceof HTMLFormElement) {
        setShow(true);
        setTimeout(() => setShow(false), 2000);
      }
    };

    document.addEventListener("submit", handleSubmit, true);
    return () => document.removeEventListener("submit", handleSubmit, true);
  }, []);

  if (!show) return null;
  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-green-100 px-4 py-2 text-sm font-medium text-green-800 shadow-lg animate-fade-up">
      <span>✓</span> Saved
    </div>
  );
}
