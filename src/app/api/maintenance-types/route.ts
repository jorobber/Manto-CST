export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/http";
import { maintenanceTypeSchema } from "@/lib/validators";

export async function GET() {
  const maintenanceTypes = await prisma.maintenanceType.findMany({
    orderBy: { intervalMiles: "asc" }
  });

  return ok(maintenanceTypes);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = maintenanceTypeSchema.parse(body);

    const created = await prisma.maintenanceType.create({
      data: parsed
    });

    const trucks = await prisma.truck.findMany({
      where: {
        status: {
          not: "OUT_OF_SERVICE"
        }
      },
      select: { id: true, currentOdometer: true }
    });

    await prisma.$transaction(
      trucks.map((truck) =>
        prisma.truckMaintenanceState.upsert({
          where: {
            truckId_maintenanceTypeId: {
              truckId: truck.id,
              maintenanceTypeId: created.id
            }
          },
          update: {},
          create: {
            truckId: truck.id,
            maintenanceTypeId: created.id,
            lastServiceOdometer: truck.currentOdometer
          }
        })
      )
    );

    return ok(created, { status: 201 });
  } catch (error) {
    return fail("No se pudo crear el tipo de mantenimiento", 400, String(error));
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const id = body.id as string | undefined;
    if (!id) return fail("Debe enviar id", 400);

    const parsed = maintenanceTypeSchema.partial().parse(body);
    const updated = await prisma.maintenanceType.update({
      where: { id },
      data: parsed
    });

    return ok(updated);
  } catch (error) {
    return fail("No se pudo actualizar el tipo de mantenimiento", 400, String(error));
  }
}
