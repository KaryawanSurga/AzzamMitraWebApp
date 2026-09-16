import Link from "next/link";
export default function NotFound() {
  return <main className="standalone-state"><h1>Halaman peti tidak ditemukan</h1><p>Alamat tidak valid atau data sudah berubah.</p><Link className="button" href="/peti">Kembali ke peti</Link></main>;
}
