"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="standalone-state" role="alert">
      <h1>Modal dan prive gagal dimuat</h1>
      <p>Periksa koneksi lalu coba kembali. Tidak ada transaksi yang dibuat ulang otomatis.</p>
      <button onClick={reset}>Coba lagi</button>
    </main>
  );
}
