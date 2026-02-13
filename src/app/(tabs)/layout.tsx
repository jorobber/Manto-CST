"use client";

import { useEffect, useState } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { localService } from "@/lib/local/service";

type SessionUser = ReturnType<typeof localService.getSessionUser>;

export default function TabsLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    localService.initialize();
    setUser(localService.getSessionUser());
  }, []);

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

        <div className="glass rounded-2xl border px-3 py-2 text-xs text-muted">
          Modo local sin login
          {user ? ` · Usuario activo: ${user.name} (${user.role})` : ""}
        </div>
      </header>

      <main>{children}</main>
      <BottomNav />
    </div>
  );
}
