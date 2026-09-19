import type { Metadata } from "next";
import { BrandMark } from "@/components/brand-mark";
import styles from "./prototype.module.css";

export const metadata: Metadata = {
  title: "Prototype desain — Azzam Mitra",
  robots: { index: false, follow: false },
};

const rupiahCompact = new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 });
const rupiah = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

const metrics = [
  { label: "Penjualan bersih", value: 12_450_000, delta: "+12,5%", up: true, note: "7 hari terakhir", tone: "#24462c", points: [3.2, 4.1, 3.6, 5.2, 4.8, 6.4, 7.1], icon: IconWallet },
  { label: "Uang masuk", value: 9_850_000, delta: "+8,2%", up: true, note: "Pembayaran pelanggan", tone: "#d89b35", points: [2.4, 3.1, 2.8, 3.9, 4.4, 4.1, 5.2], icon: IconCoins },
  { label: "Piutang berjalan", value: 2_600_000, delta: "-4,1%", up: false, note: "Sisa tagihan pelanggan", tone: "#b44e37", points: [4.4, 4.1, 4.6, 3.9, 3.6, 3.2, 2.9], icon: IconClock },
  { label: "Rata-rata / invoice", value: 648_000, delta: "+3,1%", up: true, note: "42 invoice periode ini", tone: "#526e57", points: [3.1, 3.3, 3.2, 3.6, 3.5, 3.8, 4.1], icon: IconCart },
];

const weekdays = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const dailySales = [1.2, 2.4, 1.8, 3.1, 2.6, 4.2, 2.7];
const donut = [
  { label: "Penjualan per peti", value: 7_221_000, share: "58%", color: "#24462c" },
  { label: "Penjualan per kg", value: 3_984_000, share: "32%", color: "#d89b35" },
  { label: "Lain-lain", value: 1_245_000, share: "10%", color: "#a9b8a4" },
];

const statusStyles = {
  paid: { label: "Lunas", className: styles.pillPaid },
  partial: { label: "DP / sebagian", className: styles.pillPartial },
  unpaid: { label: "Belum dibayar", className: styles.pillUnpaid },
  overdue: { label: "Terlambat", className: styles.pillOverdue },
} as const;

const orders: Array<{ invoice: string; customer: string; item: string; amount: number; date: string; method: string; status: keyof typeof statusStyles }> = [
  { invoice: "INV-2026-0184", customer: "Budi Santoso", item: "Telur — 10 peti", amount: 1_500_000, date: "18 Sep 2026", method: "Transfer", status: "paid" },
  { invoice: "INV-2026-0183", customer: "Tania Pasar", item: "Telur — 103,5 kg", amount: 2_070_000, date: "18 Sep 2026", method: "Tunai", status: "partial" },
  { invoice: "INV-2026-0182", customer: "Warung Sari", item: "Telur — 8 peti", amount: 1_200_000, date: "17 Sep 2026", method: "Transfer", status: "overdue" },
  { invoice: "INV-2026-0181", customer: "Ibu Rina", item: "Telur — 12 peti", amount: 1_800_000, date: "17 Sep 2026", method: "Tunai", status: "paid" },
  { invoice: "INV-2026-0180", customer: "Kios Jaya", item: "Telur — 60 kg", amount: 1_560_000, date: "16 Sep 2026", method: "Transfer", status: "unpaid" },
  { invoice: "INV-2026-0179", customer: "Budi Santoso", item: "Telur — 6 peti", amount: 900_000, date: "16 Sep 2026", method: "Tunai", status: "paid" },
  { invoice: "INV-2026-0178", customer: "CV Berkah", item: "Telur — 20 peti", amount: 3_000_000, date: "15 Sep 2026", method: "Transfer", status: "partial" },
];

const filters = [
  { label: "Semua", count: 128, delta: "+12", active: true },
  { label: "Baru", count: 18, delta: "+4" },
  { label: "DP", count: 15, delta: "+2" },
  { label: "Lunas", count: 34, delta: "+9" },
  { label: "Terlambat", count: 7, delta: "-3" },
];

export default function PrototypePage() {
  return (
    <div className={styles.page}>
      <p className={styles.banner}><strong>Prototype desain</strong> Data contoh, tidak terhubung database maupun memengaruhi data asli.</p>
      <div className={styles.shell}>
        <aside className={styles.sidebar} aria-label="Navigasi prototype">
          <span className={styles.brandTile}><BrandMark size={22} tone="light" /></span>
          <nav>
            <ul className={styles.navList}>
              {navItems.map(({ label, icon: Icon, active }) => (
                <li key={label}>
                  <button type="button" className={`${styles.navItem} ${active ? styles.navItemActive : ""}`} aria-label={label} aria-current={active ? "page" : undefined}>
                    <Icon />
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div className={styles.navBottom}>
            <button type="button" className={styles.navItem} aria-label="Pengaturan"><IconSettings /></button>
            <button type="button" className={styles.navItem} aria-label="Keluar"><IconLogout /></button>
          </div>
        </aside>

        <div className={styles.content}>
          <header className={styles.topbar}>
            <div className={styles.greeting}>
              <h1>Halo, Owner Azzam!</h1>
              <p>Pantau penjualan, pembayaran, dan peti pelanggan dalam satu layar.</p>
            </div>
            <div className={styles.topActions}>
              <span className={styles.periodChip}>7 hari terakhir <IconChevron /></span>
              <button type="button" className={styles.iconButton} aria-label="Notifikasi"><IconBell /></button>
              <span className={styles.avatar} aria-hidden="true">OA</span>
            </div>
          </header>

          <section className={styles.metricGrid} aria-label="Ringkasan utama">
            {metrics.map(({ label, value, delta, up, note, tone, points, icon: Icon }) => (
              <article className={styles.card} key={label}>
                <div className={styles.metricCard}>
                  <div className={styles.metricHead}>
                    <span className={styles.metricLabel}>{label}</span>
                    <span className={styles.metricIcon}><Icon /></span>
                  </div>
                  <div className={styles.metricValue}>
                    <strong>{rupiah(value)}</strong>
                    <span className={`${styles.delta} ${up ? styles.deltaUp : styles.deltaDown}`}>{up ? "↑" : "↓"} {delta}</span>
                  </div>
                  <div className={styles.metricFoot}>
                    <small>{note}</small>
                    <Sparkline points={points} tone={tone} />
                  </div>
                </div>
              </article>
            ))}
          </section>

          <section className={styles.chartGrid}>
            <article className={`${styles.card} ${styles.panel}`}>
              <header className={styles.panelHead}>
                <h2>Perkembangan penjualan</h2>
                <span>7 hari terakhir</span>
              </header>
              <div className={styles.barsWrap}>
                <div className={styles.barsAxis} aria-hidden="true">
                  <span>6 jt</span><span>4 jt</span><span>2 jt</span><span>0</span>
                </div>
                <div className={styles.barsPlot}>
                  <div className={styles.barsGrid} aria-hidden="true" />
                  <div className={styles.bars} role="img" aria-label="Penjualan harian: Senin 1,2 juta hingga Minggu 2,7 juta rupiah">
                    {dailySales.map((value, index) => (
                      <div className={styles.barCol} key={weekdays[index]}>
                        <span className={`${styles.bar} ${value === Math.max(...dailySales) ? styles.barHighlight : ""}`} style={{ height: `${((value / 6) * 100).toFixed(1)}%` }} />
                      </div>
                    ))}
                  </div>
                  <div className={styles.barsLabels} aria-hidden="true">
                    {weekdays.map((day) => <span key={day}>{day}</span>)}
                  </div>
                </div>
              </div>
            </article>

            <article className={`${styles.card} ${styles.panel}`}>
              <header className={styles.panelHead}>
                <h2>Komposisi penjualan</h2>
                <span>Periode ini</span>
              </header>
              <div className={styles.donutWrap}>
                <div className={styles.donut} style={{ "--slice-1": "58%", "--slice-2": "90%", "--slice-3": "100%" } as React.CSSProperties} role="img" aria-label="Komposisi penjualan: 58 persen per peti, 32 persen per kilogram, 10 persen lain-lain">
                  <div className={styles.donutCenter}>
                    <strong>{rupiahCompact.format(12_450_000)}</strong>
                    <span>total</span>
                  </div>
                </div>
                <ul className={styles.legend}>
                  {donut.map(({ label, value, share, color }) => (
                    <li key={label}>
                      <i style={{ background: color }} aria-hidden="true" />
                      <span>{label}<small>{rupiah(value)}</small></span>
                      <b>{share}</b>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          </section>

          <section className={styles.statGrid} aria-label="Indikator operasional">
            <article className={`${styles.card} ${styles.statCard}`}>
              <span className={styles.statIcon} style={{ background: "var(--am-error-bg)", color: "var(--am-error-fg)" }}><IconAlert /></span>
              <div className={styles.statBody}>
                <span>Invoice terlambat</span>
                <div className={styles.statValue}><strong>3</strong><span className={`${styles.delta} ${styles.deltaDown}`}>↑ 2</span></div>
              </div>
            </article>
            <article className={`${styles.card} ${styles.statCard}`}>
              <span className={styles.statIcon} style={{ background: "var(--am-success-bg)", color: "var(--am-success-fg)" }}><IconCheck /></span>
              <div className={styles.statBody}>
                <span>Tingkat pelunasan</span>
                <div className={styles.statValue}><strong>92%</strong><span className={`${styles.delta} ${styles.deltaUp}`}>↑ 6%</span></div>
              </div>
            </article>
            <article className={`${styles.card} ${styles.statCard}`}>
              <span className={styles.statIcon} style={{ background: "var(--am-surface-sunken)", color: "var(--am-hijau-mitra)" }}><IconUsers /></span>
              <div className={styles.statBody}>
                <span>Pelanggan aktif</span>
                <div className={styles.statValue}><strong>24</strong><span className={`${styles.delta} ${styles.deltaUp}`}>↑ 4</span></div>
              </div>
            </article>
          </section>

          <section className={`${styles.card} ${styles.panel} ${styles.ordersPanel}`} aria-labelledby="orders-title">
            <header className={styles.ordersHead}>
              <h2 id="orders-title">Pesanan &amp; invoice</h2>
              <span className={styles.primaryButton}><IconPlus /> Invoice baru</span>
            </header>
            <div className={styles.filters}>
              {filters.map(({ label, count, delta, active }) => (
                <span key={label} className={`${styles.filterChip} ${active ? styles.filterActive : ""}`}>
                  <span>{label}</span>
                  <strong>{count}</strong>
                  <em>{delta} vs minggu lalu</em>
                </span>
              ))}
            </div>
            <div className={styles.toolbar}>
              <label className={styles.search}>
                <IconSearch />
                <input placeholder="Cari nomor invoice atau pelanggan" aria-label="Cari invoice atau pelanggan" />
              </label>
              <span className={styles.periodChip}>Urutkan: terbaru <IconChevron /></span>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>No invoice</th><th>Pelanggan</th><th>Item</th><th className={styles.amountCell}>Nominal</th><th>Tanggal</th><th>Metode</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.invoice}>
                      <td className={styles.invoiceCell} data-label="No invoice">{order.invoice}</td>
                      <td data-label="Pelanggan">{order.customer}</td>
                      <td data-label="Item">{order.item}</td>
                      <td className={styles.amountCell} data-label="Nominal">{rupiah(order.amount)}</td>
                      <td data-label="Tanggal">{order.date}</td>
                      <td data-label="Metode">{order.method}</td>
                      <td data-label="Status"><span className={`${styles.pill} ${statusStyles[order.status].className}`}>{statusStyles[order.status].label}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer className={styles.pagination}>
              <span>1–7 dari 54 invoice</span>
              <span className={styles.pager}>
                <span aria-hidden="true">‹</span>
                <span className={styles.pagerActive}>1</span>
                <span>2</span>
                <span>3</span>
                <span>…</span>
                <span>8</span>
                <span aria-hidden="true">›</span>
              </span>
            </footer>
          </section>
        </div>
      </div>
    </div>
  );
}

function Sparkline({ points, tone }: { points: number[]; tone: string }) {
  const width = 150;
  const height = 44;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const step = width / (points.length - 1);
  const y = (value: number) => height - 6 - ((value - min) / (max - min || 1)) * (height - 16);
  const line = points.map((value, index) => `${index === 0 ? "M" : "L"}${(index * step).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
  const gradientId = `prototype-spark-${tone.replace("#", "")}`;
  return (
    <svg className={styles.sparkline} viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tone} stopOpacity="0.3" />
          <stop offset="100%" stopColor={tone} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${width},${height} L0,${height} Z`} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke={tone} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

const navItems = [
  { label: "Ringkasan", icon: IconHome, active: true },
  { label: "Penjualan", icon: IconReceipt, active: false },
  { label: "Pelanggan", icon: IconUsers, active: false },
  { label: "Peti", icon: IconBox, active: false },
  { label: "Laporan", icon: IconChart, active: false },
];

type IconProps = { size?: number };

function iconPath(children: React.ReactNode, { size = 20 }: IconProps = {}) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

function IconHome(props: IconProps) { return iconPath(<><path d="M4 10.5 12 4l8 6.5" /><path d="M6 10v9h12v-9" /></>, props); }
function IconReceipt(props: IconProps) { return iconPath(<><path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z" /><path d="M9 8h6M9 12h6" /></>, props); }
function IconUsers(props: IconProps) { return iconPath(<><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5S14 16 14.6 19" /><path d="M16 5.6a3 3 0 0 1 0 5.6M18.5 19c-.3-1.8-1-3.1-2-4" /></>, props); }
function IconBox(props: IconProps) { return iconPath(<><path d="M3.5 8 12 3.5 20.5 8v8L12 20.5 3.5 16Z" /><path d="M3.5 8 12 12.5 20.5 8M12 12.5v8" /></>, props); }
function IconChart(props: IconProps) { return iconPath(<><path d="M4 20V6M4 20h16" /><path d="M8 16v-4M12 16V8M16 16v-6" /></>, props); }
function IconSettings(props: IconProps) { return iconPath(<><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l1.8-1.3-2-3.4-2.1.8a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.7a7 7 0 0 0-2 1.2l-2.1-.8-2 3.4 1.8 1.3A7 7 0 0 0 5 12" /></>, props); }
function IconLogout(props: IconProps) { return iconPath(<><path d="M10 4H5v16h5" /><path d="M14 8l4 4-4 4M18 12H9" /></>, props); }
function IconBell(props: IconProps) { return iconPath(<><path d="M6 16V10a6 6 0 0 1 12 0v6l1.5 2h-15Z" /><path d="M10 20a2 2 0 0 0 4 0" /></>, props); }
function IconChevron(props: IconProps) { return iconPath(<path d="m6 9 6 6 6-6" />, { size: props.size ?? 16 }); }
function IconSearch(props: IconProps) { return iconPath(<><circle cx="11" cy="11" r="6" /><path d="m20 20-3.5-3.5" /></>, { size: props.size ?? 18 }); }
function IconPlus(props: IconProps) { return iconPath(<path d="M12 5v14M5 12h14" />, { size: props.size ?? 16 }); }
function IconWallet(props: IconProps) { return iconPath(<><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v14H6.5A2.5 2.5 0 0 1 4 16.5Z" /><path d="M4 7.5V17M15 12h2" /></>, props); }
function IconCoins(props: IconProps) { return iconPath(<><ellipse cx="12" cy="7" rx="6.5" ry="3" /><path d="M5.5 7v5c0 1.7 2.9 3 6.5 3s6.5-1.3 6.5-3V7" /><path d="M5.5 12v5c0 1.7 2.9 3 6.5 3s6.5-1.3 6.5-3v-5" /></>, props); }
function IconClock(props: IconProps) { return iconPath(<><circle cx="12" cy="12" r="8" /><path d="M12 7.5V12l3 2" /></>, props); }
function IconCart(props: IconProps) { return iconPath(<><path d="M4 5h2l2.2 10.2A2 2 0 0 0 10.2 17h7.4a2 2 0 0 0 2-1.6L21 8H7" /><circle cx="10.5" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></>, props); }
function IconAlert(props: IconProps) { return iconPath(<><path d="M12 4 3 19h18Z" /><path d="M12 10v4M12 17h.01" /></>, props); }
function IconCheck(props: IconProps) { return iconPath(<path d="m5 12.5 4.5 4.5L19 7" />, props); }
