import Link from "next/link";
import { logout } from "@/app/auth/actions";
import { BrandMark } from "@/components/brand-mark";

const navigation = [
  ["/dashboard", "Dashboard"],
  ["/penjualan", "Penjualan"],
  ["/pelanggan", "Pelanggan"],
  ["/peti", "Peti"],
] as const;

export function InternalShell({ children, ownerName }: { children: React.ReactNode; ownerName: string }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/dashboard">
          <BrandMark size={26} tone="light" />
          <span>
            <strong>AZZAM MITRA</strong>
            <small>Distributor Telur</small>
          </span>
        </Link>
        <nav aria-label="Navigasi utama">
          {navigation.map(([href, label]) => <Link href={href} key={href}>{label}</Link>)}
        </nav>
        <div className="sidebar-user">
          <span>{ownerName}</span>
          <form action={logout}>
            <button className="button-quiet" type="submit">Keluar</button>
          </form>
        </div>
      </aside>
      <div className="app-content">{children}</div>
      <nav className="bottom-nav" aria-label="Navigasi mobile">
        {navigation.map(([href, label]) => <Link href={href} key={href}>{label}</Link>)}
      </nav>
    </div>
  );
}
