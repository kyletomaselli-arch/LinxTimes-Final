import { requireSuperAdmin } from "@/lib/super-session";
import { SuperDarkSidebar } from "../_components/SuperDarkSidebar";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireSuperAdmin();
  return (
    <div className="flex min-h-screen bg-[#f6f7f9]">
      <SuperDarkSidebar adminName={admin.name} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-4 border-b border-black/[0.06] bg-white px-7 py-3.5">
          <div className="w-full max-w-sm rounded-[10px] bg-[#f2f4f7] px-4 py-2 text-sm text-foreground/40">Search courses…</div>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-foreground/45">{admin.name}</span>
            <div className="h-8 w-8 rounded-full bg-[#dfe3e8]" />
          </div>
        </div>
        <main className="min-w-0 flex-1 p-7">{children}</main>
      </div>
    </div>
  );
}
