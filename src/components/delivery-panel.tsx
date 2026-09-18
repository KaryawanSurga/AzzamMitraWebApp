"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createDeliveryAction, recordDeliveryReceiptAction, setDeliveryStatusAction } from "@/app/actions/f3";
import { manualDeliveryStatuses, type DeliveryRecord } from "@/domain/deliveries";
import { jakartaDate } from "@/domain/sales";
import { DeliveryBadge, deliveryLabels, formatCrate } from "./ui";

const terminal = (status: DeliveryRecord["status"]) => status === "failed" || status === "cancelled";

export function DeliveryPanel({ saleId, saleCrateQuantityMilli, deliveries }: { saleId: string; saleCrateQuantityMilli: number; deliveries: DeliveryRecord[] }) {
  const plannedMilli = deliveries.reduce((total, delivery) => total + delivery.crateQuantityMilli, 0);
  const remainingMilli = Math.max(saleCrateQuantityMilli - plannedMilli, 0);
  return (
    <section className="delivery-section">
      <h2>Pengiriman</h2>
      {saleCrateQuantityMilli === 0
        ? <p className="notice info">Penjualan ini tidak mencatat peti, jadi tidak ada yang perlu dikirim.</p>
        : <p className="delivery-meta">Rencana terkirim {formatCrate(plannedMilli)} dari {formatCrate(saleCrateQuantityMilli)}. Sisa rencana {formatCrate(remainingMilli)}.</p>}
      {remainingMilli > 0 && <DeliveryCreateForm saleId={saleId} remainingMilli={remainingMilli} />}
      {deliveries.length === 0
        ? <p className="delivery-meta">Belum ada pengiriman tercatat.</p>
        : <div className="delivery-list">{deliveries.map((delivery) => <DeliveryCard key={delivery.id} delivery={delivery} />)}</div>}
    </section>
  );
}

function DeliveryCreateForm({ saleId, remainingMilli }: { saleId: string; remainingMilli: number }) {
  const router = useRouter();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState("");
  const [dispatchedAt, setDispatchedAt] = useState(() => jakartaDate(new Date()));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setMessage(""); setErrors({});
    const crateQuantity = quantity.trim() === "" ? String(remainingMilli / 1000) : quantity.trim();
    setPending(true);
    try {
      const result = await createDeliveryAction({ saleId, crateQuantity, dispatchedAt, idempotencyKey: key });
      if (!result.ok) {
        setMessage(result.error.message); setErrors(result.error.fields ?? {});
        if (result.error.code === "unauthorized") router.push(`/login?next=/penjualan/${saleId}`);
        return;
      }
      setKey(crypto.randomUUID()); setQuantity("");
      router.refresh();
    } catch {
      setMessage("Koneksi terputus. Rencana pengiriman belum tersimpan dan input Anda dipertahankan. Coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="inline-form" onSubmit={submit} noValidate>
      <label className="field" htmlFor="delivery-quantity">
        <span>Jumlah peti dikirim *</span>
        <input id="delivery-quantity" inputMode="decimal" placeholder={String(remainingMilli / 1000)} value={quantity} onChange={(event) => setQuantity(event.target.value)} aria-invalid={Boolean(errors.crateQuantity)} />
        {errors.crateQuantity && <small className="field-error">{errors.crateQuantity[0]}</small>}
      </label>
      <label className="field" htmlFor="delivery-dispatched">
        <span>Tanggal kirim</span>
        <input id="delivery-dispatched" type="date" value={dispatchedAt} onChange={(event) => setDispatchedAt(event.target.value)} />
      </label>
      {message && <p className="notice error" role="alert">{message}</p>}
      <div className="form-actions"><button type="submit" disabled={pending}>{pending ? "Menyimpan pengiriman..." : "Catat pengiriman"}</button></div>
    </form>
  );
}

function DeliveryCard({ delivery }: { delivery: DeliveryRecord }) {
  const router = useRouter();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState("");
  const [receivedAt, setReceivedAt] = useState(() => jakartaDate(new Date()));
  const [status, setStatus] = useState<(typeof manualDeliveryStatuses)[number]>("in_transit");

  const outstandingMilli = delivery.crateQuantityMilli - delivery.receivedCrateQuantityMilli;

  async function run(action: () => Promise<{ ok: boolean; error?: { message: string; fields?: Record<string, string[]>; code: string } }>, nextKey: () => void) {
    if (pending) return;
    setMessage(""); setErrors({}); setPending(true);
    const result = await action();
    setPending(false);
    if (!result.ok && result.error) {
      setMessage(result.error.message); setErrors(result.error.fields ?? {});
      if (result.error.code === "unauthorized") router.push(`/login?next=/penjualan/${delivery.saleId}`);
      return;
    }
    nextKey(); router.refresh();
  }

  return (
    <article className="delivery-card">
      <header>
        <strong>{delivery.deliveryNumber}</strong>
        <DeliveryBadge status={delivery.status} />
      </header>
      <p className="delivery-meta">Rencana {formatCrate(delivery.crateQuantityMilli)} · Diterima {formatCrate(delivery.receivedCrateQuantityMilli)}{delivery.dispatchedAt ? ` · Kirim ${delivery.dispatchedAt}` : ""}{delivery.receivedAt ? ` · Terima ${delivery.receivedAt}` : ""}</p>
      {outstandingMilli > 0 && !terminal(delivery.status) && (
        <form className="inline-form" onSubmit={(event) => { event.preventDefault(); void run(() => recordDeliveryReceiptAction({ deliveryId: delivery.id, crateQuantity: quantity.trim() === "" ? String(outstandingMilli / 1000) : quantity.trim(), receivedAt, idempotencyKey: key }), () => { setKey(crypto.randomUUID()); setQuantity(""); }); }} noValidate>
          <div className="two-cols">
            <label className="field" htmlFor={`receipt-quantity-${delivery.id}`}>
              <span>Jumlah diterima *</span>
              <input id={`receipt-quantity-${delivery.id}`} inputMode="decimal" placeholder={String(outstandingMilli / 1000)} value={quantity} onChange={(event) => setQuantity(event.target.value)} aria-invalid={Boolean(errors.crateQuantity)} />
              {errors.crateQuantity && <small className="field-error">{errors.crateQuantity[0]}</small>}
            </label>
            <label className="field" htmlFor={`receipt-date-${delivery.id}`}>
              <span>Tanggal terima *</span>
              <input id={`receipt-date-${delivery.id}`} type="date" value={receivedAt} onChange={(event) => setReceivedAt(event.target.value)} aria-invalid={Boolean(errors.receivedAt)} />
              {errors.receivedAt && <small className="field-error">{errors.receivedAt[0]}</small>}
            </label>
          </div>
          <div className="form-actions"><button type="submit" disabled={pending}>{pending ? "Menyimpan penerimaan..." : "Catat penerimaan"}</button></div>
        </form>
      )}
      {!terminal(delivery.status) && delivery.status !== "received" && (
        <form className="inline-form" onSubmit={(event) => { event.preventDefault(); void run(() => setDeliveryStatusAction({ deliveryId: delivery.id, status, idempotencyKey: key }), () => setKey(crypto.randomUUID())); }}>
          <div className="two-cols">
            <label className="field" htmlFor={`delivery-status-${delivery.id}`}>
              <span>Ubah status</span>
              <select id={`delivery-status-${delivery.id}`} value={status} onChange={(event) => setStatus(event.target.value as (typeof manualDeliveryStatuses)[number])}>
                {manualDeliveryStatuses.map((value) => <option value={value} key={value}>{deliveryLabels[value]}</option>)}
              </select>
              {errors.status && <small className="field-error">{errors.status[0]}</small>}
            </label>
            <div className="form-actions form-actions-end"><button type="submit" className="button-secondary" disabled={pending}>Simpan status</button></div>
          </div>
        </form>
      )}
      {message && <p className="notice error" role="alert">{message}</p>}
    </article>
  );
}
