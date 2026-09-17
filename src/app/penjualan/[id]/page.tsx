import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSaleAction, getSaleHistoryAction } from "@/app/actions/f2";
import { getSaleOperationsAction } from "@/app/actions/f3";
import { DeliveryPanel } from "@/components/delivery-panel";
import { InternalShell } from "@/components/internal-shell";
import { PaymentForm } from "@/components/payment-form";
import { SaleCorrectionPanel } from "@/components/sale-correction-panel";
import { ErrorState, PageHeader, PaymentBadge, formatCrate, formatFinanceDate, formatItemQuantity, rupiah, saleActionLabels } from "@/components/ui";
import { adjustmentTypeLabels, isCancellableStatus } from "@/domain/adjustments";
import { sumCrateMilli } from "@/domain/crates";
import { getCurrentOwner } from "@/lib/supabase/owner";

const methodLabels = { cash: "Tunai", transfer: "Transfer", other: "Lainnya" } as const;

export default async function SaleDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const owner = await getCurrentOwner();
  if (!owner) redirect("/login?next=/penjualan");
  const { id } = await params;
  const result = await getSaleAction({ id });
  if (!result.ok && result.error.code === "not_found") notFound();
  const created = (await searchParams).created === "1";
  const [operations, history] = await Promise.all([getSaleOperationsAction({ saleId: id }), getSaleHistoryAction({ id })]);

  return (
    <InternalShell ownerName={owner.display_name}>
      <main className="page">
        {!result.ok ? <ErrorState {...result.error} retryHref={`/penjualan/${id}`}/> : <>
          {created && <p className="notice success" role="status">Penjualan berhasil disimpan.</p>}
          {result.data.status === "cancelled" && <p className="notice error" role="status">Invoice dibatalkan{result.data.cancelledAt ? ` pada ${formatFinanceDate(result.data.cancelledAt)}` : ""}. Nomor invoice tetap tersimpan dan tidak dipakai ulang.</p>}
          <PageHeader
            title={result.data.invoiceNumber}
            description={`${result.data.customerName} · ${result.data.transactionDate}`}
            action={<div className="invoice-actions">{result.data.status === "cancelled" ? <span className="status status-cancelled">Dibatalkan</span> : <PaymentBadge status={result.data.paymentStatus}/>}<Link className="button-secondary" href={`/penjualan/${id}/struk`}>Buka struk</Link></div>}
          />
          <section className="invoice-grid">
            <div className="invoice-main">
              <h2>Item</h2>
              {result.data.items.map((item) => (
                <div className="invoice-item" key={item.id}>
                  <div><strong>{item.description}</strong><span>{item.pricingBasis === "crate" ? `${formatItemQuantity(item.crateQuantity)} peti` : `${formatItemQuantity(item.weightKg)} kg`} × {rupiah(item.unitPriceRupiah)}</span></div>
                  <strong>{rupiah(item.subtotalRupiah)}</strong>
                </div>
              ))}
              {result.data.notes && <div className="invoice-notes"><h3>Catatan</h3><p>{result.data.notes}</p></div>}
            </div>
            <aside className="summary">
              <h2>Ringkasan invoice</h2>
              <Line label="Subtotal" value={result.data.subtotalRupiah}/>
              <Line label="Diskon" value={-result.data.discountRupiah}/>
              <Line label="Biaya" value={result.data.feeRupiah}/>
              <Line label="Total" value={result.data.totalRupiah} strong/>
              <Line label="Dibayar" value={result.data.paidRupiah}/>
              <Line label="Sisa" value={result.data.remainingRupiah} strong/>
              {result.data.dueDate && <p>Jatuh tempo: <strong>{result.data.dueDate}</strong></p>}
              <p>Peti pada penjualan ini: <strong>{formatCrate(sumCrateMilli(result.data.items))}</strong></p>
            </aside>
          </section>

          {!operations.ok ? <ErrorState {...operations.error} retryHref={`/penjualan/${id}`}/> : <>
            <section className="operations-section">
              <h2>Pembayaran</h2>
              {operations.data.payments.length === 0
                ? <p className="delivery-meta">Belum ada pembayaran tercatat.</p>
                : <div className="data-list">{operations.data.payments.map((payment) => (
                    <div className="data-row" key={payment.id}>
                      <div><strong>{rupiah(payment.amountRupiah)}</strong><span>{methodLabels[payment.method]} · {payment.paidAt}</span></div>
                      <span>{payment.paymentNumber}</span>
                    </div>
                  ))}</div>}
              {result.data.status !== "cancelled" && <PaymentForm saleId={id} remainingRupiah={operations.data.billing.totalRupiah - operations.data.billing.paidRupiah}/>}
            </section>

            {result.data.status !== "cancelled" && <DeliveryPanel saleId={id} saleCrateQuantityMilli={sumCrateMilli(result.data.items)} deliveries={operations.data.deliveries}/>}
          </>}

          {isCancellableStatus(result.data.status) && <SaleCorrectionPanel sale={{ id: result.data.id, invoiceNumber: result.data.invoiceNumber, subtotalRupiah: result.data.subtotalRupiah, discountRupiah: result.data.discountRupiah, feeRupiah: result.data.feeRupiah, totalRupiah: result.data.totalRupiah, paidRupiah: result.data.paidRupiah, dueDate: result.data.dueDate, notes: result.data.notes }}/>}

          {!history.ok ? <p className="notice error" role="alert">{history.error.message}</p> : (history.data.adjustments.length > 0 || history.data.auditEvents.length > 0) && (
            <section className="history-section" aria-labelledby="history-title">
              <h2 id="history-title">Riwayat koreksi &amp; audit</h2>
              {history.data.adjustments.length > 0 && <div className="data-list">{history.data.adjustments.map((adjustment) => (
                <div className="data-row" key={adjustment.id}>
                  <div><strong>{adjustmentTypeLabels[adjustment.type]}</strong><span>{adjustment.reason}</span></div>
                  <div className="row-end"><strong>{rupiah(adjustment.amountRupiah)}</strong><span>{formatFinanceDate(adjustment.occurredAt)} · {adjustment.actorName}</span></div>
                </div>
              ))}</div>}
              {history.data.auditEvents.length > 0 && <ol className="audit-trail">{history.data.auditEvents.map((event) => (
                <li key={event.id}>
                  <strong>{saleActionLabels[event.action] ?? event.action}</strong>
                  <span>{formatFinanceDate(event.occurredAt)} · {event.actorName}</span>
                  {event.reason && <small>{event.reason}</small>}
                </li>
              ))}</ol>}
            </section>
          )}

          <Link className="text-link" href="/penjualan">Kembali ke daftar penjualan</Link>
        </>}
      </main>
    </InternalShell>
  );
}

function Line({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return <div className={strong ? "money strong" : "money"}><span>{label}</span><span>{rupiah(value)}</span></div>;
}
