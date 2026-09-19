import Link from "next/link";
import { redirect } from "next/navigation";
import { getDashboardOverviewAction } from "@/app/actions/f5";
import { CashflowBars, DeltaBadge, ExpenseDonut, Sparkline } from "@/components/dashboard-charts";
import { getCurrentOwner } from "@/lib/supabase/owner";
import { InternalShell } from "@/components/internal-shell";
import { ErrorState, formatCrate, rupiah } from "@/components/ui";

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
        <header className="dash-topbar">
          <div className="dash-greeting">
            <h1>Halo, {owner.display_name}!</h1>
            <p>Pantau penjualan, pembayaran, dan biaya usaha dalam satu layar.</p>
          </div>
          <nav className="dash-period" aria-label="Periode dashboard">
            {[7, 30, 90].map((period) => (
              <Link className={result.ok && result.data.days === period ? "active" : ""} href={`/dashboard?days=${period}`} key={period}>
                {period} hari
              </Link>
            ))}
          </nav>
        </header>

        <section className="dash-actions" aria-label="Aksi cepat">
          <Link className="button" href="/penjualan/baru">Catat penjualan</Link>
          <Link className="button" href="/pengeluaran/baru">Catat pengeluaran</Link>
          <Link className="button-secondary" href="/pelanggan?baru=1">Tambah pelanggan</Link>
        </section>

        {!result.ok ? (
          <ErrorState {...result.error} retryHref="/dashboard"/>
        ) : (
          <>
            <p className="dash-range">
              {periodDate.format(new Date(`${result.data.from}T00:00:00+07:00`))} — {periodDate.format(new Date(`${result.data.to}T00:00:00+07:00`))}
            </p>

            <section className="dash-stat-grid" aria-label="Ringkasan arus operasi">
              <StatCard
                label="Uang masuk"
                value={result.data.totalIncomeRupiah}
                note="Pembayaran pelanggan"
                delta={result.data.comparison.incomePercent}
                positiveIsGood
                tone="#24462c"
                points={result.data.points.map((point) => point.incomeRupiah)}
                icon={<IconWallet/>}
              />
              <StatCard
                label="Pengeluaran usaha"
                value={result.data.totalExpenseRupiah}
                note="Biaya yang tercatat"
                delta={result.data.comparison.expensePercent}
                positiveIsGood={false}
                tone="#d89b35"
                points={result.data.points.map((point) => point.expenseRupiah)}
                icon={<IconReceipt/>}
              />
              <StatCard
                label="Arus kas operasi"
                value={result.data.netCashflowRupiah}
                note="Uang masuk − pengeluaran"
                delta={result.data.comparison.netCashflowPercent}
                positiveIsGood
                tone={result.data.netCashflowRupiah < 0 ? "#b44e37" : "#3f6b48"}
                points={result.data.points.map((point) => point.incomeRupiah - point.expenseRupiah)}
                icon={<IconTrend/>}
              />
              <StatCard
                label="Estimasi laba bersih"
                value={result.data.estimatedNetProfitRupiah}
                note="Penjualan bersih − pengeluaran"
                delta={result.data.comparison.profitPercent}
                positiveIsGood
                tone="#526e57"
                points={result.data.points.map((point) => point.salesRupiah - point.expenseRupiah)}
                icon={<IconCoins/>}
              />
            </section>

            <section className="dash-chart-grid">
              <article className="dash-card dash-panel">
                <header className="dash-panel-head">
                  <div><h2>Tren arus kas</h2><span>Uang masuk vs pengeluaran per hari</span></div>
                  <div className="dash-legend" aria-label="Legenda diagram">
                    <span><i className="legend-income"/>Uang masuk</span>
                    <span><i className="legend-expense"/>Pengeluaran</span>
                  </div>
                </header>
                <CashflowBars points={result.data.points}/>
              </article>
              <article className="dash-card dash-panel">
                <header className="dash-panel-head">
                  <div><h2>Komposisi pengeluaran</h2><span>Periode ini</span></div>
                </header>
                <ExpenseDonut items={result.data.expenseBreakdown}/>
              </article>
            </section>

            <section className="dash-indicator-grid" aria-label="Indikator operasional">
              <Link className="dash-card dash-indicator" href="/penjualan">
                <span className="dash-icon"><IconClock/></span>
                <span className="dash-indicator-body"><span>Piutang berjalan</span><strong>{rupiah(result.data.totalReceivablesRupiah)}</strong></span>
              </Link>
              <Link className="dash-card dash-indicator" href="/penjualan">
                <span className="dash-icon" style={{ background: "var(--am-error-bg)", color: "var(--am-error-fg)" }}><IconAlert/></span>
                <span className="dash-indicator-body"><span>Invoice terlambat</span><strong>{result.data.actionCounts.overdue}</strong></span>
              </Link>
              <Link className="dash-card dash-indicator" href="/peti">
                <span className="dash-icon"><IconBox/></span>
                <span className="dash-indicator-body"><span>Peti belum kembali</span><strong>{result.data.actionCounts.crate}</strong></span>
              </Link>
            </section>

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
              <Link href={`/laporan?from=${result.data.from}&to=${result.data.to}`}>
                <span>LAPORAN PERIODE</span>
                <strong>Buka laporan lengkap</strong>
                <small>Unduh CSV dari sumber angka yang sama.</small>
              </Link>
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

function StatCard({ label, value, note, delta, positiveIsGood, tone, points, icon }: {
  label: string;
  value: number;
  note: string;
  delta: number | null;
  positiveIsGood: boolean;
  tone: string;
  points: number[];
  icon: React.ReactNode;
}) {
  return (
    <article className="dash-card dash-stat">
      <div className="dash-stat-head">
        <span>{label}</span>
        <span className="dash-icon">{icon}</span>
      </div>
      <div className="dash-stat-value">
        <strong className={value < 0 ? "negative" : ""}>{rupiah(value)}</strong>
        <DeltaBadge value={delta} positiveIsGood={positiveIsGood}/>
      </div>
      <div className="dash-stat-foot">
        <small>{note}</small>
        <Sparkline points={points} tone={tone}/>
      </div>
    </article>
  );
}

function IconWallet() { return icon(<><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v14H6.5A2.5 2.5 0 0 1 4 16.5Z"/><path d="M4 7.5V17M15 12h2"/></>); }
function IconReceipt() { return icon(<><path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z"/><path d="M9 8h6M9 12h6"/></>); }
function IconTrend() { return icon(<><path d="M4 20V6M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/></>); }
function IconCoins() { return icon(<><ellipse cx="12" cy="7" rx="6.5" ry="3"/><path d="M5.5 7v5c0 1.7 2.9 3 6.5 3s6.5-1.3 6.5-3V7"/><path d="M5.5 12v5c0 1.7 2.9 3 6.5 3s6.5-1.3 6.5-3v-5"/></>); }
function IconClock() { return icon(<><circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/></>); }
function IconAlert() { return icon(<><path d="M12 4 3 19h18Z"/><path d="M12 10v4M12 17h.01"/></>); }
function IconBox() { return icon(<><path d="M3.5 8 12 3.5 20.5 8v8L12 20.5 3.5 16Z"/><path d="M3.5 8 12 12.5 20.5 8M12 12.5v8"/></>); }

function icon(children: React.ReactNode) {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}
