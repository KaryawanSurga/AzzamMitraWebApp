"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCapitalMovementAction } from "@/app/actions/f4";
import {
  capitalMovementCreateSchema,
  capitalMovementTypes,
  jakartaDateTimeLocal,
  validateFinanceOccurredAt,
  type CapitalMovementType,
} from "@/domain/finance";
import { capitalMovementLabels, rupiah } from "@/components/ui";

type CapitalFields = {
  type: CapitalMovementType;
  amountRupiah: string;
  occurredAt: string;
  notes: string;
};

export function CapitalMovementForm() {
  const router = useRouter();
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [fields, setFields] = useState<CapitalFields>(() => ({
    type: "capital_in",
    amountRupiah: "",
    occurredAt: jakartaDateTimeLocal(),
    notes: "",
  }));
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  function update<Name extends keyof CapitalFields>(name: Name, value: CapitalFields[Name]) {
    setFields((current) => ({ ...current, [name]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setMessage("");
    setErrors({});
    const payload = {
      type: fields.type,
      amountRupiah: fields.amountRupiah === "" ? 0 : Number(fields.amountRupiah),
      occurredAt: `${fields.occurredAt}:00+07:00`,
      notes: fields.notes || undefined,
      idempotencyKey,
    };
    const parsed = capitalMovementCreateSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors);
      setMessage("Periksa kembali data modal atau prive.");
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
      const result = await createCapitalMovementAction(parsed.data);
      if (!result.ok) {
        setMessage(result.error.message);
        setErrors(result.error.fields ?? {});
        return;
      }
      setIdempotencyKey(crypto.randomUUID());
      setFields((current) => ({ ...current, amountRupiah: "", notes: "" }));
      setMessage(`${capitalMovementLabels[result.data.type]} ${rupiah(result.data.amountRupiah)} tersimpan.`);
      router.refresh();
    } catch {
      setMessage("Pergerakan modal belum tersimpan. Periksa koneksi lalu coba kembali.");
    } finally {
      setPending(false);
    }
  }

  const success = message.endsWith("tersimpan.");

  return (
    <form className="form-panel finance-form" onSubmit={submit} noValidate>
      <fieldset className="finance-choice">
        <legend>Jenis transaksi *</legend>
        <div className="choice-row">
          {capitalMovementTypes.map((type) => (
            <label key={type}>
              <input
                type="radio"
                name="capital-type"
                value={type}
                checked={fields.type === type}
                onChange={() => update("type", type)}
              />
              {capitalMovementLabels[type]}
            </label>
          ))}
        </div>
        {errors.type?.[0] && <small className="field-error">{errors.type[0]}</small>}
      </fieldset>

      <div className="two-cols">
        <label className="field" htmlFor="capital-amount">
          <span>Nominal (Rp) *</span>
          <input
            id="capital-amount"
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

        <label className="field" htmlFor="capital-occurred-at">
          <span>Waktu transaksi *</span>
          <input
            id="capital-occurred-at"
            type="datetime-local"
            value={fields.occurredAt}
            onChange={(event) => update("occurredAt", event.target.value)}
            aria-invalid={Boolean(errors.occurredAt)}
          />
          {errors.occurredAt?.[0] && <small className="field-error">{errors.occurredAt[0]}</small>}
        </label>
      </div>

      <label className="field" htmlFor="capital-notes">
        <span>Catatan</span>
        <textarea
          id="capital-notes"
          value={fields.notes}
          onChange={(event) => update("notes", event.target.value)}
          aria-invalid={Boolean(errors.notes)}
        />
        {errors.notes?.[0] && <small className="field-error">{errors.notes[0]}</small>}
      </label>

      {message && <p className={`notice ${success ? "success" : "error"}`} role={success ? "status" : "alert"}>{message}</p>}
      <div className="form-actions">
        <button type="submit" disabled={pending}>{pending ? "Menyimpan..." : "Catat modal / prive"}</button>
      </div>
    </form>
  );
}
