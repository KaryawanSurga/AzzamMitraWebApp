"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { recordCrateReturnAction } from "@/app/actions/f3";
import { jakartaDate } from "@/domain/sales";
import { formatCrate } from "./ui";

export type CrateAccountOption = { customerId: string; customerName: string; balanceMilli: number };

/* Dipakai di halaman Peti (pilih pelanggan) dan di detail pelanggan (pelanggan tetap). */
export function CrateReturnForm({ accounts, fixedCustomerId }: { accounts: CrateAccountOption[]; fixedCustomerId?: string }) {
  const router = useRouter();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [customerId, setCustomerId] = useState(fixedCustomerId ?? accounts[0]?.customerId ?? "");
  const [quantity, setQuantity] = useState("");
  const [occurredAt, setOccurredAt] = useState(() => jakartaDate(new Date()));
  const [notes, setNotes] = useState("");

  const selected = accounts.find((account) => account.customerId === customerId);
  const balanceMilli = selected?.balanceMilli ?? 0;

  if (accounts.length === 0) return <p className="notice info" role="status">Tidak ada peti yang masih dibawa pelanggan.</p>;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setMessage(""); setSuccess(""); setErrors({});
    const crateQuantity = quantity.trim();
    const numeric = Number(crateQuantity.replace(",", "."));
    const localError = crateQuantity === "" || !Number.isFinite(numeric) || numeric <= 0
      ? "Jumlah peti yang dikembalikan harus lebih dari nol."
      : numeric * 1000 > balanceMilli ? `Pengembalian melebihi saldo peti pelanggan (${formatCrate(balanceMilli)}).` : null;
    if (localError) { setErrors({ crateQuantity: [localError] }); return; }
    setPending(true);
    const result = await recordCrateReturnAction({ customerId, crateQuantity: crateQuantity.replace(",", "."), occurredAt, notes: notes || undefined, idempotencyKey: key });
    setPending(false);
    if (!result.ok) {
      setMessage(result.error.message); setErrors(result.error.fields ?? {});
      if (result.error.code === "unauthorized") router.push("/login?next=/peti");
      return;
    }
    setKey(crypto.randomUUID()); setQuantity(""); setNotes("");
    setSuccess(`Peti kembali ${formatCrate(result.data.crateQuantityMilli)} dari ${selected?.customerName ?? "pelanggan"} tersimpan.`);
    router.refresh();
  }

  return (
    <form className="form-panel" onSubmit={submit} noValidate>
      {!fixedCustomerId && (
        <label className="field" htmlFor="crate-customer">
          <span>Pelanggan *</span>
          <select id="crate-customer" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
            {accounts.map((account) => <option value={account.customerId} key={account.customerId}>{account.customerName} · {formatCrate(account.balanceMilli)}</option>)}
          </select>
        </label>
      )}
      <div className="two-cols">
        <label className="field" htmlFor="crate-quantity">
          <span>Jumlah peti kembali *</span>
          <input id="crate-quantity" inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} aria-invalid={Boolean(errors.crateQuantity)} />
          {errors.crateQuantity && <small className="field-error">{errors.crateQuantity[0]}</small>}
        </label>
        <label className="field" htmlFor="crate-date">
          <span>Tanggal kembali *</span>
          <input id="crate-date" type="date" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} aria-invalid={Boolean(errors.occurredAt)} />
          {errors.occurredAt && <small className="field-error">{errors.occurredAt[0]}</small>}
        </label>
      </div>
      <label className="field" htmlFor="crate-notes">
        <span>Catatan</span>
        <input id="crate-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      <p className="delivery-meta">Saldo {selected?.customerName ?? "pelanggan"} saat ini {formatCrate(balanceMilli)}.</p>
      {message && <p className="notice error" role="alert">{message}</p>}
      {success && <p className="notice success" role="status">{success}</p>}
      <div className="form-actions"><button type="submit" disabled={pending}>{pending ? "Menyimpan peti kembali..." : "Catat peti kembali"}</button></div>
    </form>
  );
}
