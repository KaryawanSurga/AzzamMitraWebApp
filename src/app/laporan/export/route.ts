import { getDatabase } from "@/db/client";
import { periodReportCsv } from "@/domain/reports";
import { getCurrentOwner } from "@/lib/supabase/owner";
import { DrizzleF5Repository } from "@/server/f5/drizzle-repository";
import { F5Service } from "@/server/f5/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const owner = await getCurrentOwner();
  if (!owner) return Response.json({ error: "Sesi owner diperlukan." }, { status: 401 });

  const url = new URL(request.url);
  const result = await new F5Service(new DrizzleF5Repository(getDatabase())).getPeriodReport({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  }, owner);
  if (!result.ok) {
    return Response.json({ error: result.error.message }, { status: result.error.code === "validation" ? 400 : 503 });
  }

  const filename = `laporan-azzam-mitra-${result.data.from}-${result.data.to}.csv`;
  return new Response(`\uFEFF${periodReportCsv(result.data)}`, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
