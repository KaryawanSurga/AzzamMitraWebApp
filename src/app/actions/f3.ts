"use server";

import { getDatabase } from "@/db/client";
import { getCurrentOwner } from "@/lib/supabase/owner";
import { DrizzleF3Repository } from "@/server/f3/drizzle-repository";
import { F3Service } from "@/server/f3/service";

const service = () => new F3Service(new DrizzleF3Repository(getDatabase()));

export async function getSaleOperationsAction(input: unknown) { return service().getSaleOperations(input, await getCurrentOwner()); }
export async function createPaymentAction(input: unknown) { return service().createPayment(input, await getCurrentOwner()); }
export async function createDeliveryAction(input: unknown) { return service().createDelivery(input, await getCurrentOwner()); }
export async function recordDeliveryReceiptAction(input: unknown) { return service().recordDeliveryReceipt(input, await getCurrentOwner()); }
export async function setDeliveryStatusAction(input: unknown) { return service().setDeliveryStatus(input, await getCurrentOwner()); }
export async function getCrateAccountAction(input: unknown) { return service().getCrateAccount(input, await getCurrentOwner()); }
export async function listCrateBalancesAction(input: unknown) { return service().listCrateBalances(input, await getCurrentOwner()); }
export async function listCrateMovementsAction(input: unknown) { return service().listCrateMovements(input, await getCurrentOwner()); }
export async function recordCrateReturnAction(input: unknown) { return service().recordCrateReturn(input, await getCurrentOwner()); }
