"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelSaleAction, correctSaleAction } from "@/app/actions/f2";
import { rupiah } from "./ui";

type CorrectionSale = {
  id: string;
  invoiceNumber: string;
  subtotalRupiah: number;
  discountRupiah: number;
  feeRupiah: number;
  totalRupiah: number;
  paidRupiah: number;
  dueDate: string | null;
  notes: string | null;
};

const REASON_MINIMUM = 10;

export function SaleCorrectionPanel({ sale }: { sale: CorrectionSale }) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "correct" | "cancel">("idle");

  return (
    <section className="correction-panel" aria-labelledby="correction-title">
      <header>
        <div>
          <span>JEJAK AUDIT</span>
          <h2 id="correction-title">Koreksi &amp; pembatalan</h2>
        </div>
        <p>Invoice terkonfirmasi tidak pernah dihapus. Setiap perubahan menyimpan alasan, pelaku, dan nilai sebelum/sesudah.</p>
      </header>
      <div className="correction-actions">
        <button type="button" className="button-secondary" aria-expanded={mode === "correct"} onClick={() => setMode(mode === "correct" ? "idle" : "correct")}>Koreksi invoice</button>
        <button type="button" className="button-quiet danger" aria-expanded={mode === "cancel"} onClick={() => setMode(mode === "cancel" ? "idle" : "cancel")}>Batalkan invoice</button>
      </div>
      {mode === "correct" && <CorrectionForm sale={sale} onDone={() => { setMode("idle"); router.refresh(); }}/>}
      {mode === "cancel" && <CancellationForm sale={sale} onDone={() => { setMode("idle"); router.refresh(); }}/>}
    </section>
  );
}

function CorrectionForm({ sale, onDone }: { sale: CorrectionSale; onDone: () => void }) {
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [discount, setDiscount] = useState(String(sale.discountRupiah));
  const [fee, setFee] = useState(String(sale.feeRupiah));
  const [dueDate, setDueDate] = useState(sale.dueDate ?? "");
  const [notes, setNotes] = useState(sale.notes ?? "");
  const [reason, setReason] = useState("");

  const previewTotal = sale.subtotalRupiah - Number(discount || 0) + Number(fee || 0);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setMessage(""); setErrors({});
    const localError = reason.trim().length < REASON_MINIMUM
      ? "Alasan koreksi minimal 10 karakter."
      : !Number.isFinite(previewTotal) || previewTotal < 0
        ? "Nominal koreksi tidak valid."
        : previewTotal < sale.paidRupiah ? "Total koreksi tidak boleh lebih kecil dari pembayaran yang sudah diterima." : null;
    if (localError) { setErrors({ reason: [localError] }); return; }
    setPending(true);
    const result = await correctSaleAction({
      saleId: sale.id,
      discountRupiah: Number(discount || 0),
      feeRupiah: Number(fee || 0),
      dueDate: dueDate === "" ? null : dueDate,
      notes: notes === "" ? null : notes,
      reason,
      idempotencyKey: key,
    });
    setPending(false);
    if (!result.ok) {
      setMessage(result.error.message); setErrors(result.error.fields ?? {});
      return;
    }
    setKey(crypto.randomUUID()); setReason("");
    onDone();
  }

  return (
    <form className="form-panel correction-form" onSubmit={submit} noValidate>
      <p className="form-context">Invoice <strong>{sale.invoiceNumber}</strong> · total saat ini <strong>{rupiah(sale.totalRupiah)}</strong> · dibayar {rupiah(sale.paidRupiah)}</p>
      <div className="two-cols">
        <label className="field" htmlFor="correction-discount">
          <span>Diskon (Rp)</span>
          <input id="correction-discount" inputMode="numeric" value={discount} onChange={(event) => setDiscount(event.target.value)} aria-invalid={Boolean(errors.discountRupiah)}/>
          {errors.discountRupiah && <small className="field-error">{errors.discountRupiah[0]}</small>}
        </label>
        <label className="field" htmlFor="correction-fee">
          <span>Biaya (Rp)</span>
          <input id="correction-fee" inputMode="numeric" value={fee} onChange={(event) => setFee(event.target.value)} aria-invalid={Boolean(errors.feeRupiah)}/>
          {errors.feeRupiah && <small className="field-error">{errors.feeRupiah[0]}</small>}
        </label>
      </div>
      <div className="two-cols">
        <label className="field" htmlFor="correction-due-date">
          <span>Jatuh tempo</span>
          <input id="correction-due-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} aria-invalid={Boolean(errors.dueDate)}/>
          {errors.dueDate && <small className="field-error">{errors.dueDate[0]}</small>}
        </label>
        <label className="field" htmlFor="correction-notes">
          <span>Catatan</span>
          <input id="correction-notes" value={notes} onChange={(event) => setNotes(event.target.value)}/>
        </label>
      </div>
      <p className="form-context">Total setelah koreksi: <strong>{rupiah(previewTotal)}</strong></p>
      <label className="field" htmlFor="correction-reason">
        <span>Alasan koreksi *</span>
        <textarea id="correction-reason" value={reason} onChange={(event) => setReason(event.target.value)} aria-invalid={Boolean(errors.reason)}/>
        {errors.reason && <small className="field-error">{errors.reason[0]}</small>}
      </label>
      {message && <p className="notice error" role="alert">{message}</p>}
      <div className="form-actions">
        <button type="submit" disabled={pending}>{pending ? "Menyimpan koreksi..." : "Simpan koreksi"}</button>
      </div>
    </form>
  );
}

function CancellationForm({ sale, onDone }: { sale: CorrectionSale; onDone: () => void }) {
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setMessage(""); setErrors({});
    if (reason.trim().length < REASON_MINIMUM) { setErrors({ reason: ["Alasan pembatalan minimal 10 karakter."] }); return; }
    if (!confirmed) { setErrors({ confirmed: ["Konfirmasi dampak pembatalan wajib dicentang."] }); return; }
    setPending(true);
    const result = await cancelSaleAction({ saleId: sale.id, reason, idempotencyKey: key });
    setPending(false);
    if (!result.ok) {
      setMessage(result.error.message); setErrors(result.error.fields ?? {});
      return;
    }
    setKey(crypto.randomUUID()); setReason(""); setConfirmed(false);
    onDone();
  }

  return (
    <form className="form-panel correction-form" onSubmit={submit} noValidate>
      <p className="form-note">Membatalkan invoice <strong>{sale.invoiceNumber}</strong> senilai <strong>{rupiah(sale.totalRupiah)}</strong>. Nomor invoice tetap tersimpan dan tidak dipakai ulang. Pembayaran yang sudah diterima ({rupiah(sale.paidRupiah)}) harus dikembalikan manual dan tidak lagi dihitung sebagai uang masuk.</p>
      <label className="field" htmlFor="cancellation-reason">
        <span>Alasan pembatalan *</span>
        <textarea id="cancellation-reason" value={reason} onChange={(event) => setReason(event.target.value)} aria-invalid={Boolean(errors.reason)}/>
        {errors.reason && <small className="field-error">{errors.reason[0]}</small>}
      </label>
      <label className="checkbox-field" htmlFor="cancellation-confirm">
        <input id="cancellation-confirm" type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)}/>
        <span>Saya memahami dampak pembatalan dan sudah menyelesaikan pembayaran/pengiriman terkait.</span>
      </label>
      {errors.confirmed && <small className="field-error">{errors.confirmed[0]}</small>}
      {message && <p className="notice error" role="alert">{message}</p>}
      <div className="form-actions">
        <button type="submit" disabled={pending}>{pending ? "Membatalkan..." : "Konfirmasi pembatalan"}</button>
      </div>
    </form>
  );
}
