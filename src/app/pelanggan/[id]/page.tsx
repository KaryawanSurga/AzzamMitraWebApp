import { notFound, redirect } from "next/navigation";
import { getCustomerAction } from "@/app/actions/f2";
import { CustomerForm } from "@/components/customer-form";
import { ErrorState, PageHeader } from "@/components/ui";
import { InternalShell } from "@/components/internal-shell";
import { getCurrentOwner } from "@/lib/supabase/owner";
export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) { const owner = await getCurrentOwner(); if (!owner) redirect("/login?next=/pelanggan"); const { id } = await params; const result = await getCustomerAction({ id }); if (!result.ok && result.error.code === "not_found") notFound(); return <InternalShell ownerName={owner.display_name}><main className="page"><PageHeader title={result.ok ? result.data.name : "Detail pelanggan"} description={result.ok ? `${result.data.customerNumber}${result.data.isActive ? "" : " · Dinonaktifkan"}` : undefined}/>{result.ok ? <CustomerForm customer={result.data}/> : <ErrorState {...result.error} retryHref={`/pelanggan/${id}`}/>}</main></InternalShell>; }
