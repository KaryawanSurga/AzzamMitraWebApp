"use server";

import { getDatabase } from "@/db/client";
import { getCurrentOwner } from "@/lib/supabase/owner";
import { DrizzleF2Repository } from "@/server/f2/drizzle-repository";
import { F2Service } from "@/server/f2/service";

const service = () => new F2Service(new DrizzleF2Repository(getDatabase()));

export async function createCustomerAction(input: unknown) { return service().createCustomer(input, await getCurrentOwner()); }
export async function updateCustomerAction(input: unknown) { return service().updateCustomer(input, await getCurrentOwner()); }
export async function archiveCustomerAction(input: unknown) { return service().archiveCustomer(input, await getCurrentOwner()); }
export async function listCustomersAction(input: unknown) { return service().listCustomers(input, await getCurrentOwner()); }
export async function getCustomerAction(input: unknown) { return service().getCustomer(input, await getCurrentOwner()); }
export async function createSaleAction(input: unknown) { return service().createSale(input, await getCurrentOwner()); }
