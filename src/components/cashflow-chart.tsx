import type { CashflowPoint } from "@/domain/reports";
import { rupiah } from "./ui";

const compactRupiah = new Intl.NumberFormat("id-ID", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const shortDate = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Jakarta",
});

export function CashflowChart({ points }: { points: CashflowPoint[] }) {
  const width = 760;
  const height = 280;
  const padding = { top: 24, right: 20, bottom: 46, left: 76 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const highest = Math.max(1, ...points.flatMap((point) => [point.incomeRupiah, point.expenseRupiah]));
  const stepX = points.length > 1 ? plotWidth / (points.length - 1) : plotWidth;
  const incomeCoordinates = points.map((point, index) => ({
    x: padding.left + index * stepX,
    y: padding.top + plotHeight - (point.incomeRupiah / highest) * plotHeight,
  }));
  const expenseCoordinates = points.map((point, index) => ({
    x: padding.left + index * stepX,
    y: padding.top + plotHeight - (point.expenseRupiah / highest) * plotHeight,
  }));
  const incomePath = incomeCoordinates.map(({ x, y }, index) => `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const expensePath = expenseCoordinates.map(({ x, y }, index) => `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const areaPath = incomeCoordinates.length
    ? `${incomePath} L${incomeCoordinates.at(-1)!.x.toFixed(2)},${padding.top + plotHeight} L${padding.left},${padding.top + plotHeight} Z`
    : "";
  const labelIndexes = new Set(points.length <= 10 ? points.map((_, index) => index) : [0, points.length - 1]);
  if (points.length > 10) {
    for (let index = 1; index < 4; index += 1) {
      labelIndexes.add(Math.round((points.length - 1) * index / 4));
    }
  }
  const hasActivity = points.some((point) => point.incomeRupiah > 0 || point.expenseRupiah > 0);

  return (
    <section className="cashflow-chart-card" aria-labelledby="cashflow-chart-title">
      <header className="chart-header">
        <div>
          <p className="chart-kicker">ARUS OPERASI</p>
          <h2 id="cashflow-chart-title">Uang masuk vs pengeluaran</h2>
          <p>Pembayaran pelanggan dibanding biaya usaha per hari.</p>
        </div>
        <div className="chart-legend" aria-label="Legenda diagram">
          <span><i className="legend-income"/>Uang masuk</span>
          <span><i className="legend-expense"/>Pengeluaran</span>
        </div>
      </header>

      <div className="chart-plot">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Diagram uang masuk dan pengeluaran harian">
          <title>Uang masuk dan pengeluaran harian</title>
          <desc>Garis kuning menunjukkan pembayaran pelanggan. Garis jingga menunjukkan pengeluaran usaha.</desc>
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padding.top + plotHeight - ratio * plotHeight;
            return (
              <g key={ratio}>
                <line className="chart-grid-line" x1={padding.left} x2={width - padding.right} y1={y} y2={y}/>
                <text className="chart-axis-label" x={padding.left - 10} y={y + 5} textAnchor="end">
                  {compactRupiah.format(highest * ratio)}
                </text>
              </g>
            );
          })}
          {points.map((point, index) => labelIndexes.has(index) && (
            <text
              className="chart-axis-label"
              x={padding.left + index * stepX}
              y={height - 10}
              textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}
              key={point.date}
            >
              {shortDate.format(new Date(`${point.date}T00:00:00+07:00`))}
            </text>
          ))}
          {areaPath && <path className="chart-income-area" d={areaPath}/>} 
          {incomePath && <path className="chart-income-line" d={incomePath}/>} 
          {expensePath && <path className="chart-expense-line" d={expensePath}/>} 
          {points.length <= 7 && incomeCoordinates.map(({ x, y }, index) => (
            <circle className="chart-income-dot" cx={x} cy={y} r="4" key={`income-${points[index].date}`}/>
          ))}
          {points.length <= 7 && expenseCoordinates.map(({ x, y }, index) => (
            <circle className="chart-expense-dot" cx={x} cy={y} r="4" key={`expense-${points[index].date}`}/>
          ))}
        </svg>
        {!hasActivity && <p className="chart-empty">Belum ada pembayaran atau pengeluaran pada periode ini.</p>}
      </div>

      <p className="chart-note">Modal masuk dan prive tidak dihitung dalam diagram operasional ini.</p>
      <table className="sr-only">
        <caption>Data uang masuk dan pengeluaran harian</caption>
        <thead><tr><th>Tanggal</th><th>Uang masuk</th><th>Pengeluaran</th></tr></thead>
        <tbody>{points.map((point) => (
          <tr key={point.date}>
            <td>{point.date}</td>
            <td>{rupiah(point.incomeRupiah)}</td>
            <td>{rupiah(point.expenseRupiah)}</td>
          </tr>
        ))}</tbody>
      </table>
    </section>
  );
}
