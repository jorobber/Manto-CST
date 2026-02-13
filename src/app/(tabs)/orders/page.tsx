"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard } from "@/components/glass-card";
import { formatDate } from "@/lib/utils";
import { localService } from "@/lib/local/service";

type WorkOrder = ReturnType<typeof localService.getWorkOrders>[number];

function tone(state: WorkOrder["visualState"]) {
  if (state === "OVERDUE") return "text-danger";
  if (state === "DUE") return "text-warning";
  return "text-muted";
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [status, setStatus] = useState<"ALL" | "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED">(
    "ALL"
  );
  const [selected, setSelected] = useState<WorkOrder | null>(null);
  const [odometerAtService, setOdometerAtService] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      localService.initialize();
      setOrders(localService.getWorkOrders({ status }));
      setError(null);
    } catch (loadError) {
      setError(String(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const openOrders = useMemo(
    () =>
      orders.filter((order) => order.status === "PENDING" || order.status === "IN_PROGRESS"),
    [orders]
  );

  const startOrder = async (id: string) => {
    try {
      localService.startWorkOrder(id);
      await load();
    } catch (startError) {
      setError(String(startError));
    }
  };

  const completeOrder = async () => {
    if (!selected) return;

    try {
      localService.completeWorkOrder({
        workOrderId: selected.id,
        odometerAtService: Number(odometerAtService),
        notes: notes || undefined
      });

      setSelected(null);
      setOdometerAtService("");
      setNotes("");
      await load();
    } catch (completeError) {
      setError(String(completeError));
    }
  };

  return (
    <div className="space-y-4">
      <GlassCard>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {["ALL", "PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"].map((item) => (
            <button
              key={item}
              className={`tap-target rounded-full px-3 py-2 text-xs ${
                status === item ? "bg-primary text-white" : "bg-white/55 text-muted dark:bg-slate-900/35"
              }`}
              onClick={() => setStatus(item as typeof status)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
      </GlassCard>

      {error ? (
        <GlassCard>
          <p className="text-sm text-danger">{error}</p>
        </GlassCard>
      ) : null}

      <section className="space-y-3">
        {loading ? (
          <div className="skeleton h-32 rounded-3xl" />
        ) : (
          orders.map((order, index) => (
            <motion.article
              key={order.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03, duration: 0.22 }}
            >
              <GlassCard>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{order.workorderNumber}</p>
                    <p className="text-sm text-muted">
                      {order.truck.truckNumber} · {order.maintenanceType.name}
                    </p>
                    <p className="text-xs text-muted">Creada: {formatDate(order.createdAt)}</p>
                  </div>
                  <span className={`text-xs font-medium ${tone(order.visualState)}`}>
                    {order.visualState}
                    {order.overdueMiles > 0 ? ` +${order.overdueMiles} mi` : ""}
                  </span>
                </div>

                {(order.status === "PENDING" || order.status === "IN_PROGRESS") && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {order.status === "PENDING" ? (
                      <button
                        type="button"
                        className="tap-target rounded-xl bg-slate-900 px-3 py-2 text-sm text-white dark:bg-primary"
                        onClick={() => startOrder(order.id)}
                      >
                        Iniciar
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="tap-target rounded-xl bg-primary px-3 py-2 text-sm text-white"
                        onClick={() => {
                          setSelected(order);
                          setOdometerAtService(String(order.truck.currentOdometer));
                        }}
                      >
                        Completar
                      </button>
                    )}
                    <a
                      href={`/trucks/${order.truck.id}`}
                      className="tap-target rounded-xl bg-white/55 px-3 py-2 text-center text-sm text-muted dark:bg-slate-900/35"
                    >
                      Ver camion
                    </a>
                  </div>
                )}
              </GlassCard>
            </motion.article>
          ))
        )}
      </section>

      <AnimatePresence>
        {selected ? (
          <>
            <motion.button
              type="button"
              className="fixed inset-0 z-40 bg-black/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelected(null)}
            />
            <motion.div
              initial={{ y: 280 }}
              animate={{ y: 0 }}
              exit={{ y: 280 }}
              transition={{ duration: 0.26 }}
              className="glass fixed inset-x-0 bottom-0 z-50 mx-auto w-[min(100%,540px)] rounded-t-3xl border p-4"
            >
              <h3 className="text-lg font-semibold">Completar {selected.workorderNumber}</h3>
              <p className="text-sm text-muted">
                {selected.truck.truckNumber} · {selected.maintenanceType.name}
              </p>

              <div className="mt-3 space-y-2">
                <input
                  type="number"
                  className="tap-target w-full rounded-2xl border border-white/40 bg-white/50 px-3 py-3 text-base outline-none dark:border-white/10 dark:bg-slate-900/40"
                  value={odometerAtService}
                  onChange={(event) => setOdometerAtService(event.target.value)}
                />
                <input
                  type="text"
                  className="tap-target w-full rounded-2xl border border-white/40 bg-white/50 px-3 py-3 text-base outline-none dark:border-white/10 dark:bg-slate-900/40"
                  placeholder="Notas de cierre"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
                <button
                  type="button"
                  className="tap-target w-full rounded-2xl bg-primary px-4 py-3 text-base font-semibold text-white"
                  onClick={completeOrder}
                >
                  Confirmar completado
                </button>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      {!loading && openOrders.length === 0 ? (
        <GlassCard>
          <p className="text-sm text-muted">No hay ordenes abiertas.</p>
        </GlassCard>
      ) : null}
    </div>
  );
}
