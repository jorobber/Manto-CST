export const dynamic = "force-dynamic";

import { ok } from "@/lib/http";
import { getDashboardSummary } from "@/lib/reporting";

export async function GET() {
  const data = await getDashboardSummary();
  return ok(data);
}
