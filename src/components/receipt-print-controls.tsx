"use client";

import Link from "next/link";

export function ReceiptPrintControls({ saleId, paper }: { saleId: string; paper: "a4" | "thermal" }) {
  return (
    <nav className="receipt-toolbar no-print" aria-label="Kontrol struk">
      <Link className="text-link" href={`/penjualan/${saleId}`}>Kembali ke invoice</Link>
      <div className="receipt-paper-switch" aria-label="Ukuran kertas">
        <Link className={paper === "a4" ? "active" : ""} href={`/penjualan/${saleId}/struk?paper=a4`}>A4</Link>
        <Link className={paper === "thermal" ? "active" : ""} href={`/penjualan/${saleId}/struk?paper=thermal`}>Thermal 80 mm</Link>
      </div>
      <button type="button" onClick={() => window.print()}>Cetak / simpan PDF</button>
    </nav>
  );
}
