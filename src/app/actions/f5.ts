"use server";

import { getDatabase } from "@/db/client";
import { getCurrentOwner } from "@/lib/supabase/owner";
import { DrizzleF5Repository } from "@/server/f5/drizzle-repository";
import { F5Service } from "@/server/f5/service";

const service = () => new F5Service(new DrizzleF5Repository(getDatabase()));

export async function getDashboardOverviewAction(input: unknown) {
  return service().getDashboardOverview(input, await getCurrentOwner());
}

export async function getPeriodReportAction(input: unknown) {
  return service().getPeriodReport(input, await getCurrentOwner());
}
