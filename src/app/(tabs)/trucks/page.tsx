"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { GlassCard } from "@/components/glass-card";
import { localService } from "@/lib/local/service";

type TruckItem = ReturnType<typeof localService.getTrucks>[number];

function percent(value: number) {
  return Math.min(100, Math.max(0, value));
}

export default function TrucksPage() {
  const [trucks, setTrucks] = useState<TruckItem[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    localService.initialize();
    setTrucks(localService.getTrucks());
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

  return (
    <div className="space-y-4">
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

      <section className="space-y-3">
        {filtered.map((truck, index) => {
          const nearest = truck.maintenanceStates
            .map((state) => {
              const milesSince = truck.currentOdometer - state.lastServiceOdometer;
              const completion = percent((milesSince / state.maintenanceType.intervalMiles) * 100);
              const remaining = state.maintenanceType.intervalMiles - milesSince;

              return {
                maintenanceName: state.maintenanceType.name,
                completion,
                remaining
              };
            })
            .sort((a, b) => a.remaining - b.remaining)[0];

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
                      {truck.currentOdometer} mi
                    </span>
                  </div>
                  <p className="text-sm text-muted">
                    {truck.brand} {truck.model} · {truck.year}
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
                        {nearest.remaining <= 0
                          ? `Atrasado ${Math.abs(nearest.remaining)} mi`
                          : `Faltan ${nearest.remaining} mi`}
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
