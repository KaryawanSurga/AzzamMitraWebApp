"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="standalone-state" role="alert">
      <h1>Laporan gagal dimuat</h1>
      <p>Data Anda tetap aman. Periksa koneksi lalu coba kembali.</p>
      <button onClick={reset}>Coba lagi</button>
    </main>
  );
}
