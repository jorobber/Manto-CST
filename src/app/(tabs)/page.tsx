"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MetricCard } from "@/components/metric-card";
import { GlassCard } from "@/components/glass-card";
import { formatDate } from "@/lib/utils";
import { localService } from "@/lib/local/service";

type DashboardResponse = ReturnType<typeof localService.getDashboardSummary>;

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = () => {
      setLoading(true);
      try {
        localService.initialize();
        setData(localService.getDashboardSummary());
        setError(null);
      } catch (loadError) {
        setError(String(loadError));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-3">
        {loading ? (
          <>
            <div className="skeleton h-24 rounded-3xl" />
            <div className="skeleton h-24 rounded-3xl" />
            <div className="skeleton h-24 rounded-3xl" />
            <div className="skeleton h-24 rounded-3xl" />
          </>
        ) : (
          <>
            <MetricCard title="Due Now" value={data?.totals.dueNow ?? 0} tone="warning" />
            <MetricCard title="Due Soon" value={data?.totals.dueSoon ?? 0} tone="success" />
            <MetricCard title="Overdue" value={data?.totals.overdue ?? 0} tone="danger" />
            <MetricCard title="Ordenes" value={data?.totals.pendingOrders ?? 0} />
          </>
        )}
      </section>

      {error ? (
        <GlassCard>
          <p className="text-sm text-danger">{error}</p>
        </GlassCard>
      ) : null}

      <GlassCard>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Ordenes pendientes</h2>
          <span className="text-xs text-muted">Datos locales</span>
        </div>

        <div className="mt-3 space-y-2">
          {(data?.pendingOrders ?? []).slice(0, 8).map((order, index) => (
            <motion.article
              key={order.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03, duration: 0.22 }}
              className="rounded-2xl border border-white/45 bg-white/45 px-3 py-2 dark:border-white/10 dark:bg-slate-900/35"
            >
              <p className="text-sm font-medium">
                {order.workorderNumber} · {order.truckNumber}
              </p>
              <p className="text-sm text-muted">
                {order.maintenanceName} · Due @{order.dueAtWorkedHours} h
              </p>
              <p className="text-xs text-muted">Creada: {formatDate(order.createdAt)}</p>
            </motion.article>
          ))}

          {!loading && (data?.pendingOrders.length ?? 0) === 0 ? (
            <p className="rounded-2xl bg-white/35 p-3 text-sm text-muted dark:bg-slate-900/30">
              Sin ordenes pendientes por ahora.
            </p>
          ) : null}
        </div>
      </GlassCard>
    </div>
  );
}
