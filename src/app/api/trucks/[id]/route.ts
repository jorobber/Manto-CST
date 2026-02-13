export const dynamic = "force-dynamic";

import { TruckStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/http";
import { truckSchema } from "@/lib/validators";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const truck = await prisma.truck.findUnique({
    where: { id: params.id },
    include: {
      yardEntries: {
        orderBy: { datetime: "desc" },
        take: 20,
        include: {
          recordedBy: {
            select: { id: true, name: true }
          }
        }
      },
      maintenanceStates: {
        include: {
          maintenanceType: true
        }
      },
      workOrders: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          maintenanceType: true
        }
      }
    }
  });

  if (!truck) return fail("Camión no encontrado", 404);

  return ok(truck);
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const parsed = truckSchema.partial().parse(body);

    const updated = await prisma.truck.update({
      where: { id: params.id },
      data: {
        ...(parsed.truckNumber ? { truckNumber: parsed.truckNumber } : {}),
        ...(parsed.brand ? { brand: parsed.brand } : {}),
        ...(parsed.model ? { model: parsed.model } : {}),
        ...(parsed.year ? { year: parsed.year } : {}),
        ...(parsed.status ? { status: parsed.status as TruckStatus } : {})
      }
    });

    return ok(updated);
  } catch (error) {
    return fail("No se pudo actualizar el camión", 400, String(error));
  }
}
