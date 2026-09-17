import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSaleAction } from "@/app/actions/f2";
import { getSaleOperationsAction } from "@/app/actions/f3";
import { DeliveryPanel } from "@/components/delivery-panel";
import { InternalShell } from "@/components/internal-shell";
import { PaymentForm } from "@/components/payment-form";
import { ErrorState, PageHeader, PaymentBadge, formatCrate, formatItemQuantity, rupiah } from "@/components/ui";
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
  const operations = await getSaleOperationsAction({ saleId: id });

  return (
    <InternalShell ownerName={owner.display_name}>
      <main className="page">
        {!result.ok ? <ErrorState {...result.error} retryHref={`/penjualan/${id}`}/> : <>
          {created && <p className="notice success" role="status">Penjualan berhasil disimpan.</p>}
          <PageHeader
            title={result.data.invoiceNumber}
            description={`${result.data.customerName} · ${result.data.transactionDate}`}
            action={<div className="invoice-actions"><PaymentBadge status={result.data.paymentStatus}/><Link className="button-secondary" href={`/penjualan/${id}/struk`}>Buka struk</Link></div>}
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
              <PaymentForm saleId={id} remainingRupiah={operations.data.billing.totalRupiah - operations.data.billing.paidRupiah}/>
            </section>

            <DeliveryPanel saleId={id} saleCrateQuantityMilli={sumCrateMilli(result.data.items)} deliveries={operations.data.deliveries}/>
          </>}

          <Link className="text-link" href="/penjualan">Kembali ke daftar penjualan</Link>
        </>}
      </main>
    </InternalShell>
  );
}

function Line({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return <div className={strong ? "money strong" : "money"}><span>{label}</span><span>{rupiah(value)}</span></div>;
}
