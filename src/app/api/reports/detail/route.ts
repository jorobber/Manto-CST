export const dynamic = "force-dynamic";

import { parseDateRange, reportQuerySchema } from "@/lib/validators";
import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
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

    return ok({
      range: {
        start,
        end
      },
      rows: rows.map((row) => ({
        date: row.performedAt,
        truck: row.truck.truckNumber,
        service: row.maintenanceType.name,
        odometer: row.odometerAtService,
        user: row.performedBy.name,
        workorderNumber: row.workOrder.workorderNumber
      }))
    });
  } catch (error) {
    return fail("No se pudo generar el reporte detallado", 400, String(error));
  }
}
