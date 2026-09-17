"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createExpenseAction } from "@/app/actions/f4";
import {
  expenseCategories,
  expenseCreateSchema,
  jakartaDateTimeLocal,
  validateFinanceOccurredAt,
  type ExpenseCategory,
} from "@/domain/finance";
import { expenseCategoryLabels, paymentMethodLabels } from "@/components/ui";

type PaymentMethod = keyof typeof paymentMethodLabels;
type ExpenseFields = {
  category: ExpenseCategory;
  amountRupiah: string;
  method: "" | PaymentMethod;
  occurredAt: string;
  notes: string;
};

export function ExpenseForm() {
  const router = useRouter();
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [fields, setFields] = useState<ExpenseFields>(() => ({
    category: "egg_purchase",
    amountRupiah: "",
    method: "",
    occurredAt: jakartaDateTimeLocal(),
    notes: "",
  }));
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  function update<Name extends keyof ExpenseFields>(name: Name, value: ExpenseFields[Name]) {
    setFields((current) => ({ ...current, [name]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setMessage("");
    setErrors({});
    const payload = {
      category: fields.category,
      amountRupiah: fields.amountRupiah === "" ? 0 : Number(fields.amountRupiah),
      method: fields.method || undefined,
      occurredAt: `${fields.occurredAt}:00+07:00`,
      notes: fields.notes || undefined,
      idempotencyKey,
    };
    const parsed = expenseCreateSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors);
      setMessage("Periksa kembali data pengeluaran.");
      return;
    }
    const dateError = validateFinanceOccurredAt(parsed.data.occurredAt);
    if (dateError) {
      setErrors({ occurredAt: [dateError] });
      setMessage(dateError);
      return;
    }

    setPending(true);
    try {
      const result = await createExpenseAction(parsed.data);
      if (!result.ok) {
        setMessage(result.error.message);
        setErrors(result.error.fields ?? {});
        return;
      }
      setIdempotencyKey(crypto.randomUUID());
      router.push("/pengeluaran?created=1");
    } catch {
      setMessage("Pengeluaran belum tersimpan. Periksa koneksi lalu coba kembali.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="form-panel finance-form" onSubmit={submit} noValidate>
      <label className="field" htmlFor="expense-category">
        <span>Kategori *</span>
        <select
          id="expense-category"
          value={fields.category}
          onChange={(event) => update("category", event.target.value as ExpenseCategory)}
          aria-invalid={Boolean(errors.category)}
        >
          {expenseCategories.map((category) => (
            <option value={category} key={category}>{expenseCategoryLabels[category]}</option>
          ))}
        </select>
        {errors.category?.[0] && <small className="field-error">{errors.category[0]}</small>}
      </label>

      <div className="two-cols">
        <label className="field" htmlFor="expense-amount">
          <span>Nominal (Rp) *</span>
          <input
            id="expense-amount"
            inputMode="numeric"
            min="1"
            step="1"
            type="number"
            value={fields.amountRupiah}
            onChange={(event) => update("amountRupiah", event.target.value)}
            aria-invalid={Boolean(errors.amountRupiah)}
          />
          {errors.amountRupiah?.[0] && <small className="field-error">{errors.amountRupiah[0]}</small>}
        </label>

        <label className="field" htmlFor="expense-method">
          <span>Metode pembayaran</span>
          <select
            id="expense-method"
            value={fields.method}
            onChange={(event) => update("method", event.target.value as "" | PaymentMethod)}
            aria-invalid={Boolean(errors.method)}
          >
            <option value="">Tidak dicatat</option>
            {Object.entries(paymentMethodLabels).map(([value, label]) => (
              <option value={value} key={value}>{label}</option>
            ))}
          </select>
          {errors.method?.[0] && <small className="field-error">{errors.method[0]}</small>}
        </label>
      </div>

      <label className="field" htmlFor="expense-occurred-at">
        <span>Waktu transaksi *</span>
        <input
          id="expense-occurred-at"
          type="datetime-local"
          value={fields.occurredAt}
          onChange={(event) => update("occurredAt", event.target.value)}
          aria-invalid={Boolean(errors.occurredAt)}
        />
        <small className="field-hint">Menggunakan zona waktu Asia/Jakarta.</small>
        {errors.occurredAt?.[0] && <small className="field-error">{errors.occurredAt[0]}</small>}
      </label>

      <label className="field" htmlFor="expense-notes">
        <span>Catatan</span>
        <textarea
          id="expense-notes"
          value={fields.notes}
          onChange={(event) => update("notes", event.target.value)}
          aria-invalid={Boolean(errors.notes)}
        />
        {errors.notes?.[0] && <small className="field-error">{errors.notes[0]}</small>}
      </label>

      {message && <p className="notice error" role="alert">{message}</p>}
      <div className="form-actions">
        <button type="submit" disabled={pending}>{pending ? "Menyimpan..." : "Simpan pengeluaran"}</button>
      </div>
    </form>
  );
}
