"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CircleAlert, Loader2 } from "lucide-react";
import { GlassCard } from "@/components/glass-card";
import { localService } from "@/lib/local/service";

type Truck = {
  id: string;
  truckNumber: string;
  currentOdometer: number;
};

type SubmitResponse = ReturnType<typeof localService.registerYardEntry>;

export default function RegisterPage() {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [truckId, setTruckId] = useState("");
  const [odometer, setOdometer] = useState("");
  const [notes, setNotes] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [saving, setSaving] = useState(false);

  const loadTrucks = () => {
    localService.initialize();
    const list = localService.getTrucks().map((truck) => ({
      id: truck.id,
      truckNumber: truck.truckNumber,
      currentOdometer: truck.currentOdometer
    }));

    setTrucks(list);
    if (list.length > 0 && !truckId) {
      setTruckId(list[0].id);
      setOdometer(String(list[0].currentOdometer));
    }
  };

  useEffect(() => {
    loadTrucks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedTruck = useMemo(
    () => trucks.find((truck) => truck.id === truckId),
    [trucks, truckId]
  );

  useEffect(() => {
    const currentTruck = trucks.find((truck) => truck.id === truckId);
    if (currentTruck) {
      setOdometer(String(currentTruck.currentOdometer));
    }
  }, [truckId, trucks]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    setResult(null);

    try {
      const output = localService.registerYardEntry({
        truckId,
        odometer: Number(odometer),
        notes: notes || undefined,
        photoUrl: photoUrl || undefined
      });

      setResult(output);
      setMessage("Entrada registrada correctamente.");
      setNotes("");
      setPhotoUrl("");
      loadTrucks();
    } catch (submitError) {
      setError(String(submitError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <GlassCard>
        <h2 className="text-lg font-semibold">Registrar entrada a yarda</h2>
        <p className="mt-1 text-sm text-muted">Objetivo UX: completar en menos de 10 segundos.</p>

        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <label className="block text-sm text-muted">Camion</label>
          <select
            className="tap-target w-full rounded-2xl border border-white/40 bg-white/50 px-3 py-3 text-base outline-none dark:border-white/10 dark:bg-slate-900/40"
            value={truckId}
            onChange={(event) => setTruckId(event.target.value)}
            required
          >
            {trucks.map((truck) => (
              <option key={truck.id} value={truck.id}>
                {truck.truckNumber} (actual: {truck.currentOdometer} mi)
              </option>
            ))}
          </select>

          <label className="block text-sm text-muted">Odometro (mi)</label>
          <input
            type="number"
            className="tap-target w-full rounded-2xl border border-white/40 bg-white/50 px-3 py-3 text-base outline-none dark:border-white/10 dark:bg-slate-900/40"
            inputMode="numeric"
            placeholder={selectedTruck ? `Minimo ${selectedTruck.currentOdometer}` : "Ej: 120350"}
            value={odometer}
            onChange={(event) => setOdometer(event.target.value)}
            required
          />

          <label className="block text-sm text-muted">Notas (opcional)</label>
          <input
            type="text"
            className="tap-target w-full rounded-2xl border border-white/40 bg-white/50 px-3 py-3 text-base outline-none dark:border-white/10 dark:bg-slate-900/40"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Observacion breve"
          />

          <label className="block text-sm text-muted">URL foto odometro (opcional)</label>
          <input
            type="url"
            className="tap-target w-full rounded-2xl border border-white/40 bg-white/50 px-3 py-3 text-base outline-none dark:border-white/10 dark:bg-slate-900/40"
            value={photoUrl}
            onChange={(event) => setPhotoUrl(event.target.value)}
            placeholder="https://..."
          />

          <button
            type="submit"
            disabled={saving}
            className="tap-target flex w-full items-center justify-center rounded-2xl bg-primary px-4 py-3 text-base font-semibold text-white transition-all duration-200 ease-ios active:scale-[0.99] disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : "Guardar entrada"}
          </button>
        </form>
      </GlassCard>

      {error ? (
        <GlassCard className="border border-danger/30">
          <p className="flex items-center gap-2 text-sm text-danger">
            <CircleAlert size={16} />
            {error}
          </p>
        </GlassCard>
      ) : null}

      {message ? (
        <GlassCard>
          <p className="text-sm text-success">{message}</p>
          <p className="mt-1 text-sm text-muted">Delta calculado: {result?.yardEntry.computedDelta ?? 0} mi</p>
          <div className="mt-2 space-y-2">
            {(result?.generatedWorkOrders ?? []).map((wo, index) => (
              <motion.div
                key={`${wo.maintenanceName}-${index}`}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05, duration: 0.2 }}
                className="rounded-2xl bg-white/50 px-3 py-2 text-sm dark:bg-slate-900/35"
              >
                {wo.maintenanceName} · {wo.health} · {wo.workOrderNumber ?? "sin numero"}
              </motion.div>
            ))}
          </div>
        </GlassCard>
      ) : null}
    </div>
  );
}
