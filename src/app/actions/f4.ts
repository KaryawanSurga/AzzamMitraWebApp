"use server";

import { revalidatePath } from "next/cache";
import { getDatabase } from "@/db/client";
import { getCurrentOwner } from "@/lib/supabase/owner";
import { DrizzleF4Repository } from "@/server/f4/drizzle-repository";
import { F4Service } from "@/server/f4/service";

const service = () => new F4Service(new DrizzleF4Repository(getDatabase()));
export async function createExpenseAction(input: unknown) { const result = await service().createExpense(input, await getCurrentOwner()); if (result.ok) revalidatePath("/pengeluaran"); return result; }
export async function listExpensesAction(input: unknown) { return service().listExpenses(input, await getCurrentOwner()); }
export async function createCapitalMovementAction(input: unknown) { const result = await service().createCapitalMovement(input, await getCurrentOwner()); if (result.ok) revalidatePath("/pengaturan"); return result; }
export async function listCapitalMovementsAction(input: unknown) { return service().listCapitalMovements(input, await getCurrentOwner()); }
