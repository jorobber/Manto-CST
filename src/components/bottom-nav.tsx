"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ClipboardPlus, FileText, Home, Truck, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/register", label: "Registrar", icon: ClipboardPlus },
  { href: "/trucks", label: "Camiones", icon: Truck },
  { href: "/orders", label: "Ordenes", icon: Wrench },
  { href: "/documents", label: "Docs", icon: FileText },
  { href: "/reports", label: "Reportes", icon: BarChart3 }
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-3 z-50 mx-auto w-[min(100%,520px)] px-4">
      <div className="glass flex items-center justify-between rounded-3xl border px-2 py-2 shadow-glass">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "tap-target flex min-w-[62px] flex-1 flex-col items-center justify-center rounded-2xl text-[11px] font-medium transition-all duration-200 ease-ios",
                isActive
                  ? "bg-primary/15 text-primary"
                  : "text-muted hover:bg-white/30 dark:hover:bg-white/5"
              )}
            >
              <Icon size={18} />
              <span className="mt-1">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
