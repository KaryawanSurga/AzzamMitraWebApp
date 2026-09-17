"use server";

import { getDatabase } from "@/db/client";
import { getCurrentOwner } from "@/lib/supabase/owner";
import { limitOwnerMutation } from "@/server/rate-limit";
import { DrizzleF3Repository } from "@/server/f3/drizzle-repository";
import { F3Service } from "@/server/f3/service";

const service = () => new F3Service(new DrizzleF3Repository(getDatabase()));

export async function getSaleOperationsAction(input: unknown) { return service().getSaleOperations(input, await getCurrentOwner()); }
export async function createPaymentAction(input: unknown) { const owner = await getCurrentOwner(); return limitOwnerMutation(owner, "payment.create", 30) ?? service().createPayment(input, owner); }
export async function createDeliveryAction(input: unknown) { const owner = await getCurrentOwner(); return limitOwnerMutation(owner, "delivery.create", 30) ?? service().createDelivery(input, owner); }
export async function recordDeliveryReceiptAction(input: unknown) { const owner = await getCurrentOwner(); return limitOwnerMutation(owner, "delivery.receive", 30) ?? service().recordDeliveryReceipt(input, owner); }
export async function setDeliveryStatusAction(input: unknown) { const owner = await getCurrentOwner(); return limitOwnerMutation(owner, "delivery.status", 30) ?? service().setDeliveryStatus(input, owner); }
export async function getCrateAccountAction(input: unknown) { return service().getCrateAccount(input, await getCurrentOwner()); }
export async function listCrateBalancesAction(input: unknown) { return service().listCrateBalances(input, await getCurrentOwner()); }
export async function listCrateMovementsAction(input: unknown) { return service().listCrateMovements(input, await getCurrentOwner()); }
export async function recordCrateReturnAction(input: unknown) { const owner = await getCurrentOwner(); return limitOwnerMutation(owner, "crate.return", 30) ?? service().recordCrateReturn(input, owner); }
