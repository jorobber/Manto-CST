import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/legacy/prisma";

export type Actor = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export async function getActor(request: Request): Promise<Actor> {
  const url = new URL(request.url);
  const actorId = url.searchParams.get("actorId") ?? request.headers.get("x-actor-id");
  const actorEmail = url.searchParams.get("actorEmail") ?? request.headers.get("x-actor-email");

  const actor = await prisma.user.findFirst({
    where: actorId ? { id: actorId } : actorEmail ? { email: actorEmail } : undefined,
    orderBy: { createdAt: "asc" }
  });

  if (!actor) {
    throw new Error("No hay usuario disponible para registrar la operación.");
  }

  return actor;
}

export function assertAdmin(actor: Actor) {
  if (actor.role !== UserRole.ADMIN) {
    throw new Error("Operación permitida solo para Admin.");
  }
}
