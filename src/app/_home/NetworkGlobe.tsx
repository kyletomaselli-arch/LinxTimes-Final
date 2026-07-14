"use client";

import dynamic from "next/dynamic";
import type { CoursePin } from "./GlobeInner";

const GlobeInner = dynamic(() => import("./GlobeInner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] w-full items-center justify-center">
      <div className="h-64 w-64 animate-pulse rounded-full bg-linx-green/5 ring-1 ring-linx-green/10" />
    </div>
  ),
});

export function NetworkGlobe({ courses }: { courses: CoursePin[] }) {
  return <GlobeInner courses={courses} />;
}
