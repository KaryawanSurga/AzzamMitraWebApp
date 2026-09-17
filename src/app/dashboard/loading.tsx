export default function Loading() {
  return (
    <main className="page dashboard-page skeleton-page" aria-busy="true" aria-label="Memuat dashboard">
      <div className="skeleton heading"/>
      <div className="skeleton search-bar"/>
      <section className="metric-grid" aria-hidden="true">
        {[1, 2, 3].map((item) => <div className="skeleton metric-card" key={item}/>) }
      </section>
      <div className="skeleton dashboard-chart-skeleton"/>
    </main>
  );
}
