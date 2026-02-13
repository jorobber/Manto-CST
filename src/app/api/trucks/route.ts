export const dynamic = "force-dynamic";

import { TruckStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/http";
import { truckSchema } from "@/lib/validators";

export async function GET() {
  const trucks = await prisma.truck.findMany({
    orderBy: { truckNumber: "asc" },
    include: {
      maintenanceStates: {
        include: {
          maintenanceType: true
        }
      }
    }
  });

  return ok(trucks);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = truckSchema.parse(body);

    const truck = await prisma.truck.create({
      data: {
        truckNumber: parsed.truckNumber,
        brand: parsed.brand,
        model: parsed.model,
        year: parsed.year,
        status: (parsed.status as TruckStatus | undefined) ?? TruckStatus.ACTIVE
      }
    });

    const maintenanceTypes = await prisma.maintenanceType.findMany({ where: { isActive: true } });
    for (const mt of maintenanceTypes) {
      await prisma.truckMaintenanceState.create({
        data: {
          truckId: truck.id,
          maintenanceTypeId: mt.id,
          lastServiceOdometer: truck.currentOdometer
        }
      });
    }

    return ok(truck, { status: 201 });
  } catch (error) {
    return fail("No se pudo crear el camión", 400, String(error));
  }
}
