import { ActorSwitch } from "@/components/actor-switch";
import { BottomNav } from "@/components/bottom-nav";
import { ResetDataButton } from "@/components/reset-data-button";
import { ThemeToggle } from "@/components/theme-toggle";

export default function TabsLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto min-h-screen w-full max-w-[540px] px-4 pb-28 pt-4">
      <header className="mb-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted">CST Manto</p>
            <h1 className="text-2xl font-semibold">Control de mantenimiento</h1>
          </div>
          <ThemeToggle />
        </div>

        <div className="flex items-center justify-between gap-2">
          <ActorSwitch />
          <ResetDataButton />
        </div>
      </header>

      <main>{children}</main>
      <BottomNav />
    </div>
  );
}
