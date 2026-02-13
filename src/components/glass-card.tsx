import { cn } from "@/lib/utils";

export function GlassCard({
  className,
  children
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <section className={cn("glass rounded-3xl p-4 shadow-glass", className)}>{children}</section>;
}
