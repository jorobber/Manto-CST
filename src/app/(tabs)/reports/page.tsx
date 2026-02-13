"use client";

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { GlassCard } from "@/components/glass-card";
import { formatDate } from "@/lib/utils";
import { localService } from "@/lib/local/service";

type SummaryItem = ReturnType<typeof localService.getReportSummary>["summaryByTruck"][number];
type DetailRow = ReturnType<typeof localService.getReportDetail>["rows"][number];

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<"week" | "month" | "custom">("week");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [detail, setDetail] = useState<DetailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(
    () => ({
      period,
      from,
      to
    }),
    [period, from, to]
  );

  const load = async () => {
    setLoading(true);
    try {
      localService.initialize();
      const summaryRes = localService.getReportSummary(query);
      const detailRes = localService.getReportDetail(query);

      setSummary(summaryRes.summaryByTruck ?? []);
      setDetail(detailRes.rows ?? []);
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
  }, [query.period, query.from, query.to]);

  const exportCsv = () => {
    const csv = localService.exportDetailCsv(query);
    downloadFile(`maintenance-hours-${Date.now()}.csv`, csv, "text/csv;charset=utf-8");
  };

  const exportPdf = () => {
    const rows = localService.getReportDetail(query).rows;
    const html = `
      <html>
        <head>
          <title>Reporte de mantenimiento por horas</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 24px; }
            h1 { margin: 0 0 8px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #d4d4d8; padding: 6px; text-align: left; }
            th { background: #f4f4f5; }
          </style>
        </head>
        <body>
          <h1>Reporte de mantenimiento por horas</h1>
          <table>
            <thead>
              <tr><th>Fecha</th><th>Camion</th><th>Servicio</th><th>Horas</th><th>Usuario</th><th>Orden</th></tr>
            </thead>
            <tbody>
              ${rows
                .map(
                  (row) =>
                    `<tr><td>${new Date(row.date).toLocaleString()}</td><td>${row.truck}</td><td>${row.service}</td><td>${row.workedHours}</td><td>${row.user}</td><td>${row.workorderNumber}</td></tr>`
                )
                .join("")}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank", "width=1024,height=768");
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="space-y-4">
      <GlassCard>
        <h2 className="text-lg font-semibold">Reportes</h2>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { id: "week", label: "Semana" },
            { id: "month", label: "Mes" },
            { id: "custom", label: "Custom" }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setPeriod(item.id as typeof period)}
              className={`tap-target rounded-xl px-3 py-2 text-sm ${
                period === item.id ? "bg-primary text-white" : "bg-white/55 text-muted dark:bg-slate-900/35"
              }`}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>

        {period === "custom" ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <input
              type="date"
              className="tap-target rounded-xl border border-white/40 bg-white/50 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900/40"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
            <input
              type="date"
              className="tap-target rounded-xl border border-white/40 bg-white/50 px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900/40"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </div>
        ) : null}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={exportCsv}
            className="tap-target inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white dark:bg-primary"
            type="button"
          >
            <Download size={16} /> CSV
          </button>
          <button
            onClick={exportPdf}
            className="tap-target inline-flex items-center justify-center gap-2 rounded-2xl bg-white/55 px-4 py-3 text-sm font-medium text-muted dark:bg-slate-900/35"
            type="button"
          >
            <Download size={16} /> PDF
          </button>
        </div>
      </GlassCard>

      {error ? (
        <GlassCard>
          <p className="text-sm text-danger">{error}</p>
        </GlassCard>
      ) : null}

      <GlassCard>
        <h3 className="text-lg font-semibold">Resumen por camion</h3>
        <div className="mt-3 space-y-3">
          {loading ? (
            <div className="skeleton h-28 rounded-2xl" />
          ) : (
            summary.map((item) => (
              <article key={item.truckId} className="rounded-2xl bg-white/45 p-3 text-sm dark:bg-slate-900/35">
                <p className="font-semibold">{item.truckNumber}</p>
                <p className="text-muted">Engrases: {item.engrases.count}</p>
                <p className="text-muted">Aceite: {item.cambiosAceite.count}</p>
                <p className="text-muted">
                  Ultimo servicio: {item.lastService ? `${item.lastService.service} (${item.lastService.workedHours} h)` : "N/A"}
                </p>
                <p className="text-muted">
                  Proximo: {item.nextMaintenance ? `${item.nextMaintenance.maintenanceType} · ${item.nextMaintenance.remainingHours} h` : "N/A"}
                </p>
              </article>
            ))
          )}
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="text-lg font-semibold">Reporte detallado</h3>
        <div className="mt-3 space-y-2">
          {detail.slice(0, 50).map((row) => (
            <article key={`${row.workorderNumber}-${row.date}`} className="rounded-2xl bg-white/45 p-3 text-sm dark:bg-slate-900/35">
              <p className="font-medium">
                {row.truck} · {row.service}
              </p>
              <p className="text-muted">
                {formatDate(row.date)} · {row.workedHours} h · {row.user} · {row.workorderNumber}
              </p>
            </article>
          ))}

          {!loading && detail.length === 0 ? (
            <p className="rounded-2xl bg-white/45 p-3 text-sm text-muted dark:bg-slate-900/35">
              Sin datos para el periodo seleccionado.
            </p>
          ) : null}
        </div>
      </GlassCard>
    </div>
  );
}
