"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { GlassCard } from "@/components/glass-card";
import { formatDate } from "@/lib/utils";
import { localService } from "@/lib/local/service";

type TruckDetail = ReturnType<typeof localService.getTruckById>;

export default function TruckDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<TruckDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reasonByEntry, setReasonByEntry] = useState<Record<string, string>>({});
  const [valueByEntry, setValueByEntry] = useState<Record<string, string>>({});
  const [adjustOdometer, setAdjustOdometer] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      localService.initialize();
      const detail = localService.getTruckById(params.id);
      setData(detail);
      setAdjustOdometer(String(detail.currentOdometer));
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
  }, [params.id]);

  const correct = async (entryId: string) => {
    try {
      const odometer = Number(valueByEntry[entryId]);
      const reason = reasonByEntry[entryId];

      localService.correctYardEntry({ entryId, odometer, reason });
      await load();
    } catch (correctionError) {
      setError(String(correctionError));
    }
  };

  const adjustTruckOdometer = async () => {
    if (!data) return;
    try {
      localService.updateTruckCurrentOdometer({
        truckId: data.id,
        odometer: Number(adjustOdometer),
        reason: adjustReason
      });
      setAdjustReason("");
      await load();
    } catch (adjustError) {
      setError(String(adjustError));
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="skeleton h-24 rounded-3xl" />
        <div className="skeleton h-40 rounded-3xl" />
      </div>
    );
  }

  if (error || !data) {
    return <GlassCard className="text-sm text-danger">{error ?? "Camion no encontrado"}</GlassCard>;
  }

  return (
    <div className="space-y-4">
      <GlassCard>
        <h2 className="text-xl font-semibold">{data.truckNumber}</h2>
        <p className="text-sm text-muted">
          {data.brand} {data.model} {data.year}
        </p>
        <p className="mt-2 text-sm">Odometro actual: {data.currentOdometer} mi</p>
        <p className="text-sm">Horas acumuladas: {data.currentWorkedHours} h</p>
      </GlassCard>

      {data.canAdminManage ? (
        <GlassCard>
          <h3 className="text-lg font-semibold">Admin: ajustar odómetro actual</h3>
          <p className="text-xs text-muted">Este ajuste impacta mantenimientos y recalcula deltas.</p>
          <div className="mt-3 space-y-2">
            <input
              type="number"
              value={adjustOdometer}
              onChange={(event) => setAdjustOdometer(event.target.value)}
              className="tap-target w-full rounded-xl border border-white/40 bg-white/60 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950/30"
              placeholder="Nuevo odómetro"
            />
            <input
              type="text"
              value={adjustReason}
              onChange={(event) => setAdjustReason(event.target.value)}
              className="tap-target w-full rounded-xl border border-white/40 bg-white/60 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950/30"
              placeholder="Motivo obligatorio"
            />
            <button
              type="button"
              onClick={adjustTruckOdometer}
              className="tap-target w-full rounded-xl bg-slate-900 px-3 py-2 text-sm text-white dark:bg-primary"
            >
              Guardar ajuste de odómetro
            </button>
          </div>
        </GlassCard>
      ) : null}

      <GlassCard>
        <h3 className="text-lg font-semibold">Estado de mantenimientos (por horas)</h3>
        <div className="mt-2 space-y-2">
          {data.maintenanceStates.map((state) => {
            const hoursSince = data.currentWorkedHours - state.lastServiceWorkedHours;
            const remaining = state.maintenanceType.intervalHours - hoursSince;

            return (
              <div key={state.id} className="rounded-2xl bg-white/45 p-3 dark:bg-slate-900/35">
                <p className="text-sm font-medium">{state.maintenanceType.name}</p>
                <p className="text-xs text-muted">Intervalo: {state.maintenanceType.intervalHours} h</p>
                <p className="text-xs text-muted">
                  {remaining <= 0 ? `OVERDUE ${Math.abs(remaining)} h` : `Faltan ${roundToOne(remaining)} h`}
                </p>
              </div>
            );
          })}
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="text-lg font-semibold">Entradas de yarda</h3>
        <p className="text-xs text-muted">Correccion de odometro solo para Admin (motivo obligatorio).</p>

        <div className="mt-3 space-y-3">
          {data.yardEntries.map((entry) => (
            <article key={entry.id} className="rounded-2xl bg-white/45 p-3 dark:bg-slate-900/35">
              <p className="text-sm font-medium">Salida: {formatDate(entry.yardExitAt)}</p>
              <p className="text-xs text-muted">Entrada: {formatDate(entry.yardEntryAt)}</p>
              <p className="text-sm text-muted">
                Odom: {entry.odometer} · Delta: {entry.computedDeltaMiles} mi · Horas: {entry.workedHours} h
              </p>
              <p className="text-xs text-muted">{entry.recordedBy?.name ?? "N/A"}</p>

              {data.canAdminManage ? (
                <div className="mt-2 space-y-2">
                  <input
                    type="number"
                    placeholder="Nuevo odometro"
                    className="tap-target w-full rounded-xl border border-white/40 bg-white/60 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950/30"
                    value={valueByEntry[entry.id] ?? ""}
                    onChange={(event) =>
                      setValueByEntry((prev) => ({
                        ...prev,
                        [entry.id]: event.target.value
                      }))
                    }
                  />
                  <input
                    type="text"
                    placeholder="Motivo de correccion"
                    className="tap-target w-full rounded-xl border border-white/40 bg-white/60 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950/30"
                    value={reasonByEntry[entry.id] ?? ""}
                    onChange={(event) =>
                      setReasonByEntry((prev) => ({
                        ...prev,
                        [entry.id]: event.target.value
                      }))
                    }
                  />
                  <button
                    type="button"
                    onClick={() => correct(entry.id)}
                    className="tap-target w-full rounded-xl bg-slate-900 px-3 py-2 text-sm text-white dark:bg-primary"
                  >
                    Corregir lectura
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

function roundToOne(value: number) {
  return Math.round(value * 10) / 10;
}
