import { redirect } from "next/navigation";
import { listCustomersAction } from "@/app/actions/f2";
import { getCurrentOwner } from "@/lib/supabase/owner";
import { InternalShell } from "@/components/internal-shell";
import { PageHeader, ErrorState } from "@/components/ui";
import { SaleForm } from "@/components/sale-form";
export default async function NewSalePage() { const owner = await getCurrentOwner(); if (!owner) redirect("/login?next=/penjualan/baru"); const customers = await listCustomersAction({ query: "", includeArchived: false, limit: 100, offset: 0 }); return <InternalShell ownerName={owner.display_name}><main className="page wide"><PageHeader title="Penjualan baru" description="Isi transaksi, periksa ringkasan, lalu simpan sebagai invoice."/>{customers.ok ? <SaleForm customers={customers.data}/> : <ErrorState {...customers.error} retryHref="/penjualan/baru"/>}</main></InternalShell>; }
