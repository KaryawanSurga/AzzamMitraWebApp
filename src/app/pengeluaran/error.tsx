"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="standalone-state" role="alert">
      <h1>Pengeluaran gagal dimuat</h1>
      <p>Data yang sudah diisi tetap aman. Periksa koneksi lalu coba kembali.</p>
      <button onClick={reset}>Coba lagi</button>
    </main>
  );
}
