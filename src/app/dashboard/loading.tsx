export default function Loading() {
  return (
    <main className="page dashboard-page skeleton-page" aria-busy="true" aria-label="Memuat dashboard">
      <div className="skeleton heading"/>
      <div className="skeleton search-bar"/>
      <section className="dashboard-skeleton-grid" aria-hidden="true">
        {[1, 2, 3, 4].map((item) => <div className="skeleton dashboard-stat-skeleton" key={item}/>) }
      </section>
      <section className="dashboard-skeleton-charts" aria-hidden="true">
        <div className="skeleton dashboard-chart-skeleton"/>
        <div className="skeleton dashboard-chart-skeleton"/>
      </section>
    </main>
  );
}
