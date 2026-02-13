export const dynamic = "force-dynamic";

import { Prisma, WorkOrderStatus } from "@prisma/client";
import { getActor } from "@/lib/auth";
import { evaluateTruckMaintenance } from "@/lib/maintenance-engine";
import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { completeWorkOrderSchema } from "@/lib/validators";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const actor = await getActor(request);
    const body = await request.json();
    const parsed = completeWorkOrderSchema.parse(body);

    const result = await prisma.$transaction(async (tx) => {
      const wo = await tx.workOrder.findUnique({
        where: { id: params.id },
        include: {
          truck: true,
          maintenanceType: true,
          serviceHistory: true
        }
      });

      if (!wo) {
        throw new Error("Orden no encontrada");
      }

      if (wo.status === WorkOrderStatus.COMPLETED || wo.status === WorkOrderStatus.CANCELLED) {
        throw new Error("La orden ya está cerrada");
      }

      if (parsed.odometerAtService > wo.truck.currentOdometer) {
        throw new Error("El odómetro de servicio no puede ser mayor al actual del camión");
      }

      const completedOrder = await tx.workOrder.update({
        where: { id: wo.id },
        data: {
          status: WorkOrderStatus.COMPLETED,
          completedAt: new Date(),
          assignedToId: wo.assignedToId ?? actor.id
        }
      });

      if (!wo.serviceHistory) {
        await tx.serviceHistory.create({
          data: {
            truckId: wo.truckId,
            maintenanceTypeId: wo.maintenanceTypeId,
            workorderId: wo.id,
            odometerAtService: parsed.odometerAtService,
            performedById: actor.id,
            notes: parsed.notes,
            attachmentUrl: parsed.attachmentUrl
          }
        });
      }

      await tx.truckMaintenanceState.upsert({
        where: {
          truckId_maintenanceTypeId: {
            truckId: wo.truckId,
            maintenanceTypeId: wo.maintenanceTypeId
          }
        },
        update: {
          lastServiceOdometer: parsed.odometerAtService,
          lastServiceAt: new Date()
        },
        create: {
          truckId: wo.truckId,
          maintenanceTypeId: wo.maintenanceTypeId,
          lastServiceOdometer: parsed.odometerAtService,
          lastServiceAt: new Date()
        }
      });

      const maintenanceSnapshot = await evaluateTruckMaintenance({
        tx,
        truckId: wo.truckId,
        currentOdometer: wo.truck.currentOdometer,
        pruneNotDue: true
      });

      return {
        workOrder: completedOrder,
        maintenanceSnapshot
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return ok(result);
  } catch (error) {
    return fail("No se pudo completar la orden", 400, String(error));
  }
}
