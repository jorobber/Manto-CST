export const dynamic = "force-dynamic";

import { parseDateRange, reportQuerySchema } from "@/lib/validators";
import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { formatMiles } from "@/lib/utils";

export async function GET(request: Request) {
  try {
    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    const parsed = reportQuerySchema.parse(params);
    const { start, end } = parseDateRange(parsed);

    const [trucks, services] = await Promise.all([
      prisma.truck.findMany({
        orderBy: { truckNumber: "asc" },
        include: {
          maintenanceStates: {
            include: {
              maintenanceType: true
            }
          }
        }
      }),
      prisma.serviceHistory.findMany({
        where: {
          performedAt: {
            gte: start,
            lte: end
          }
        },
        include: {
          truck: { select: { id: true, truckNumber: true } },
          maintenanceType: true,
          workOrder: { select: { workorderNumber: true } },
          performedBy: { select: { name: true } }
        },
        orderBy: { performedAt: "asc" }
      })
    ]);

    const summaryByTruck = trucks.map((truck) => {
      const truckServices = services.filter((svc) => svc.truckId === truck.id);
      const engrase = truckServices.filter((svc) => svc.maintenanceType.name.toLowerCase().includes("engrase"));
      const aceite = truckServices.filter((svc) => svc.maintenanceType.name.toLowerCase().includes("aceite"));

      const nextMaintenance = truck.maintenanceStates
        .map((st) => {
          const dueAt = st.lastServiceOdometer + st.maintenanceType.intervalMiles;
          const remaining = dueAt - truck.currentOdometer;
          return {
            maintenanceType: st.maintenanceType.name,
            dueAtOdometer: dueAt,
            remainingMiles: remaining,
            state: remaining < 0 ? "OVERDUE" : remaining === 0 ? "DUE" : "UPCOMING"
          };
        })
        .sort((a, b) => a.remainingMiles - b.remainingMiles)[0];

      const lastService = [...truckServices].sort(
        (a, b) => +new Date(b.performedAt) - +new Date(a.performedAt)
      )[0];

      return {
        truckId: truck.id,
        truckNumber: truck.truckNumber,
        engrases: {
          count: engrase.length,
          dates: engrase.map((x) => x.performedAt)
        },
        cambiosAceite: {
          count: aceite.length,
          dates: aceite.map((x) => x.performedAt)
        },
        lastService: lastService
          ? {
              date: lastService.performedAt,
              service: lastService.maintenanceType.name,
              odometer: formatMiles(lastService.odometerAtService)
            }
          : null,
        nextMaintenance: nextMaintenance ?? null
      };
    });

    return ok({
      range: {
        start,
        end
      },
      totalServices: services.length,
      summaryByTruck
    });
  } catch (error) {
    return fail("No se pudo generar el resumen", 400, String(error));
  }
}
