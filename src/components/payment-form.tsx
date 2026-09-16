"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPaymentAction } from "@/app/actions/f3";
import { jakartaDate } from "@/domain/sales";
import { rupiah } from "./ui";

const methods = [["cash", "Tunai"], ["transfer", "Transfer"], ["other", "Lainnya"]] as const;

export function PaymentForm({ saleId, remainingRupiah }: { saleId: string; remainingRupiah: number }) {
  const router = useRouter();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "transfer" | "other">("cash");
  const [paidAt, setPaidAt] = useState(() => jakartaDate(new Date()));
  const [notes, setNotes] = useState("");

  if (remainingRupiah <= 0) return <p className="notice success" role="status">Invoice ini sudah lunas.</p>;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setMessage(""); setSuccess(""); setErrors({});
    const amountRupiah = Number(amount);
    const localError = amount.trim() === "" || !Number.isFinite(amountRupiah) || amountRupiah <= 0
      ? "Nominal pembayaran harus lebih dari nol."
      : amountRupiah > remainingRupiah ? "Nominal pembayaran melebihi sisa piutang." : null;
    if (localError) { setErrors({ amountRupiah: [localError] }); return; }
    setPending(true);
    const result = await createPaymentAction({ saleId, amountRupiah, method, paidAt, notes: notes || undefined, idempotencyKey: key });
    setPending(false);
    if (!result.ok) {
      setMessage(result.error.message); setErrors(result.error.fields ?? {});
      if (result.error.code === "unauthorized") router.push(`/login?next=/penjualan/${saleId}`);
      return;
    }
    setKey(crypto.randomUUID()); setAmount(""); setNotes(""); setSuccess(`Pembayaran ${rupiah(result.data.amountRupiah)} tersimpan.`);
    router.refresh();
  }

  return (
    <form className="form-panel" onSubmit={submit} noValidate>
      <div className="two-cols">
        <label className="field" htmlFor="payment-amount">
          <span>Nominal (Rp) *</span>
          <input id="payment-amount" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} aria-invalid={Boolean(errors.amountRupiah)} />
          {errors.amountRupiah && <small className="field-error">{errors.amountRupiah[0]}</small>}
        </label>
        <label className="field" htmlFor="payment-date">
          <span>Tanggal bayar *</span>
          <input id="payment-date" type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} aria-invalid={Boolean(errors.paidAt)} />
          {errors.paidAt && <small className="field-error">{errors.paidAt[0]}</small>}
        </label>
      </div>
      <div className="choice-row" role="radiogroup" aria-label="Metode pembayaran">
        {methods.map(([value, label]) => (
          <label key={value}><input type="radio" name="payment-method" checked={method === value} onChange={() => setMethod(value)} /> {label}</label>
        ))}
      </div>
      <label className="field" htmlFor="payment-notes">
        <span>Catatan</span>
        <input id="payment-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      {message && <p className="notice error" role="alert">{message}</p>}
      {success && <p className="notice success" role="status">{success}</p>}
      <div className="form-actions">
        <button type="submit" disabled={pending}>{pending ? "Menyimpan pembayaran..." : "Catat pembayaran"}</button>
      </div>
    </form>
  );
}
