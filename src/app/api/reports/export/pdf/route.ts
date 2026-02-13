export const dynamic = "force-dynamic";

import PDFDocument from "pdfkit";
import { parseDateRange, reportQuerySchema } from "@/lib/validators";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const parsed = reportQuerySchema.parse(params);
  const { start, end } = parseDateRange(parsed);

  const rows = await prisma.serviceHistory.findMany({
    where: {
      performedAt: {
        gte: start,
        lte: end
      },
      ...(parsed.truckId ? { truckId: parsed.truckId } : {})
    },
    include: {
      truck: { select: { truckNumber: true } },
      maintenanceType: { select: { name: true } },
      performedBy: { select: { name: true } },
      workOrder: { select: { workorderNumber: true } }
    },
    orderBy: { performedAt: "desc" }
  });

  const doc = new PDFDocument({ margin: 32, size: "A4" });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk) => chunks.push(chunk));

  doc.fontSize(16).text("Reporte de Mantenimiento", { underline: true });
  doc.moveDown(0.3);
  doc
    .fontSize(10)
    .text(`Rango: ${start.toISOString().slice(0, 10)} a ${end.toISOString().slice(0, 10)}`);
  doc.moveDown(0.8);

  doc.fontSize(9).text("Fecha | Camion | Servicio | Odometro | Usuario | Orden");
  doc.moveDown(0.5);

  for (const row of rows) {
    const line = `${row.performedAt.toISOString().slice(0, 10)} | ${row.truck.truckNumber} | ${row.maintenanceType.name} | ${row.odometerAtService} | ${row.performedBy.name} | ${row.workOrder.workorderNumber}`;
    doc.text(line, {
      width: 530
    });
    doc.moveDown(0.2);
  }

  doc.end();

  const buffer = await new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=maintenance-${Date.now()}.pdf`
    }
  });
}
