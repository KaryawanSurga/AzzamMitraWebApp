import Link from "next/link";
import { redirect } from "next/navigation";
import { getPeriodReportAction } from "@/app/actions/f5";
import { InternalShell } from "@/components/internal-shell";
import { EmptyState, ErrorState, PageHeader, rupiah } from "@/components/ui";
import { getCurrentOwner } from "@/lib/supabase/owner";

const reportDate = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Jakarta",
});
const typeLabels = { sale: "Penjualan", payment: "Uang masuk", expense: "Pengeluaran" } as const;

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const owner = await getCurrentOwner();
  if (!owner) redirect("/login?next=/laporan");
  const filters = await searchParams;
  const result = await getPeriodReportAction(filters);

  return (
    <InternalShell ownerName={owner.display_name}>
      <main className="page wide report-page">
        <PageHeader
          title="Laporan usaha"
          description="Satu sumber untuk penjualan, uang masuk, biaya, piutang, dan estimasi hasil usaha."
          action={<Link className="text-link" href="/dashboard">Kembali ke dashboard</Link>}
        />

        <form className="report-filter" method="get">
          <label className="field">Dari tanggal<input name="from" type="date" defaultValue={filters.from}/></label>
          <label className="field">Sampai tanggal<input name="to" type="date" defaultValue={filters.to}/></label>
          <button type="submit">Terapkan periode</button>
          <Link className="button-secondary" href="/laporan">Bulan ini</Link>
        </form>

        {!result.ok ? <ErrorState {...result.error} retryHref="/laporan"/> : <>
          <header className="report-period-heading">
            <div>
              <span>PERIODE LAPORAN</span>
              <strong>{formatDate(result.data.from)} — {formatDate(result.data.to)}</strong>
            </div>
            <a className="button-secondary" href={`/laporan/export?from=${result.data.from}&to=${result.data.to}`}>Unduh CSV</a>
          </header>

          <section className="report-summary" aria-label="Ringkasan laporan">
            <article className={`report-profit ${result.data.estimatedNetProfitRupiah < 0 ? "negative" : ""}`}>
              <span>Estimasi laba bersih</span>
              <strong>{rupiah(result.data.estimatedNetProfitRupiah)}</strong>
              <small>Penjualan bersih + pendapatan lain − pengeluaran bisnis</small>
            </article>
            <div className="report-metrics">
              <ReportMetric label="Penjualan bersih" value={result.data.totalSalesRupiah}/>
              <ReportMetric label="Uang masuk" value={result.data.totalIncomeRupiah}/>
              <ReportMetric label="Pengeluaran" value={result.data.totalExpenseRupiah}/>
              <ReportMetric label="Arus kas bersih" value={result.data.netCashflowRupiah}/>
              <ReportMetric label="Piutang akhir periode" value={result.data.totalReceivablesRupiah}/>
              <ReportMetric label="Pendapatan lain" value={result.data.otherIncomeRupiah}/>
            </div>
          </section>

          <p className="report-disclaimer">
            Estimasi laba bersih bukan laba akuntansi presisi karena aplikasi belum mencatat stok dan HPP. Modal masuk dan prive tidak dihitung sebagai pendapatan atau biaya.
          </p>

          <section className="report-detail" aria-labelledby="report-detail-title">
            <div className="section-heading-inline">
              <div><span>SUMBER ANGKA</span><h2 id="report-detail-title">Rincian transaksi periode</h2></div>
              <strong>{result.data.rows.length} transaksi</strong>
            </div>
            {result.data.rows.length === 0 ? (
              <EmptyState title="Belum ada transaksi" detail="Ubah periode atau mulai catat penjualan dan pengeluaran."/>
            ) : (
              <div className="report-table-wrap">
                <table className="report-table">
                  <thead><tr><th>Tanggal</th><th>Jenis</th><th>Nomor</th><th>Keterangan</th><th>Nominal</th></tr></thead>
                  <tbody>{result.data.rows.map((row, index) => (
                    <tr key={`${row.type}-${row.reference}-${index}`}>
                      <td>{formatDate(row.date)}</td>
                      <td><span className={`report-type ${row.type}`}>{typeLabels[row.type]}</span></td>
                      <td>{row.reference}</td>
                      <td>{row.description}</td>
                      <td>{rupiah(row.amountRupiah)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </section>
        </>}
      </main>
    </InternalShell>
  );
}

function formatDate(value: string) {
  return reportDate.format(new Date(`${value}T00:00:00+07:00`));
}

function ReportMetric({ label, value }: { label: string; value: number }) {
  return <article><span>{label}</span><strong>{rupiah(value)}</strong></article>;
}
