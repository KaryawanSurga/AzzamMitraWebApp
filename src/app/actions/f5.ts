"use server";

import { getDatabase } from "@/db/client";
import { getCurrentOwner } from "@/lib/supabase/owner";
import { DrizzleF5Repository } from "@/server/f5/drizzle-repository";
import { F5Service } from "@/server/f5/service";

export async function getDashboardCashflowAction(input: unknown) {
  const service = new F5Service(new DrizzleF5Repository(getDatabase()));
  return service.getDashboardCashflow(input, await getCurrentOwner());
}
