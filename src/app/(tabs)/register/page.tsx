"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CircleAlert, Loader2 } from "lucide-react";
import { GlassCard } from "@/components/glass-card";
import { formatDate } from "@/lib/utils";
import { localService } from "@/lib/local/service";

type Truck = {
  id: string;
  truckNumber: string;
  currentOdometer: number;
  currentWorkedHours: number;
};

type MovementType = "ENTRY" | "EXIT";
type SubmitResponse = ReturnType<typeof localService.registerYardEntry>;
type OpenYardEntry = ReturnType<typeof localService.getOpenYardEntry>;

function currentClock() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export default function RegisterPage() {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [truckId, setTruckId] = useState("");
  const [movementType, setMovementType] = useState<MovementType>("ENTRY");
  const [time, setTime] = useState(currentClock());
  const [odometer, setOdometer] = useState("");
  const [notes, setNotes] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [openYardEntry, setOpenYardEntry] = useState<OpenYardEntry>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [saving, setSaving] = useState(false);

  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("es-AR", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      }).format(new Date()),
    []
  );

  const loadTrucks = () => {
    localService.initialize();
    const list = localService.getTrucks().map((truck) => ({
      id: truck.id,
      truckNumber: truck.truckNumber,
      currentOdometer: truck.currentOdometer,
      currentWorkedHours: truck.currentWorkedHours
    }));

    setTrucks(list);
    if (list.length > 0 && !truckId) {
      setTruckId(list[0].id);
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
    if (!truckId) return;
    setOpenYardEntry(localService.getOpenYardEntry(truckId));
    if (movementType === "ENTRY") {
      const currentTruck = trucks.find((truck) => truck.id === truckId);
      if (currentTruck) {
        setOdometer(String(currentTruck.currentOdometer));
      }
    }
  }, [truckId, trucks, movementType]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    setResult(null);

    try {
      const output = localService.registerYardEntry({
        truckId,
        movementType,
        time,
        odometer: movementType === "ENTRY" ? Number(odometer) : undefined,
        notes: notes || undefined,
        photoUrl: photoUrl || undefined
      });

      setResult(output);
      setMessage(
        output.eventType === "ENTRY"
          ? "Entrada registrada. Ahora debe registrar la salida para cerrar horas."
          : "Salida registrada correctamente."
      );

      if (output.eventType === "ENTRY") {
        setMovementType("EXIT");
      } else {
        setMovementType("ENTRY");
      }

      setTime(currentClock());
      setNotes("");
      setPhotoUrl("");
      loadTrucks();
      setOpenYardEntry(localService.getOpenYardEntry(truckId));
    } catch (submitError) {
      setError(String(submitError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <GlassCard>
        <h2 className="text-lg font-semibold">Registrar movimiento de yarda</h2>
        <p className="mt-1 text-sm text-muted">
          Seleccione Entrada o Salida, cargue la hora, y la fecha se toma automaticamente de hoy.
        </p>

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
                {truck.truckNumber} (odom: {truck.currentOdometer} mi, horas: {truck.currentWorkedHours})
              </option>
            ))}
          </select>

          <label className="block text-sm text-muted">Tipo de registro</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`tap-target rounded-2xl px-4 py-3 text-sm font-medium transition ${
                movementType === "ENTRY"
                  ? "bg-primary text-white"
                  : "bg-white/55 text-muted dark:bg-slate-900/35"
              }`}
              onClick={() => setMovementType("ENTRY")}
            >
              Entrada
            </button>
            <button
              type="button"
              className={`tap-target rounded-2xl px-4 py-3 text-sm font-medium transition ${
                movementType === "EXIT"
                  ? "bg-primary text-white"
                  : "bg-white/55 text-muted dark:bg-slate-900/35"
              }`}
              onClick={() => setMovementType("EXIT")}
            >
              Salida
            </button>
          </div>

          <div>
            <label className="mb-1 block text-sm text-muted">Hora</label>
            <input
              type="time"
              step={60}
              className="tap-target w-full rounded-2xl border border-white/40 bg-white/50 px-3 py-3 text-base outline-none dark:border-white/10 dark:bg-slate-900/40"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              required
            />
            <p className="mt-1 text-xs text-muted">Fecha aplicada: {todayLabel}</p>
          </div>

          {movementType === "ENTRY" ? (
            <div>
              <label className="mb-1 block text-sm text-muted">Odometro (mi)</label>
              <input
                type="number"
                className="tap-target w-full rounded-2xl border border-white/40 bg-white/50 px-3 py-3 text-base outline-none dark:border-white/10 dark:bg-slate-900/40"
                inputMode="numeric"
                placeholder={selectedTruck ? `Minimo ${selectedTruck.currentOdometer}` : "Ej: 120350"}
                value={odometer}
                onChange={(event) => setOdometer(event.target.value)}
                required
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-white/40 bg-white/45 p-3 text-sm dark:border-white/10 dark:bg-slate-900/30">
              {openYardEntry ? (
                <>
                  <p className="font-medium">Entrada abierta detectada</p>
                  <p className="text-muted">Hora entrada: {formatDate(openYardEntry.yardEntryAt)}</p>
                  <p className="text-muted">Odometro entrada: {openYardEntry.odometer} mi</p>
                </>
              ) : (
                <p className="text-muted">No hay entrada abierta para este camion.</p>
              )}
            </div>
          )}

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
            {saving ? (
              <Loader2 className="animate-spin" size={18} />
            ) : movementType === "ENTRY" ? (
              "Guardar entrada"
            ) : (
              "Guardar salida"
            )}
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
          {result?.eventType === "EXIT" ? (
            <p className="mt-1 text-sm text-muted">
              Delta millas: {result.yardEntry.computedDeltaMiles} mi · Horas trabajadas: {result.yardEntry.workedHours} h
            </p>
          ) : null}
          {result?.eventType === "EXIT" ? (
            <div className="mt-2 space-y-2">
              {(result.generatedWorkOrders ?? []).map((wo, index) => (
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
          ) : null}
        </GlassCard>
      ) : null}
    </div>
  );
}
