"use server";

import { getDatabase } from "@/db/client";
import { getCurrentOwner } from "@/lib/supabase/owner";
import { limitOwnerMutation } from "@/server/rate-limit";
import { DrizzleF2Repository } from "@/server/f2/drizzle-repository";
import { F2Service } from "@/server/f2/service";

const service = () => new F2Service(new DrizzleF2Repository(getDatabase()));

export async function createCustomerAction(input: unknown) { const owner = await getCurrentOwner(); return limitOwnerMutation(owner, "customer.create", 30) ?? service().createCustomer(input, owner); }
export async function updateCustomerAction(input: unknown) { const owner = await getCurrentOwner(); return limitOwnerMutation(owner, "customer.update", 30) ?? service().updateCustomer(input, owner); }
export async function archiveCustomerAction(input: unknown) { const owner = await getCurrentOwner(); return limitOwnerMutation(owner, "customer.archive", 30) ?? service().archiveCustomer(input, owner); }
export async function listCustomersAction(input: unknown) { return service().listCustomers(input, await getCurrentOwner()); }
export async function getCustomerAction(input: unknown) { return service().getCustomer(input, await getCurrentOwner()); }
export async function createSaleAction(input: unknown) { const owner = await getCurrentOwner(); return limitOwnerMutation(owner, "sale.create", 30) ?? service().createSale(input, owner); }
export async function listSalesAction(input: unknown) { return service().listSales(input, await getCurrentOwner()); }
export async function getSaleAction(input: unknown) { return service().getSale(input, await getCurrentOwner()); }
export async function getSaleHistoryAction(input: unknown) { return service().getSaleHistory(input, await getCurrentOwner()); }
export async function cancelSaleAction(input: unknown) { const owner = await getCurrentOwner(); return limitOwnerMutation(owner, "sale.cancel", 10) ?? service().cancelSale(input, owner); }
export async function correctSaleAction(input: unknown) { const owner = await getCurrentOwner(); return limitOwnerMutation(owner, "sale.correct", 10) ?? service().correctSale(input, owner); }
