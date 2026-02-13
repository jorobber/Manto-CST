export const dynamic = "force-dynamic";

import { Prisma } from "@prisma/client";
import { getActor } from "@/lib/auth";
import { evaluateTruckMaintenance } from "@/lib/maintenance-engine";
import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { yardEntrySchema } from "@/lib/validators";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const truckId = url.searchParams.get("truckId") ?? undefined;

  const entries = await prisma.yardEntry.findMany({
    where: truckId ? { truckId } : undefined,
    orderBy: [{ datetime: "desc" }, { createdAt: "desc" }],
    include: {
      truck: {
        select: {
          id: true,
          truckNumber: true
        }
      },
      recordedBy: {
        select: {
          id: true,
          name: true
        }
      }
    },
    take: 200
  });

  return ok(entries);
}

export async function POST(request: Request) {
  try {
    const actor = await getActor(request);
    const body = await request.json();
    const parsed = yardEntrySchema.parse(body);

    const result = await prisma.$transaction(async (tx) => {
      const truck = await tx.truck.findUnique({
        where: { id: parsed.truckId },
        include: {
          yardEntries: {
            orderBy: [{ datetime: "desc" }, { createdAt: "desc" }],
            take: 1
          }
        }
      });

      if (!truck) {
        throw new Error("Camión no encontrado");
      }

      const latestEntry = truck.yardEntries.at(0);
      const previousOdometer = latestEntry?.odometer ?? 0;

      if (parsed.odometer < previousOdometer) {
        throw new Error(
          `Lectura inválida. El último odómetro es ${previousOdometer} y no puede disminuir.`
        );
      }

      const computedDelta = parsed.odometer - previousOdometer;

      const createdEntry = await tx.yardEntry.create({
        data: {
          truckId: parsed.truckId,
          odometer: parsed.odometer,
          computedDelta,
          recordedById: actor.id,
          notes: parsed.notes,
          photoUrl: parsed.photoUrl,
          datetime: parsed.datetime ?? new Date()
        }
      });

      await tx.truck.update({
        where: { id: truck.id },
        data: {
          currentOdometer: parsed.odometer
        }
      });

      const maintenanceSnapshot = await evaluateTruckMaintenance({
        tx,
        truckId: truck.id,
        currentOdometer: parsed.odometer,
        createdFromEntryId: createdEntry.id
      });

      return {
        yardEntry: createdEntry,
        maintenanceSnapshot,
        generatedWorkOrders: maintenanceSnapshot
          .filter((item) => !!item.openWorkOrderId)
          .map((item) => ({
            maintenanceName: item.maintenanceName,
            workOrderId: item.openWorkOrderId,
            workOrderNumber: item.openWorkOrderNumber,
            health: item.health
          }))
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return ok(result, { status: 201 });
  } catch (error) {
    return fail("No se pudo registrar la entrada a yarda", 400, String(error));
  }
}
