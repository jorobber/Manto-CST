export const dynamic = "force-dynamic";

import { WorkOrderStatus } from "@prisma/client";
import { getActor } from "@/lib/auth";
import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { startWorkOrderSchema } from "@/lib/validators";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const actor = await getActor(request);
    const body = await request.json().catch(() => ({}));
    const parsed = startWorkOrderSchema.parse(body);

    const wo = await prisma.workOrder.findUnique({ where: { id: params.id } });
    if (!wo) return fail("Orden no encontrada", 404);

    if (wo.status === WorkOrderStatus.COMPLETED || wo.status === WorkOrderStatus.CANCELLED) {
      return fail("La orden ya está cerrada", 400);
    }

    const updated = await prisma.workOrder.update({
      where: { id: wo.id },
      data: {
        status: WorkOrderStatus.IN_PROGRESS,
        assignedToId: parsed.assignedToId ?? actor.id
      }
    });

    return ok(updated);
  } catch (error) {
    return fail("No se pudo iniciar la orden", 400, String(error));
  }
}
