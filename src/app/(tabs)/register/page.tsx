"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, ChevronDown, CircleAlert, Loader2, Search } from "lucide-react";
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

type Meridiem = "AM" | "PM";

function currentClock24() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function from24To12(value: string) {
  const [rawHour = "00", minute = "00"] = value.split(":");
  const parsedHour = Number(rawHour);
  const meridiem: Meridiem = parsedHour >= 12 ? "PM" : "AM";
  const hour12 = ((parsedHour + 11) % 12) + 1;
  return {
    hour: String(hour12).padStart(2, "0"),
    minute: minute.padStart(2, "0"),
    meridiem
  };
}

function to24Hour(hour: string, minute: string, meridiem: Meridiem) {
  if (!/^\d{1,2}$/.test(hour) || !/^\d{1,2}$/.test(minute)) return null;
  const hourNum = Number(hour);
  const minuteNum = Number(minute);
  if (hourNum < 1 || hourNum > 12) return null;
  if (minuteNum < 0 || minuteNum > 59) return null;

  let hour24 = hourNum % 12;
  if (meridiem === "PM") hour24 += 12;
  return `${String(hour24).padStart(2, "0")}:${String(minuteNum).padStart(2, "0")}`;
}

function normalizeHour(hour: string) {
  const clean = hour.replace(/\D/g, "").slice(0, 2);
  if (!clean) return "01";
  const value = Math.min(12, Math.max(1, Number(clean)));
  return String(value).padStart(2, "0");
}

function normalizeMinute(minute: string) {
  const clean = minute.replace(/\D/g, "").slice(0, 2);
  if (!clean) return "00";
  const value = Math.min(59, Math.max(0, Number(clean)));
  return String(value).padStart(2, "0");
}

function selectAllText(event: React.FocusEvent<HTMLInputElement>) {
  requestAnimationFrame(() => {
    event.currentTarget.select();
  });
}

export default function RegisterPage() {
  const initialTime = useMemo(() => from24To12(currentClock24()), []);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [truckId, setTruckId] = useState("");
  const [truckSearch, setTruckSearch] = useState("");
  const [isTruckPickerOpen, setIsTruckPickerOpen] = useState(false);
  const [movementType, setMovementType] = useState<MovementType>("ENTRY");
  const [hour, setHour] = useState(initialTime.hour);
  const [minute, setMinute] = useState(initialTime.minute);
  const [meridiem, setMeridiem] = useState<Meridiem>(initialTime.meridiem);
  const [odometer, setOdometer] = useState("");
  const [notes, setNotes] = useState("");
  const [openYardEntry, setOpenYardEntry] = useState<OpenYardEntry>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const minuteRef = useRef<HTMLInputElement>(null);
  const truckPickerRef = useRef<HTMLDivElement>(null);
  const truckSearchRef = useRef<HTMLInputElement>(null);

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
  const hasOpenEntry = !!openYardEntry;

  const filteredTrucks = useMemo(() => {
    const query = truckSearch.trim().toLowerCase();
    if (!query) return trucks;

    return trucks
      .map((truck) => {
        const byNumber = truck.truckNumber.toLowerCase();
        const byOdometer = String(truck.currentOdometer);
        if (byNumber.startsWith(query)) return { truck, score: 0 };
        if (byNumber.includes(query)) return { truck, score: 1 };
        if (byOdometer.includes(query)) return { truck, score: 2 };
        return { truck, score: 99 };
      })
      .filter((item) => item.score < 99)
      .sort((a, b) => a.score - b.score || a.truck.truckNumber.localeCompare(b.truck.truckNumber))
      .map((item) => item.truck);
  }, [truckSearch, trucks]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!truckPickerRef.current) return;
      if (!truckPickerRef.current.contains(event.target as Node)) {
        setIsTruckPickerOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  useEffect(() => {
    if (!isTruckPickerOpen) return;
    const timer = window.setTimeout(() => {
      truckSearchRef.current?.focus();
      truckSearchRef.current?.select();
    }, 20);
    return () => window.clearTimeout(timer);
  }, [isTruckPickerOpen]);

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

  useEffect(() => {
    if (hasOpenEntry && movementType !== "EXIT") {
      setMovementType("EXIT");
      return;
    }
    if (!hasOpenEntry && movementType !== "ENTRY") {
      setMovementType("ENTRY");
    }
  }, [hasOpenEntry, movementType]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    setResult(null);

    try {
      const time24 = to24Hour(hour, minute, meridiem);
      if (!time24) throw new Error("Hora inválida. Use formato de 12 horas válido.");

      const output = localService.registerYardEntry({
        truckId,
        movementType,
        time: time24,
        odometer: movementType === "ENTRY" ? Number(odometer) : undefined,
        notes: notes || undefined
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

      const freshTime = from24To12(currentClock24());
      setHour(freshTime.hour);
      setMinute(freshTime.minute);
      setMeridiem(freshTime.meridiem);
      setNotes("");
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

        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <label className="block text-sm text-muted">Camion</label>
          <div ref={truckPickerRef} className="relative">
            <button
              type="button"
              className="tap-target flex w-full items-center justify-between rounded-2xl border border-white/40 bg-white/50 px-3 py-3 text-left text-base outline-none transition dark:border-white/10 dark:bg-slate-900/40"
              onClick={() => {
                setIsTruckPickerOpen((prev) => !prev);
                if (!isTruckPickerOpen) {
                  setTruckSearch(selectedTruck?.truckNumber ?? "");
                }
              }}
              aria-expanded={isTruckPickerOpen}
              aria-haspopup="listbox"
            >
              <span className="truncate">
                {selectedTruck
                  ? `${selectedTruck.truckNumber} (odom: ${selectedTruck.currentOdometer} mi, horas: ${selectedTruck.currentWorkedHours})`
                  : "Seleccionar camion"}
              </span>
              <ChevronDown
                size={18}
                className={`text-muted transition-transform ${isTruckPickerOpen ? "rotate-180" : ""}`}
              />
            </button>
            {isTruckPickerOpen ? (
              <>
                <button
                  type="button"
                  aria-label="Cerrar selector"
                  onClick={() => setIsTruckPickerOpen(false)}
                  className="fixed inset-0 z-30 bg-transparent"
                />
                <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                <div className="relative mb-2">
                  <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                    <Search size={15} />
                  </div>
                  <input
                    ref={truckSearchRef}
                    type="text"
                    className="tap-target w-full rounded-xl border border-white/40 bg-white/60 px-9 py-2 text-sm outline-none dark:border-white/10 dark:bg-slate-900/40"
                    value={truckSearch}
                    onChange={(event) => setTruckSearch(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        const first = filteredTrucks[0];
                        if (first) {
                          setTruckId(first.id);
                          setTruckSearch(first.truckNumber);
                          setIsTruckPickerOpen(false);
                        }
                      }
                      if (event.key === "Escape") {
                        setIsTruckPickerOpen(false);
                      }
                    }}
                    placeholder="Buscar por camion u odometro"
                  />
                </div>
                {filteredTrucks.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-muted">No se encontraron camiones.</p>
                ) : (
                  filteredTrucks.map((truck) => (
                    <button
                      key={truck.id}
                      type="button"
                      onClick={() => {
                        setTruckId(truck.id);
                        setTruckSearch(truck.truckNumber);
                        setIsTruckPickerOpen(false);
                      }}
                      className={`tap-target flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition ${
                        truck.id === truckId
                          ? "bg-primary/10 text-primary"
                          : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                      }`}
                    >
                      <span className="text-sm">
                        {truck.truckNumber} (odom: {truck.currentOdometer} mi, horas: {truck.currentWorkedHours})
                      </span>
                      {truck.id === truckId ? <Check size={14} /> : null}
                    </button>
                  ))
                )}
              </div>
              </>
            ) : null}
          </div>
          <label className="block text-sm text-muted">Tipo de registro</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={hasOpenEntry}
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
              disabled={!hasOpenEntry}
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
          <p className="text-xs text-muted">
            {hasOpenEntry
              ? "Hay una entrada abierta: debe registrar salida antes de una nueva entrada."
              : "No hay entrada abierta: primero registre una entrada."}
          </p>

          <div>
            <label className="mb-1 block text-sm text-muted">Hora</label>
            <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={2}
                className="tap-target w-full rounded-2xl border border-white/40 bg-white/50 px-3 py-3 text-center text-base outline-none dark:border-white/10 dark:bg-slate-900/40"
                value={hour}
                onFocus={selectAllText}
                onChange={(event) => {
                  const clean = event.target.value.replace(/\D/g, "").slice(0, 2);
                  setHour(clean);
                  if (clean.length === 2) {
                    minuteRef.current?.focus();
                    minuteRef.current?.select();
                  }
                }}
                onBlur={() => setHour((prev) => normalizeHour(prev))}
                aria-label="Hora"
                required
              />
              <span className="text-xl font-semibold text-muted">:</span>
              <input
                ref={minuteRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={2}
                className="tap-target w-full rounded-2xl border border-white/40 bg-white/50 px-3 py-3 text-center text-base outline-none dark:border-white/10 dark:bg-slate-900/40"
                value={minute}
                onFocus={selectAllText}
                onChange={(event) => {
                  const clean = event.target.value.replace(/\D/g, "").slice(0, 2);
                  setMinute(clean);
                }}
                onBlur={() => setMinute((prev) => normalizeMinute(prev))}
                aria-label="Minutos"
                required
              />
              <div className="grid grid-cols-2 rounded-2xl bg-white/55 p-1 dark:bg-slate-900/35">
                <button
                  type="button"
                  className={`tap-target rounded-xl px-3 py-2 text-xs font-semibold ${
                    meridiem === "AM" ? "bg-primary text-white" : "text-muted"
                  }`}
                  onClick={() => setMeridiem("AM")}
                >
                  AM
                </button>
                <button
                  type="button"
                  className={`tap-target rounded-xl px-3 py-2 text-xs font-semibold ${
                    meridiem === "PM" ? "bg-primary text-white" : "text-muted"
                  }`}
                  onClick={() => setMeridiem("PM")}
                >
                  PM
                </button>
              </div>
            </div>
            <p className="mt-1 text-xs text-muted">
              Hora aplicada: {normalizeHour(hour)}:{normalizeMinute(minute)} {meridiem}
            </p>
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
