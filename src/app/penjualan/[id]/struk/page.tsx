import { notFound, redirect } from "next/navigation";
import { getSaleAction } from "@/app/actions/f2";
import { BrandMark } from "@/components/brand-mark";
import { ReceiptPrintControls } from "@/components/receipt-print-controls";
import { ErrorState, formatItemQuantity, paymentLabels, paymentMethodLabels, rupiah } from "@/components/ui";
import { getCurrentOwner } from "@/lib/supabase/owner";

const receiptDate = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Jakarta",
});

export default async function ReceiptPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paper?: string }>;
}) {
  const { id } = await params;
  const owner = await getCurrentOwner();
  if (!owner) redirect(`/login?next=/penjualan/${id}/struk`);
  const result = await getSaleAction({ id });
  if (!result.ok && result.error.code === "not_found") notFound();
  const paper = (await searchParams).paper === "thermal" ? "thermal" : "a4";

  if (!result.ok) {
    return <main className="receipt-error"><ErrorState {...result.error} retryHref={`/penjualan/${id}/struk`}/></main>;
  }

  return (<>
    <style>{`@page { size: ${paper === "thermal" ? "80mm 297mm" : "A4"}; margin: ${paper === "thermal" ? "4mm" : "12mm"}; }`}</style>
    <main className={`receipt-page receipt-${paper}`}>
      <ReceiptPrintControls saleId={id} paper={paper}/>
      <article className={`receipt-sheet ${paper}`}>
        <header className="receipt-brand">
          <BrandMark size={paper === "thermal" ? 28 : 38}/>
          <div><strong>AZZAM MITRA</strong><span>Distributor Telur</span></div>
          <p>STRUK PENJUALAN</p>
        </header>

        <section className="receipt-meta">
          <div><span>Nomor invoice</span><strong>{result.data.invoiceNumber}</strong></div>
          <div><span>Tanggal transaksi</span><strong>{formatDate(result.data.transactionDate)}</strong></div>
          <div><span>Pelanggan</span><strong>{result.data.customerName}</strong></div>
          <div><span>Nomor pelanggan</span><strong>{result.data.customerNumber}</strong></div>
        </section>

        <section className="receipt-items" aria-labelledby="receipt-items-title">
          <h1 id="receipt-items-title">Rincian pembelian</h1>
          <table>
            <thead><tr><th>Item</th><th>Perhitungan</th><th>Subtotal</th></tr></thead>
            <tbody>{result.data.items.map((item) => (
              <tr key={item.id}>
                <td>{item.description}</td>
                <td>{item.pricingBasis === "crate" ? `${formatItemQuantity(item.crateQuantity)} peti` : `${formatItemQuantity(item.weightKg)} kg`} × {rupiah(item.unitPriceRupiah)}</td>
                <td>{rupiah(item.subtotalRupiah)}</td>
              </tr>
            ))}</tbody>
          </table>
        </section>

        <section className="receipt-financials">
          <div><span>Subtotal</span><strong>{rupiah(result.data.subtotalRupiah)}</strong></div>
          <div><span>Diskon</span><strong>− {rupiah(result.data.discountRupiah)}</strong></div>
          <div><span>Biaya</span><strong>{rupiah(result.data.feeRupiah)}</strong></div>
          <div className="receipt-total"><span>Total</span><strong>{rupiah(result.data.totalRupiah)}</strong></div>
          <div><span>Sudah dibayar</span><strong>{rupiah(result.data.paidRupiah)}</strong></div>
          <div><span>Sisa piutang</span><strong>{rupiah(result.data.remainingRupiah)}</strong></div>
        </section>

        <section className="receipt-payment-summary">
          <div>
            <span>Status pembayaran</span>
            <strong>{paymentLabels[result.data.paymentStatus]}</strong>
          </div>
          {result.data.dueDate && <div><span>Jatuh tempo</span><strong>{formatDate(result.data.dueDate)}</strong></div>}
        </section>

        {result.data.payments.length > 0 && <section className="receipt-payments">
          <h2>Riwayat pembayaran</h2>
          {result.data.payments.map((payment) => (
            <div key={payment.id}>
              <span>{formatDate(payment.paidAt)} · {paymentMethodLabels[payment.method]}</span>
              <strong>{rupiah(payment.amountRupiah)}</strong>
            </div>
          ))}
        </section>}

        {result.data.notes && <section className="receipt-notes"><strong>Catatan</strong><p>{result.data.notes}</p></section>}
        <footer>
          <p>Terima kasih sudah berbelanja di Azzam Mitra.</p>
          <span>Struk dibuat dari data transaksi yang tercatat di sistem.</span>
        </footer>
      </article>
    </main>
  </>);
}

function formatDate(value: string) {
  return receiptDate.format(new Date(`${value.slice(0, 10)}T00:00:00+07:00`));
}
