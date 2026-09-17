export default function Loading() {
  return (
    <main className="page wide skeleton-page" aria-busy="true" aria-label="Memuat laporan">
      <div className="skeleton heading"/>
      <div className="skeleton search-bar"/>
      <div className="skeleton report-summary-skeleton"/>
      {[1, 2, 3].map((item) => <div className="skeleton row" key={item}/>) }
    </main>
  );
}
