import Link from "next/link";
import { redirect } from "next/navigation";
import { getDashboardCashflowAction } from "@/app/actions/f5";
import { CashflowChart } from "@/components/cashflow-chart";
import { getCurrentOwner } from "@/lib/supabase/owner";
import { InternalShell } from "@/components/internal-shell";
import { ErrorState, PageHeader, rupiah } from "@/components/ui";
const periodDate = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Jakarta",
});

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const owner = await getCurrentOwner();
  if (!owner) redirect("/login?next=/dashboard");

  const { days } = await searchParams;
  const result = await getDashboardCashflowAction({ days });

  return (
    <InternalShell ownerName={owner.display_name}>
      <main className="page dashboard-page">
        <PageHeader
          title={`Halo, ${owner.display_name}`}
          description="Pantau uang masuk dan biaya usaha tanpa mencampurkan modal atau prive."
        />
        <section className="dashboard-actions" aria-label="Aksi cepat">
          <Link className="button" href="/penjualan/baru">Catat penjualan</Link>
          <Link className="button" href="/pengeluaran/baru">Catat pengeluaran</Link>
          <Link className="button-secondary" href="/pelanggan?baru=1">Tambah pelanggan</Link>
        </section>

        <nav className="period-tabs" aria-label="Periode dashboard">
          {[7, 30, 90].map((period) => (
            <Link
              className={result.ok && result.data.days === period ? "active" : ""}
              href={`/dashboard?days=${period}`}
              key={period}
            >
              {period} hari
            </Link>
          ))}
        </nav>

        {!result.ok ? (
          <ErrorState {...result.error} retryHref="/dashboard"/>
        ) : (
          <>
            <p className="dashboard-period">
              {periodDate.format(new Date(`${result.data.from}T00:00:00+07:00`))}
              <span>—</span>
              {periodDate.format(new Date(`${result.data.to}T00:00:00+07:00`))}
            </p>

            <section className="metric-grid" aria-label="Ringkasan arus operasi">
              <article className="metric-card income">
                <span>Uang masuk</span>
                <strong>{rupiah(result.data.totalIncomeRupiah)}</strong>
                <small>Pembayaran pelanggan</small>
              </article>
              <article className="metric-card expense">
                <span>Pengeluaran usaha</span>
                <strong>{rupiah(result.data.totalExpenseRupiah)}</strong>
                <small>Biaya yang tercatat</small>
              </article>
              <article className={`metric-card net ${result.data.netCashflowRupiah < 0 ? "negative" : ""}`}>
                <span>Arus kas operasi</span>
                <strong>{rupiah(result.data.netCashflowRupiah)}</strong>
                <small>Uang masuk − pengeluaran</small>
              </article>
            </section>

            <CashflowChart points={result.data.points}/>

            <section className="dashboard-shortcuts">
              <Link href="/penjualan">
                <span>INVOICE & PEMBAYARAN</span>
                <strong>Lihat penjualan</strong>
                <small>Periksa pembayaran dan sisa piutang.</small>
              </Link>
              <Link href="/pengeluaran">
                <span>BIAYA USAHA</span>
                <strong>Lihat pengeluaran</strong>
                <small>Tinjau biaya berdasarkan periode.</small>
              </Link>
              <Link href="/pengaturan">
                <span>DI LUAR OPERASI</span>
                <strong>Modal &amp; prive</strong>
                <small>Tetap terpisah dari grafik operasional.</small>
              </Link>
            </section>
          </>
        )}
      </main>
    </InternalShell>
  );
}
