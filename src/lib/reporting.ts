import { Prisma, WorkOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function getDashboardSummary() {
  const trucks = await prisma.truck.findMany({
    include: {
      maintenanceStates: {
        include: {
          maintenanceType: true
        }
      },
      workOrders: {
        where: {
          status: {
            in: [WorkOrderStatus.PENDING, WorkOrderStatus.IN_PROGRESS]
          }
        },
        include: {
          maintenanceType: true
        },
        orderBy: {
          createdAt: "desc"
        }
      }
    }
  });

  let dueNow = 0;
  let dueSoon = 0;
  let overdue = 0;

  for (const truck of trucks) {
    for (const st of truck.maintenanceStates) {
      const miles = truck.currentOdometer - st.lastServiceOdometer;
      if (miles > st.maintenanceType.intervalMiles) overdue += 1;
      else if (miles === st.maintenanceType.intervalMiles) dueNow += 1;
      else if (
        st.maintenanceType.intervalMiles - miles <= st.maintenanceType.warningBeforeMiles
      )
        dueSoon += 1;
    }
  }

  const pendingOrders = trucks
    .flatMap((t) =>
      t.workOrders.map((wo) => ({
        id: wo.id,
        workorderNumber: wo.workorderNumber,
        truckNumber: t.truckNumber,
        maintenanceName: wo.maintenanceType.name,
        status: wo.status,
        dueAtOdometer: wo.dueAtOdometer,
        createdAt: wo.createdAt
      }))
    )
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  return {
    totals: {
      dueNow,
      dueSoon,
      overdue,
      pendingOrders: pendingOrders.length
    },
    pendingOrders
  };
}

export function buildReportWhere(params: {
  start: Date;
  end: Date;
  truckId?: string;
  status?: WorkOrderStatus;
}): Prisma.ServiceHistoryWhereInput {
  return {
    performedAt: {
      gte: params.start,
      lte: params.end
    },
    truckId: params.truckId
  };
}
