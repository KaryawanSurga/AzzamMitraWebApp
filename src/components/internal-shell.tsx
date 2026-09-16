import Link from "next/link";
import { logout } from "@/app/auth/actions";

export function InternalShell({ children, ownerName }: { children: React.ReactNode; ownerName: string }) {
  return <div className="app-shell"><aside className="sidebar"><Link className="brand" href="/dashboard">AZZAM MITRA</Link><nav aria-label="Navigasi utama"><Link href="/dashboard">Dashboard</Link><Link href="/penjualan">Penjualan</Link><Link href="/pelanggan">Pelanggan</Link></nav><div className="sidebar-user"><span>{ownerName}</span><form action={logout}><button className="button-quiet" type="submit">Keluar</button></form></div></aside><div className="app-content">{children}</div><nav className="bottom-nav" aria-label="Navigasi mobile"><Link href="/dashboard">Dashboard</Link><Link href="/penjualan">Penjualan</Link><Link href="/pelanggan">Pelanggan</Link></nav></div>;
}
