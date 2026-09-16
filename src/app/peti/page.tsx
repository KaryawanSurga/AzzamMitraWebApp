import Link from "next/link";
import { redirect } from "next/navigation";
import { listCrateBalancesAction } from "@/app/actions/f3";
import { CrateReturnForm } from "@/components/crate-return-form";
import { InternalShell } from "@/components/internal-shell";
import { EmptyState, ErrorState, PageHeader, formatCrate } from "@/components/ui";
import { getCurrentOwner } from "@/lib/supabase/owner";

export default async function CratePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const owner = await getCurrentOwner();
  if (!owner) redirect("/login?next=/peti");
  const { q = "" } = await searchParams;
  const balances = await listCrateBalancesAction({ query: q, limit: 100, offset: 0 });
  const accounts = balances.ok ? balances.data.map((balance) => ({ customerId: balance.customerId, customerName: balance.customerName, balanceMilli: balance.balanceMilli })) : [];

  return (
    <InternalShell ownerName={owner.display_name}>
      <main className="page">
        <PageHeader title="Peti" description="Saldo peti yang masih dibawa pelanggan dan riwayat pengembaliannya."/>
        <form className="search" role="search">
          <label htmlFor="crate-search">Cari nama atau nomor pelanggan</label>
          <div><input id="crate-search" name="q" defaultValue={q}/><button type="submit">Cari</button></div>
        </form>
        {!balances.ok ? <ErrorState {...balances.error} retryHref="/peti"/> : balances.data.length === 0
          ? <EmptyState title={q ? "Pelanggan tidak ditemukan" : "Semua peti sudah kembali"} detail={q ? "Coba kata pencarian lain." : "Tidak ada pelanggan yang masih membawa peti."}/>
          : <div className="data-list">{balances.data.map((balance) => (
              <Link className="data-row" href={`/pelanggan/${balance.customerId}`} key={balance.customerId}>
                <div><strong>{balance.customerName}</strong><span>{balance.customerNumber}</span></div>
                <div className="row-end"><strong className="crate-balance">{formatCrate(balance.balanceMilli)}</strong><span>Bawa peti</span></div>
              </Link>
            ))}</div>}
        <section className="operations-section">
          <h2>Catat peti kembali</h2>
          <CrateReturnForm accounts={accounts}/>
        </section>
      </main>
    </InternalShell>
  );
}
