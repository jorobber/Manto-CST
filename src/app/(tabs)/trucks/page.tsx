"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search } from "lucide-react";
import { GlassCard } from "@/components/glass-card";
import { localService } from "@/lib/local/service";

type TruckItem = ReturnType<typeof localService.getTrucks>[number];

function percent(value: number) {
  return Math.min(100, Math.max(0, value));
}

export default function TrucksPage() {
  const [trucks, setTrucks] = useState<TruckItem[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sessionRole, setSessionRole] = useState<string | null>(null);

  const [truckNumber, setTruckNumber] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));

  const load = () => {
    localService.initialize();
    const session = localService.getSessionUser();
    setSessionRole(session?.role ?? null);
    setTrucks(localService.getTrucks());
  };

  useEffect(() => {
    try {
      load();
    } catch (loadError) {
      setError(String(loadError));
    }
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return trucks;
    const lower = query.toLowerCase();
    return trucks.filter(
      (truck) =>
        truck.truckNumber.toLowerCase().includes(lower) ||
        truck.brand.toLowerCase().includes(lower) ||
        truck.model.toLowerCase().includes(lower)
    );
  }, [trucks, query]);

  const createTruck = () => {
    try {
      localService.createTruck({
        truckNumber,
        brand,
        model,
        year: Number(year)
      });

      setTruckNumber("");
      setBrand("");
      setModel("");
      setYear(String(new Date().getFullYear()));
      setError(null);
      load();
    } catch (createError) {
      setError(String(createError));
    }
  };

  return (
    <div className="space-y-4">
      {sessionRole === "ADMIN" ? (
        <GlassCard>
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-muted">Admin</h2>
          <p className="mt-1 text-base font-semibold">Crear nuevo camión</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="TRK-003"
              value={truckNumber}
              onChange={(event) => setTruckNumber(event.target.value)}
              className="tap-target rounded-xl border border-white/40 bg-white/50 px-3 py-2 text-sm outline-none dark:border-white/10 dark:bg-slate-900/40"
            />
            <input
              type="number"
              placeholder="2022"
              value={year}
              onChange={(event) => setYear(event.target.value)}
              className="tap-target rounded-xl border border-white/40 bg-white/50 px-3 py-2 text-sm outline-none dark:border-white/10 dark:bg-slate-900/40"
            />
            <input
              type="text"
              placeholder="Marca"
              value={brand}
              onChange={(event) => setBrand(event.target.value)}
              className="tap-target rounded-xl border border-white/40 bg-white/50 px-3 py-2 text-sm outline-none dark:border-white/10 dark:bg-slate-900/40"
            />
            <input
              type="text"
              placeholder="Modelo"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              className="tap-target rounded-xl border border-white/40 bg-white/50 px-3 py-2 text-sm outline-none dark:border-white/10 dark:bg-slate-900/40"
            />
          </div>

          <button
            type="button"
            onClick={createTruck}
            className="tap-target mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white dark:bg-primary"
          >
            <Plus size={16} /> Crear camión
          </button>
        </GlassCard>
      ) : null}

      <GlassCard>
        <label className="flex items-center gap-2 rounded-2xl border border-white/50 bg-white/50 px-3 py-2 dark:border-white/10 dark:bg-slate-900/35">
          <Search size={16} className="text-muted" />
          <input
            type="text"
            className="w-full bg-transparent text-sm outline-none"
            placeholder="Buscar camion (spotlight)"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </GlassCard>

      {error ? (
        <GlassCard>
          <p className="text-sm text-danger">{error}</p>
        </GlassCard>
      ) : null}

      <section className="space-y-3">
        {filtered.map((truck, index) => {
          const nearest = truck.maintenanceStates
            .map((state) => {
              const hoursSince = truck.currentWorkedHours - state.lastServiceWorkedHours;
              const completion = percent((hoursSince / state.maintenanceType.intervalHours) * 100);
              const remainingHours = state.maintenanceType.intervalHours - hoursSince;

              return {
                maintenanceName: state.maintenanceType.name,
                completion,
                remainingHours
              };
            })
            .sort((a, b) => a.remainingHours - b.remainingHours)[0];

          return (
            <motion.article
              key={truck.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04, duration: 0.25 }}
            >
              <Link href={`/trucks/${truck.id}`}>
                <GlassCard className="space-y-3 transition-transform duration-200 ease-ios active:scale-[0.995]">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">{truck.truckNumber}</h3>
                    <span className="rounded-full bg-white/45 px-2 py-1 text-xs text-muted dark:bg-slate-900/30">
                      {truck.currentWorkedHours} h
                    </span>
                  </div>
                  <p className="text-sm text-muted">
                    {truck.brand} {truck.model} · {truck.year} · Odom {truck.currentOdometer} mi
                  </p>

                  {nearest ? (
                    <div>
                      <p className="mb-1 text-xs uppercase tracking-[0.16em] text-muted">
                        Proximo: {nearest.maintenanceName}
                      </p>
                      <div className="h-2 overflow-hidden rounded-full bg-white/50 dark:bg-slate-800">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-300 ease-ios"
                          style={{ width: `${nearest.completion}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {nearest.remainingHours <= 0
                          ? `Atrasado ${Math.abs(nearest.remainingHours)} h`
                          : `Faltan ${roundToOne(nearest.remainingHours)} h`}
                      </p>
                    </div>
                  ) : null}
                </GlassCard>
              </Link>
            </motion.article>
          );
        })}
      </section>
    </div>
  );
}

function roundToOne(value: number) {
  return Math.round(value * 10) / 10;
}
