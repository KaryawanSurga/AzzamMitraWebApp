import Link from "next/link";
import { redirect } from "next/navigation";
import { getDashboardOverviewAction } from "@/app/actions/f5";
import { CashflowChart } from "@/components/cashflow-chart";
import { getCurrentOwner } from "@/lib/supabase/owner";
import { InternalShell } from "@/components/internal-shell";
import { ErrorState, PageHeader, formatCrate, rupiah } from "@/components/ui";
const periodDate = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Jakarta",
});
const actionLabels = {
  overdue: "Terlambat",
  due: "Jatuh tempo",
  delivery: "Belum diantar",
  crate: "Peti kembali",
} as const;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const owner = await getCurrentOwner();
  if (!owner) redirect("/login?next=/dashboard");

  const { days } = await searchParams;
  const result = await getDashboardOverviewAction({ days });

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

            <section className="business-metrics" aria-label="Ringkasan usaha">
              <article>
                <span>Penjualan bersih</span>
                <strong>{rupiah(result.data.totalSalesRupiah)}</strong>
                <small>Invoice terkonfirmasi pada periode</small>
              </article>
              <article>
                <span>Piutang akhir periode</span>
                <strong>{rupiah(result.data.totalReceivablesRupiah)}</strong>
                <small>Sisa pembayaran sampai akhir periode</small>
              </article>
              <article className={result.data.estimatedNetProfitRupiah < 0 ? "negative" : ""}>
                <span>Estimasi laba bersih</span>
                <strong>{rupiah(result.data.estimatedNetProfitRupiah)}</strong>
                <small>Penjualan bersih − pengeluaran</small>
              </article>
            </section>

            <CashflowChart points={result.data.points}/>

            <section className="action-board" aria-labelledby="action-board-title">
              <header>
                <div><span>HARI INI</span><h2 id="action-board-title">Perlu ditangani</h2></div>
                <div className="action-counts" aria-label="Jumlah tindakan">
                  {(Object.keys(actionLabels) as Array<keyof typeof actionLabels>).map((kind) => (
                    <span key={kind}><strong>{result.data.actionCounts[kind]}</strong>{actionLabels[kind]}</span>
                  ))}
                </div>
              </header>
              {result.data.actions.length === 0 ? (
                <p className="action-empty">Tidak ada invoice jatuh tempo, pengiriman tertunda, atau peti yang perlu ditagih.</p>
              ) : (
                <div className="action-list">{result.data.actions.map((action, index) => (
                  <Link href={action.href} key={`${action.kind}-${action.href}-${index}`}>
                    <span className={`action-kind ${action.kind}`}>{actionLabels[action.kind]}</span>
                    <div><strong>{action.title}</strong><small>{action.detail}</small></div>
                    <b>{action.amountRupiah !== undefined ? rupiah(action.amountRupiah) : formatCrate(action.crateQuantityMilli ?? 0)}</b>
                  </Link>
                ))}</div>
              )}
            </section>

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
              <Link href={`/laporan?from=${result.data.from}&to=${result.data.to}`}>
                <span>LAPORAN PERIODE</span>
                <strong>Buka laporan lengkap</strong>
                <small>Unduh CSV dari sumber angka yang sama.</small>
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
