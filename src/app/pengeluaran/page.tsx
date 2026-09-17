import Link from "next/link";
import { redirect } from "next/navigation";
import { listExpensesAction } from "@/app/actions/f4";
import { InternalShell } from "@/components/internal-shell";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  expenseCategoryLabels,
  formatFinanceDate,
  paymentMethodLabels,
  rupiah,
} from "@/components/ui";
import { getCurrentOwner } from "@/lib/supabase/owner";

type ExpenseSearchParams = {
  from?: string;
  to?: string;
  created?: string;
};

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<ExpenseSearchParams> }) {
  const owner = await getCurrentOwner();
  if (!owner) redirect("/login?next=/pengeluaran");

  const { from = "", to = "", created } = await searchParams;
  const result = await listExpensesAction({
    from: from ? `${from}T00:00:00+07:00` : undefined,
    to: to ? `${to}T23:59:59+07:00` : undefined,
    limit: 100,
    offset: 0,
  });

  return (
    <InternalShell ownerName={owner.display_name}>
      <main className="page">
        <PageHeader
          title="Pengeluaran"
          description="Biaya usaha tercatat terpisah dari modal dan pengambilan pribadi."
          action={(
            <div className="quick-actions">
              <Link className="button-secondary" href="/pengaturan">Modal &amp; prive</Link>
              <Link className="button" href="/pengeluaran/baru">Catat pengeluaran</Link>
            </div>
          )}
        />

        {created === "1" && <p className="notice success" role="status">Pengeluaran berhasil disimpan.</p>}

        <form className="period-filter" aria-label="Filter periode pengeluaran">
          <label className="field" htmlFor="expense-from">
            <span>Dari tanggal</span>
            <input id="expense-from" name="from" type="date" defaultValue={from}/>
          </label>
          <label className="field" htmlFor="expense-to">
            <span>Sampai tanggal</span>
            <input id="expense-to" name="to" type="date" defaultValue={to}/>
          </label>
          <button type="submit">Terapkan</button>
          {(from || to) && <Link className="button-secondary" href="/pengeluaran">Reset</Link>}
        </form>

        {!result.ok ? (
          <ErrorState {...result.error} retryHref="/pengeluaran"/>
        ) : result.data.length === 0 ? (
          <EmptyState
            title={from || to ? "Tidak ada pengeluaran pada periode ini" : "Belum ada pengeluaran"}
            detail={from || to ? "Ubah rentang tanggal atau catat pengeluaran baru." : "Catat biaya usaha pertama untuk mulai membangun laporan periode."}
            href="/pengeluaran/baru"
            label="Catat pengeluaran"
          />
        ) : (
          <div className="data-list">
            {result.data.map((expense) => (
              <article className="data-row finance-row" key={expense.id}>
                <div>
                  <strong>{expenseCategoryLabels[expense.category]}</strong>
                  <span>{expense.expenseNumber}</span>
                  {expense.notes && <span>{expense.notes}</span>}
                </div>
                <div className="row-end">
                  <strong>{rupiah(expense.amountRupiah)}</strong>
                  <time dateTime={expense.occurredAt}>{formatFinanceDate(expense.occurredAt)}</time>
                  <span>{expense.method ? paymentMethodLabels[expense.method] : "Metode tidak dicatat"}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </InternalShell>
  );
}
