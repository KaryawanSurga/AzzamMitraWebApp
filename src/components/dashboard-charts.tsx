import type { CashflowPoint, ExpenseBreakdownItem } from "@/domain/reports";
import { expenseCategoryLabels } from "@/domain/finance";

const compactRupiah = new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 });
const rupiah = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

const donutPalette = ["#24462c", "#d89b35", "#526e57", "#a9b8a4", "#879187"];

function niceMaximum(value: number): number {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of axisSteps) {
    const candidate = step * magnitude;
    if (candidate >= value) return candidate;
  }
  return 10 * magnitude;
}

const axisRatios = [1, 0.75, 0.5, 0.25, 0] as const;
const axisSteps = [1, 1.2, 1.6, 2, 2.4, 3.2, 4, 4.8, 6.4, 8, 10] as const;

function groupWeekly(points: CashflowPoint[]): CashflowPoint[] {
  if (points.length <= 14) return points;
  const groups: CashflowPoint[] = [];
  for (let end = points.length; end > 0; end -= 7) {
    const chunk = points.slice(Math.max(0, end - 7), end);
    groups.unshift({
      date: chunk[0].date,
      incomeRupiah: chunk.reduce((sum, point) => sum + point.incomeRupiah, 0),
      expenseRupiah: chunk.reduce((sum, point) => sum + point.expenseRupiah, 0),
      salesRupiah: chunk.reduce((sum, point) => sum + point.salesRupiah, 0),
    });
  }
  return groups;
}

export function CashflowBars({ points }: { points: CashflowPoint[] }) {
  const series = groupWeekly(points);
  const weekly = series.length !== points.length;
  const labelEvery = series.length <= 8 ? 1 : 2;
  const maximum = niceMaximum(Math.max(1, ...series.flatMap((point) => [point.incomeRupiah, point.expenseRupiah])));

  return (
    <div className="chart-scroll">
      <div className="chart-frame">
        <div className="chart-y-axis" aria-hidden="true">
          {axisRatios.map((ratio) => (
            <span key={ratio}>{ratio === 0 ? "0" : compactRupiah.format(maximum * ratio)}</span>
          ))}
        </div>
        <div className="chart-plot-area">
          <div className="chart-grid-lines" aria-hidden="true"/>
          <div className="chart-bars" role="img" aria-label={`Diagram batang uang masuk dan pengeluaran ${weekly ? "per minggu" : "harian"}`}>
            {series.map((point, index) => (
              <div className="chart-bar-group" key={point.date}>
                <span className="chart-bar income" style={{ height: `${((point.incomeRupiah / maximum) * 100).toFixed(2)}%` }} title={`Masuk ${rupiah(point.incomeRupiah)}`}/>
                <span className="chart-bar expense" style={{ height: `${((point.expenseRupiah / maximum) * 100).toFixed(2)}%` }} title={`Keluar ${rupiah(point.expenseRupiah)}`}/>
                <span className="chart-bar-label">{index % labelEvery === 0 || index === series.length - 1 ? formatDay(point.date) : ""}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDay(date: string) {
  const [, month, day] = date.split("-");
  return `${Number(day)}/${Number(month)}`;
}

export function ExpenseDonut({ items }: { items: ExpenseBreakdownItem[] }) {
  if (items.length === 0) return <p className="chart-empty-note">Belum ada pengeluaran pada periode ini.</p>;

  const top = items.slice(0, 4);
  const rest = items.slice(4).reduce((sum, item) => sum + item.amountRupiah, 0);
  const total = items.reduce((sum, item) => sum + item.amountRupiah, 0);
  const segments = [
    ...top.map((item, index) => ({ label: expenseCategoryLabels[item.category], amountRupiah: item.amountRupiah, color: donutPalette[index] })),
    ...(rest > 0 ? [{ label: "Lainnya", amountRupiah: rest, color: donutPalette[4] }] : []),
  ];
  let cursor = 0;
  const gradient = segments.map((segment) => {
    const start = cursor;
    cursor += (segment.amountRupiah / total) * 100;
    return `${segment.color} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
  }).join(", ");

  return (
    <div className="donut-layout">
      <div className="donut" style={{ background: `conic-gradient(${gradient})` }} role="img" aria-label={`Komposisi pengeluaran: ${segments.map((segment) => `${segment.label} ${Math.round((segment.amountRupiah / total) * 100)} persen`).join(", ")}`}>
        <div className="donut-center"><strong>{compactRupiah.format(total)}</strong><span>total biaya</span></div>
      </div>
      <ul className="donut-legend">
        {segments.map((segment) => (
          <li key={segment.label}>
            <i style={{ background: segment.color }} aria-hidden="true"/>
            <span>{segment.label}<small>{rupiah(segment.amountRupiah)}</small></span>
            <b>{Math.round((segment.amountRupiah / total) * 100)}%</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Sparkline({ points, tone }: { points: number[]; tone: string }) {
  const width = 150;
  const height = 44;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const step = width / Math.max(1, points.length - 1);
  const y = (value: number) => height - 6 - ((value - min) / (max - min || 1)) * (height - 16);
  const line = points.map((value, index) => `${index === 0 ? "M" : "L"}${(index * step).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
  const gradientId = `dashboard-spark-${tone.replace("#", "")}`;
  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tone} stopOpacity="0.3"/>
          <stop offset="100%" stopColor={tone} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={`${line} L${width},${height} L0,${height} Z`} fill={`url(#${gradientId})`}/>
      <path d={line} fill="none" stroke={tone} strokeWidth="2.4" strokeLinecap="round"/>
    </svg>
  );
}

export function DeltaBadge({ value, positiveIsGood }: { value: number | null; positiveIsGood: boolean }) {
  if (value === null) return <span className="delta-badge neutral">Baru</span>;
  const up = value >= 0;
  const good = up === positiveIsGood;
  return (
    <span className={`delta-badge ${good ? "good" : "bad"}`}>
      {up ? "↑" : "↓"} {Math.abs(value).toFixed(1).replace(".", ",")}%
    </span>
  );
}
