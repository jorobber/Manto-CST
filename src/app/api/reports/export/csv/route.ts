export const dynamic = "force-dynamic";

import { parseDateRange, reportQuerySchema } from "@/lib/validators";
import { prisma } from "@/lib/prisma";

function toCsvCell(value: string | number | Date) {
  const str = value instanceof Date ? value.toISOString() : String(value);
  return `"${str.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const parsed = reportQuerySchema.parse(params);
  const { start, end } = parseDateRange(parsed);

  const rows = await prisma.serviceHistory.findMany({
    where: {
      performedAt: {
        gte: start,
        lte: end
      },
      ...(parsed.truckId ? { truckId: parsed.truckId } : {})
    },
    include: {
      truck: { select: { truckNumber: true } },
      maintenanceType: { select: { name: true } },
      performedBy: { select: { name: true } },
      workOrder: { select: { workorderNumber: true } }
    },
    orderBy: { performedAt: "desc" }
  });

  const header = ["Fecha", "Camion", "Servicio", "Odometro", "Usuario", "Orden"];
  const content = [
    header.map(toCsvCell).join(","),
    ...rows.map((row) =>
      [
        row.performedAt,
        row.truck.truckNumber,
        row.maintenanceType.name,
        row.odometerAtService,
        row.performedBy.name,
        row.workOrder.workorderNumber
      ]
        .map(toCsvCell)
        .join(",")
    )
  ].join("\n");

  return new Response(content, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=maintenance-${Date.now()}.csv`
    }
  });
}
