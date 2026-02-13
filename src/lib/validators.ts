import { WorkOrderStatus } from "@prisma/client";
import { z } from "zod";

export const truckSchema = z.object({
  truckNumber: z.string().min(1).max(30),
  brand: z.string().min(1).max(60),
  model: z.string().min(1).max(60),
  year: z.number().int().gte(1980).lte(2100),
  status: z.enum(["ACTIVE", "INACTIVE", "OUT_OF_SERVICE"]).optional()
});

export const yardEntrySchema = z.object({
  truckId: z.string().min(1),
  odometer: z.number().int().nonnegative(),
  notes: z.string().max(500).optional(),
  photoUrl: z.string().url().optional(),
  datetime: z.coerce.date().optional()
});

export const correctionSchema = z.object({
  odometer: z.number().int().nonnegative(),
  reason: z.string().min(8, "Motivo obligatorio (>=8 caracteres)")
});

export const maintenanceTypeSchema = z.object({
  name: z.string().min(1).max(60),
  intervalMiles: z.number().int().positive(),
  warningBeforeMiles: z.number().int().nonnegative(),
  isActive: z.boolean().optional()
});

export const completeWorkOrderSchema = z.object({
  odometerAtService: z.number().int().nonnegative(),
  notes: z.string().max(500).optional(),
  attachmentUrl: z.string().url().optional()
});

export const startWorkOrderSchema = z.object({
  assignedToId: z.string().optional()
});

export const reportQuerySchema = z.object({
  period: z.enum(["week", "month", "custom"]).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  truckId: z.string().optional(),
  status: z.nativeEnum(WorkOrderStatus).optional()
});

export function parseDateRange(input: { period?: string; from?: string; to?: string }) {
  const now = new Date();
  const period = input.period ?? "week";

  if (period === "month") {
    const start = new Date(now);
    start.setDate(now.getDate() - 30);
    return { start, end: now };
  }

  if (period === "custom") {
    if (!input.from || !input.to) {
      throw new Error("Para rango personalizado debe enviar from y to");
    }
    const start = new Date(input.from);
    const end = new Date(input.to);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new Error("Fechas inválidas en rango personalizado");
    }
    return { start, end };
  }

  const start = new Date(now);
  start.setDate(now.getDate() - 7);
  return { start, end: now };
}
