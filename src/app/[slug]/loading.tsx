import { AuroraBackground } from "@/components/AuroraBackground";

export default function Loading() {
  return (
    <main className="relative min-h-screen">
      <AuroraBackground />
      <div className="relative z-10 mx-auto max-w-5xl px-5 pt-16 pb-24 sm:pt-20">
        <div className="skeleton h-7 w-40 rounded-full" />
        <div className="mt-5 flex items-center gap-4">
          <div className="skeleton h-16 w-16 rounded-2xl" />
          <div className="skeleton h-10 w-72 rounded-xl" />
        </div>
        <div className="skeleton mt-4 h-6 w-96 max-w-full rounded-lg" />

        <div className="mt-10 rounded-[26px] p-6 lx-glass sm:p-8">
          <div className="skeleton h-6 w-48 rounded-lg" />
          <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton h-[68px] rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
