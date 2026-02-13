import { GlassCard } from "@/components/glass-card";
import { cn } from "@/lib/utils";

export function MetricCard({
  title,
  value,
  tone = "neutral"
}: {
  title: string;
  value: number;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  return (
    <GlassCard className="p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-muted">{title}</p>
      <p
        className={cn(
          "mt-2 text-3xl font-semibold",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning",
          tone === "danger" && "text-danger"
        )}
      >
        {value}
      </p>
    </GlassCard>
  );
}
