import { PrismaClient, TruckStatus, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: "admin@cst-manto.local" },
    update: {},
    create: {
      name: "Administrador",
      email: "admin@cst-manto.local",
      role: UserRole.ADMIN
    }
  });

  await prisma.user.upsert({
    where: { email: "yard@cst-manto.local" },
    update: {},
    create: {
      name: "Encargado Yarda",
      email: "yard@cst-manto.local",
      role: UserRole.OPERATOR
    }
  });

  const maintenanceTypes = [
    { name: "Engrase", intervalMiles: 400, warningBeforeMiles: 50 },
    { name: "Cambio de aceite", intervalMiles: 800, warningBeforeMiles: 80 }
  ];

  for (const mt of maintenanceTypes) {
    await prisma.maintenanceType.upsert({
      where: { name: mt.name },
      update: {
        intervalMiles: mt.intervalMiles,
        warningBeforeMiles: mt.warningBeforeMiles,
        isActive: true
      },
      create: mt
    });
  }

  const trucks = [
    { truckNumber: "TRK-001", brand: "Freightliner", model: "Cascadia", year: 2020 },
    { truckNumber: "TRK-002", brand: "Kenworth", model: "T680", year: 2021 }
  ];

  const activeTypes = await prisma.maintenanceType.findMany({ where: { isActive: true } });

  for (const t of trucks) {
    const truck = await prisma.truck.upsert({
      where: { truckNumber: t.truckNumber },
      update: {},
      create: {
        ...t,
        status: TruckStatus.ACTIVE,
        currentOdometer: 0
      }
    });

    for (const maintenanceType of activeTypes) {
      await prisma.truckMaintenanceState.upsert({
        where: {
          truckId_maintenanceTypeId: {
            truckId: truck.id,
            maintenanceTypeId: maintenanceType.id
          }
        },
        update: {},
        create: {
          truckId: truck.id,
          maintenanceTypeId: maintenanceType.id,
          lastServiceOdometer: 0
        }
      });
    }
  }

  console.log(`Seed complete. Admin ID: ${admin.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
