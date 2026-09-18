"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSaleAction } from "@/app/actions/f2";
import { calculateSale, jakartaDate, saleMutationSchema, validateTransactionDate, type CustomerRecord, type SaleMutationInput } from "@/domain/sales";
import { decodeSaleDraft, encodeSaleDraft, SALE_DRAFT_KEY } from "./sale-draft";
import { rupiah } from "./ui";

type Values = { customerId: string; transactionDate: string; description: string; pricingBasis: "crate" | "kg"; crateQuantity: string; weightKg: string; unitPriceRupiah: string; discountRupiah: string; feeRupiah: string; notes: string; paymentChoice: "full" | "down_payment" | "debt"; initialPaymentRupiah: string; paymentMethod: "cash" | "transfer" | "other"; dueDate: string };
const defaults = (): Values => ({ customerId: "", transactionDate: jakartaDate(new Date()), description: "Telur", pricingBasis: "crate", crateQuantity: "", weightKg: "", unitPriceRupiah: "", discountRupiah: "0", feeRupiah: "0", notes: "", paymentChoice: "full", initialPaymentRupiah: "0", paymentMethod: "cash", dueDate: "" });
const number = (value: string) => value === "" ? 0 : Number(value);
export function toSaleInput(values: Values, idempotencyKey: string): SaleMutationInput { return { customerId: values.customerId, transactionDate: values.transactionDate, items: [{ description: values.description, pricingBasis: values.pricingBasis, crateQuantity: values.crateQuantity || undefined, weightKg: values.weightKg || undefined, unitPriceRupiah: number(values.unitPriceRupiah) }], discountRupiah: number(values.discountRupiah), feeRupiah: number(values.feeRupiah), notes: values.notes || undefined, paymentChoice: values.paymentChoice, initialPaymentRupiah: values.paymentChoice === "down_payment" ? number(values.initialPaymentRupiah) : 0, paymentMethod: values.paymentChoice === "debt" ? undefined : values.paymentMethod, dueDate: values.paymentChoice === "full" ? undefined : values.dueDate || undefined, idempotencyKey, status: "confirmed" }; }
export function SaleForm({ customers }: { customers: CustomerRecord[] }) {
  const router = useRouter(); const [values, setValues] = useState(defaults); const [key, setKey] = useState(() => crypto.randomUUID()); const [pending, setPending] = useState(false); const [restored, setRestored] = useState(false); const [message, setMessage] = useState(""); const [errors, setErrors] = useState<Record<string, string[]>>({}); const hydrated = useRef(false); const completed = useRef(false);
  useEffect(() => { let active = true; queueMicrotask(() => { if (!active) return; const saved = decodeSaleDraft<Values>(localStorage.getItem(SALE_DRAFT_KEY)); if (saved) { setValues({ ...defaults(), ...saved }); setRestored(true); } else localStorage.removeItem(SALE_DRAFT_KEY); hydrated.current = true; }); return () => { active = false; }; }, []);
  useEffect(() => { if (!hydrated.current || pending || completed.current) return; const timeout = window.setTimeout(() => localStorage.setItem(SALE_DRAFT_KEY, encodeSaleDraft(values)), 250); return () => window.clearTimeout(timeout); }, [values, pending]);
  const input = useMemo(() => toSaleInput(values, key), [values, key]);
  const summary = useMemo(() => { const parsed = saleMutationSchema.safeParse(input); if (!parsed.success) return null; try { return calculateSale(parsed.data, jakartaDate(new Date())); } catch { return null; } }, [input]);
  const set = (name: keyof Values, value: string) => setValues((old) => ({ ...old, [name]: value }));
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setMessage(""); setErrors({});
    const parsed = saleMutationSchema.safeParse(input);
    if (!parsed.success) { setErrors(parsed.error.flatten().fieldErrors); setMessage("Periksa kembali data yang diisi."); return; }
    const dateError = validateTransactionDate(parsed.data.transactionDate);
    if (dateError) { setErrors({ transactionDate: [dateError] }); setMessage(dateError); return; }
    try { calculateSale(parsed.data, jakartaDate(new Date())); } catch (error) { setErrors({ items: [error instanceof Error ? error.message : "Perhitungan tidak valid."] }); setMessage("Periksa perhitungan penjualan."); return; }
    setPending(true);
    try {
      const result = await createSaleAction(parsed.data);
      if (!result.ok) {
        setMessage(result.error.message); setErrors(result.error.fields ?? {});
        if (result.error.code === "unauthorized") router.push("/login?next=/penjualan/baru");
        return;
      }
      completed.current = true;
      localStorage.removeItem(SALE_DRAFT_KEY);
      setKey(crypto.randomUUID());
      router.push(`/penjualan/${result.data.id}?created=1`);
    } catch {
      setMessage("Koneksi terputus. Input Anda tetap tersimpan di perangkat. Periksa koneksi lalu coba lagi.");
    } finally {
      setPending(false);
    }
  }
  if (customers.length === 0) return <section className="empty-state"><h2>Tambahkan pelanggan lebih dulu</h2><p>Penjualan baru hanya dapat dibuat untuk pelanggan aktif.</p><Link className="button" href="/pelanggan?baru=1">Tambah pelanggan</Link></section>;
  return <form className="sale-layout" onSubmit={submit} noValidate><div className="form-panel sale-fields">{restored && <p className="notice info" role="status">Draft lokal dipulihkan. Periksa kembali sebelum menyimpan.</p>}<fieldset><legend>Pelanggan dan tanggal</legend><label className="field"><span>Pelanggan *</span><select value={values.customerId} onChange={(e) => set("customerId", e.target.value)} aria-invalid={Boolean(errors.customerId)}><option value="">Pilih pelanggan</option>{customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.name}</option>)}</select>{errors.customerId && <small className="field-error">Pelanggan wajib dipilih.</small>}</label><Link href="/pelanggan?baru=1" className="text-link">Tambah pelanggan baru</Link><Input label="Tanggal transaksi" name="transactionDate" type="date" values={values} set={set} error={errors.transactionDate?.[0]}/></fieldset><fieldset><legend>Item penjualan</legend><Input label="Deskripsi" name="description" values={values} set={set}/><div className="choice-row" role="radiogroup" aria-label="Dasar harga"><label><input type="radio" checked={values.pricingBasis === "crate"} onChange={() => set("pricingBasis", "crate")}/> Per peti</label><label><input type="radio" checked={values.pricingBasis === "kg"} onChange={() => set("pricingBasis", "kg")}/> Per kg</label></div><div className="two-cols"><Input label="Jumlah peti" name="crateQuantity" type="number" step="0.001" values={values} set={set} error={errors.items?.[0]}/><Input label="Berat aktual (kg)" name="weightKg" type="number" step="0.001" values={values} set={set} error={values.pricingBasis === "kg" ? errors.items?.[0] : undefined}/></div><Input label={`Harga per ${values.pricingBasis === "crate" ? "peti" : "kg"} (Rp)`} name="unitPriceRupiah" type="number" values={values} set={set}/></fieldset><fieldset><legend>Penyesuaian</legend><div className="two-cols"><Input label="Diskon (Rp)" name="discountRupiah" type="number" values={values} set={set}/><Input label="Biaya tambahan (Rp)" name="feeRupiah" type="number" values={values} set={set}/></div><label className="field"><span>Catatan</span><textarea value={values.notes} onChange={(e) => set("notes", e.target.value)}/></label></fieldset><fieldset><legend>Pembayaran</legend><div className="choice-row">{([ ["full", "Lunas"], ["down_payment", "DP"], ["debt", "Utang"] ] as const).map(([value, label]) => <label key={value}><input type="radio" checked={values.paymentChoice === value} onChange={() => set("paymentChoice", value)}/>{label}</label>)}</div>{values.paymentChoice === "down_payment" && <Input label="Jumlah DP (Rp)" name="initialPaymentRupiah" type="number" values={values} set={set} error={errors.initialPaymentRupiah?.[0]}/>} {values.paymentChoice !== "debt" && <label className="field"><span>Metode pembayaran *</span><select value={values.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)}><option value="cash">Tunai</option><option value="transfer">Transfer</option><option value="other">Lainnya</option></select></label>} {values.paymentChoice !== "full" && <Input label="Tanggal jatuh tempo" name="dueDate" type="date" values={values} set={set} error={errors.dueDate?.[0]}/>}</fieldset>{message && <p className="notice error" role="alert">{message}</p>}<button type="submit" disabled={pending}>{pending ? "Menyimpan penjualan..." : "Simpan penjualan"}</button></div><aside className="summary" aria-live="polite"><h2>Ringkasan</h2><Money label="Subtotal" value={summary?.subtotalRupiah}/><Money label="Diskon" value={summary?.subtotalRupiah === undefined ? undefined : -number(values.discountRupiah)}/><Money label="Biaya" value={summary?.subtotalRupiah === undefined ? undefined : number(values.feeRupiah)}/><Money label="Total" value={summary?.totalRupiah} strong/><Money label="Dibayar" value={summary?.paidRupiah}/><Money label="Sisa" value={summary?.remainingRupiah} strong/></aside></form>;
}
function Input({ label, name, values, set, error, ...props }: { label: string; name: keyof Values; values: Values; set: (name: keyof Values, value: string) => void; error?: string; type?: string; step?: string }) { const id = `sale-${name}`; return <label className="field" htmlFor={id}><span>{label}</span><input id={id} value={values[name]} onChange={(e) => set(name, e.target.value)} aria-invalid={Boolean(error)} {...props}/>{error && <small className="field-error">{error}</small>}</label>; }
function Money({ label, value, strong }: { label: string; value?: number; strong?: boolean }) { return <div className={strong ? "money strong" : "money"}><span>{label}</span><span>{value === undefined ? "-" : rupiah(value)}</span></div>; }
