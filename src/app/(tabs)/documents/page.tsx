"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarClock, FileText, Loader2, UploadCloud } from "lucide-react";
import { GlassCard } from "@/components/glass-card";
import { localService } from "@/lib/local/service";

type Truck = ReturnType<typeof localService.getTrucks>[number];
type DocumentsResponse = ReturnType<typeof localService.getTruckDocuments>;

const DOC_SUGGESTIONS = ["Aseguranza", "Placas"];
const WEEK_DAYS = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

function toMonthKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function parseMonthKey(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, monthIndex: month - 1 };
}

function monthLabel(monthKey: string) {
  const parsed = parseMonthKey(monthKey);
  if (!parsed) return monthKey;
  const date = new Date(parsed.year, parsed.monthIndex, 1);
  return new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(date);
}

function toDateInput(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

function formatDateOnly(iso: string) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(new Date(iso));
}

function tone(status: "EXPIRED" | "DUE_SOON" | "VALID") {
  if (status === "EXPIRED") return "text-danger";
  if (status === "DUE_SOON") return "text-warning";
  return "text-success";
}

function statusLabel(status: "EXPIRED" | "DUE_SOON" | "VALID", days: number) {
  if (status === "EXPIRED") return `Vencido hace ${Math.abs(days)} días`;
  if (status === "DUE_SOON") return days === 0 ? "Vence hoy" : `Vence en ${days} días`;
  return `Vigente (${days} días)`;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}

export default function DocumentsPage() {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [truckId, setTruckId] = useState("");
  const [documentName, setDocumentName] = useState("Aseguranza");
  const [startDate, setStartDate] = useState(toDateInput(new Date().toISOString()));
  const [expirationDate, setExpirationDate] = useState(toDateInput(new Date().toISOString()));
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [month, setMonth] = useState(toMonthKey(new Date()));
  const [data, setData] = useState<DocumentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    try {
      localService.initialize();
      const truckRows = localService.getTrucks();
      setTrucks(truckRows);
      if (!truckId && truckRows.length > 0) {
        setTruckId(truckRows[0].id);
      }
      setData(localService.getTruckDocuments({ month }));
      setError(null);
    } catch (loadError) {
      setError(String(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const calendar = useMemo(() => {
    const parsed = parseMonthKey(month);
    if (!parsed) return [];
    const { year, monthIndex } = parsed;
    const firstWeekday = new Date(year, monthIndex, 1).getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const cells: Array<{ day: number | null; docs: DocumentsResponse["rows"] }> = [];

    for (let i = 0; i < firstWeekday; i += 1) {
      cells.push({ day: null, docs: [] });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const docs = (data?.rows ?? []).filter((item) => {
        const date = new Date(item.expirationDate);
        return date.getDate() === day && date.getMonth() === monthIndex && date.getFullYear() === year;
      });
      cells.push({ day, docs });
    }

    while (cells.length % 7 !== 0) {
      cells.push({ day: null, docs: [] });
    }

    return cells;
  }, [data?.rows, month]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      if (!file) throw new Error("Debe seleccionar un PDF");
      if (file.type && !file.type.toLowerCase().includes("pdf")) {
        throw new Error("Solo se permiten archivos PDF");
      }

      const fileDataUrl = await readFileAsDataUrl(file);
      localService.uploadTruckDocument({
        truckId,
        documentName,
        startDate,
        expirationDate,
        fileName: file.name,
        fileDataUrl,
        mimeType: file.type || "application/pdf",
        fileSizeBytes: file.size,
        notes: notes || undefined
      });

      setMessage("Documento cargado correctamente.");
      setNotes("");
      setFile(null);
      setDocumentName("Aseguranza");
      load();
    } catch (submitError) {
      setError(String(submitError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <GlassCard className="bg-gradient-to-br from-cyan-500/20 via-sky-400/15 to-emerald-500/15">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Documentos de camión</p>
            <h2 className="mt-1 text-xl font-semibold">Control de vencimientos</h2>
          </div>
          <FileText className="text-primary" />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-white/50 p-3 dark:bg-slate-900/35">
            <p className="text-xs text-muted">Vencidos</p>
            <p className="text-xl font-semibold text-danger">{data?.summary.expired ?? 0}</p>
          </div>
          <div className="rounded-2xl bg-white/50 p-3 dark:bg-slate-900/35">
            <p className="text-xs text-muted">Por vencer</p>
            <p className="text-xl font-semibold text-warning">{data?.summary.dueSoon ?? 0}</p>
          </div>
          <div className="rounded-2xl bg-white/50 p-3 dark:bg-slate-900/35">
            <p className="text-xs text-muted">Vigentes</p>
            <p className="text-xl font-semibold text-success">{data?.summary.valid ?? 0}</p>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="text-lg font-semibold">Subir documento PDF</h3>
        <form onSubmit={submit} className="mt-3 space-y-3">
          <select
            className="tap-target w-full rounded-2xl border border-white/40 bg-white/50 px-3 py-3 text-base outline-none dark:border-white/10 dark:bg-slate-900/40"
            value={truckId}
            onChange={(event) => setTruckId(event.target.value)}
            required
          >
            {trucks.map((truck) => (
              <option key={truck.id} value={truck.id}>
                {truck.truckNumber}
              </option>
            ))}
          </select>

          <div>
            <input
              list="doc-types"
              className="tap-target w-full rounded-2xl border border-white/40 bg-white/50 px-3 py-3 text-base outline-none dark:border-white/10 dark:bg-slate-900/40"
              value={documentName}
              onChange={(event) => setDocumentName(event.target.value)}
              placeholder="Tipo de documento (ej: Aseguranza)"
              required
            />
            <datalist id="doc-types">
              {DOC_SUGGESTIONS.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs text-muted">Fecha inicio</label>
              <input
                type="date"
                className="tap-target w-full rounded-2xl border border-white/40 bg-white/50 px-3 py-3 text-sm outline-none dark:border-white/10 dark:bg-slate-900/40"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Fecha expiración</label>
              <input
                type="date"
                className="tap-target w-full rounded-2xl border border-white/40 bg-white/50 px-3 py-3 text-sm outline-none dark:border-white/10 dark:bg-slate-900/40"
                value={expirationDate}
                onChange={(event) => setExpirationDate(event.target.value)}
                required
              />
            </div>
          </div>

          <input
            type="file"
            accept="application/pdf"
            className="tap-target w-full rounded-2xl border border-dashed border-white/50 bg-white/40 px-3 py-3 text-sm outline-none file:mr-3 file:rounded-xl file:border-0 file:bg-primary file:px-3 file:py-2 file:text-white dark:border-white/15 dark:bg-slate-900/30"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            required
          />

          <input
            type="text"
            className="tap-target w-full rounded-2xl border border-white/40 bg-white/50 px-3 py-3 text-base outline-none dark:border-white/10 dark:bg-slate-900/40"
            placeholder="Notas (opcional)"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />

          <button
            type="submit"
            disabled={saving}
            className="tap-target flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-base font-semibold text-white transition-all duration-200 ease-ios active:scale-[0.99] disabled:opacity-60"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />}
            {saving ? "Subiendo..." : "Guardar documento"}
          </button>
        </form>
      </GlassCard>

      {error ? (
        <GlassCard>
          <p className="text-sm text-danger">{error}</p>
        </GlassCard>
      ) : null}

      {message ? (
        <GlassCard>
          <p className="text-sm text-success">{message}</p>
        </GlassCard>
      ) : null}

      <GlassCard>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Calendario de expiraciones</h3>
          <span className="inline-flex items-center gap-1 text-xs text-muted">
            <CalendarClock size={13} /> {monthLabel(month)} · {(data?.rows ?? []).length} eventos
          </span>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="tap-target rounded-xl bg-white/55 px-3 py-2 text-xs text-muted dark:bg-slate-900/35"
            onClick={() => {
              const parsed = parseMonthKey(month);
              if (!parsed) return;
              const d = new Date(parsed.year, parsed.monthIndex, 1);
              d.setMonth(d.getMonth() - 1);
              setMonth(toMonthKey(d));
            }}
          >
            Mes anterior
          </button>
          <button
            type="button"
            className="tap-target rounded-xl bg-white/55 px-3 py-2 text-xs text-muted dark:bg-slate-900/35"
            onClick={() => {
              const parsed = parseMonthKey(month);
              if (!parsed) return;
              const d = new Date(parsed.year, parsed.monthIndex, 1);
              d.setMonth(d.getMonth() + 1);
              setMonth(toMonthKey(d));
            }}
          >
            Mes siguiente
          </button>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-2 text-center text-[11px] text-muted">
          {WEEK_DAYS.map((day) => (
            <div key={day} className="py-1">
              {day}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="skeleton mt-2 h-56 rounded-2xl" />
        ) : (
          <div className="mt-2 grid grid-cols-7 gap-2">
            {calendar.map((cell, index) => (
              <div
                key={`${cell.day ?? "x"}-${index}`}
                className="relative min-h-[72px] rounded-2xl border border-white/40 bg-white/40 p-2 text-xs dark:border-white/10 dark:bg-slate-900/30"
              >
                {cell.day ? <p className="font-medium">{cell.day}</p> : null}
                {cell.day && cell.docs.length > 0 ? (
                  <span className="absolute right-2 top-2 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {cell.docs.length}
                  </span>
                ) : null}
                <div className="mt-1 space-y-1">
                  {cell.docs.slice(0, 2).map((doc) => (
                    <motion.div
                      key={doc.id}
                      initial={{ opacity: 0, y: 3 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`truncate rounded-lg bg-white/65 px-1.5 py-1 text-[10px] dark:bg-slate-800/70 ${tone(doc.expirationStatus)}`}
                    >
                      {doc.truck?.truckNumber ?? "N/A"} · {doc.documentName}
                    </motion.div>
                  ))}
                  {cell.docs.length > 2 ? (
                    <p className="text-[10px] text-muted">+{cell.docs.length - 2} más</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      <GlassCard>
        <h3 className="text-lg font-semibold">Próximas expiraciones</h3>
        <div className="mt-3 space-y-2">
          {(data?.upcoming ?? []).slice(0, 20).map((doc) => (
            <article key={doc.id} className="rounded-2xl border border-white/45 bg-white/45 p-3 text-sm dark:border-white/10 dark:bg-slate-900/35">
              <p className="font-medium">
                {doc.truck?.truckNumber ?? "N/A"} · {doc.documentName}
              </p>
              <p className="text-muted">
                Inicio: {formatDateOnly(doc.startDate)} · Expira: {formatDateOnly(doc.expirationDate)}
              </p>
              <p className={`text-xs ${tone(doc.expirationStatus)}`}>{statusLabel(doc.expirationStatus, doc.daysToExpiration)}</p>
              <a
                href={doc.fileDataUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block rounded-xl bg-primary/15 px-3 py-1 text-xs font-medium text-primary"
              >
                Ver PDF ({doc.fileName})
              </a>
            </article>
          ))}

          {!loading && (data?.upcoming.length ?? 0) === 0 ? (
            <p className="rounded-2xl bg-white/40 p-3 text-sm text-muted dark:bg-slate-900/35">
              No hay documentos cargados todavía.
            </p>
          ) : null}
        </div>
      </GlassCard>
    </div>
  );
}
