import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentOwner } from "@/lib/supabase/owner";
import { InternalShell } from "@/components/internal-shell";
import { PageHeader } from "@/components/ui";
export default async function DashboardPage() {
  const owner = await getCurrentOwner();
  if (!owner) redirect("/login?next=/dashboard");

  return (
    <InternalShell ownerName={owner.display_name}>
      <main className="page">
        <PageHeader title={`Halo, ${owner.display_name}`} description="Kelola transaksi, pelanggan, dan arus operasional Azzam Mitra dari satu tempat."/>
        <section className="quick-actions">
          <Link className="button" href="/penjualan/baru">Catat penjualan</Link>
          <Link className="button" href="/pengeluaran/baru">Catat pengeluaran</Link>
          <Link className="button-secondary" href="/pelanggan?baru=1">Tambah pelanggan</Link>
        </section>
      </main>
    </InternalShell>
  );
}
