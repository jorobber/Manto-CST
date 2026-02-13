export const dynamic = "force-dynamic";

import { Prisma } from "@prisma/client";
import { assertAdmin, getActor } from "@/lib/auth";
import { recalculateTruckImpact } from "@/lib/maintenance-engine";
import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { correctionSchema } from "@/lib/validators";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const actor = await getActor(request);
    assertAdmin(actor);

    const body = await request.json();
    const parsed = correctionSchema.parse(body);

    const result = await prisma.$transaction(async (tx) => {
      const target = await tx.yardEntry.findUnique({
        where: { id: params.id }
      });

      if (!target) {
        throw new Error("Entrada de yarda no encontrada");
      }

      const ordered = await tx.yardEntry.findMany({
        where: { truckId: target.truckId },
        orderBy: [{ datetime: "asc" }, { createdAt: "asc" }],
        select: { id: true, odometer: true }
      });

      const currentIndex = ordered.findIndex((entry) => entry.id === target.id);
      if (currentIndex < 0) {
        throw new Error("No se pudo ubicar la lectura a corregir");
      }

      const previous = ordered[currentIndex - 1];
      const next = ordered[currentIndex + 1];

      if (previous && parsed.odometer < previous.odometer) {
        throw new Error(
          `Corrección inválida: el odómetro no puede ser menor al anterior (${previous.odometer}).`
        );
      }

      if (next && parsed.odometer > next.odometer) {
        throw new Error(
          `Corrección inválida: el odómetro no puede ser mayor al siguiente (${next.odometer}).`
        );
      }

      const updated = await tx.yardEntry.update({
        where: { id: target.id },
        data: {
          odometer: parsed.odometer
        }
      });

      await tx.auditLog.create({
        data: {
          entityType: "YardEntry",
          entityId: target.id,
          oldValue: {
            odometer: target.odometer
          },
          newValue: {
            odometer: parsed.odometer
          },
          changedById: actor.id,
          reason: parsed.reason
        }
      });

      await recalculateTruckImpact({ tx, truckId: target.truckId });

      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return ok(result);
  } catch (error) {
    return fail("No se pudo corregir la lectura de odómetro", 400, String(error));
  }
}
