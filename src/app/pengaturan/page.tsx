import Link from "next/link";
import { redirect } from "next/navigation";
import { listCapitalMovementsAction } from "@/app/actions/f4";
import { CapitalMovementForm } from "@/components/capital-movement-form";
import { InternalShell } from "@/components/internal-shell";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  capitalMovementLabels,
  formatFinanceDate,
  rupiah,
} from "@/components/ui";
import { getCurrentOwner } from "@/lib/supabase/owner";

type SettingsSearchParams = {
  from?: string;
  to?: string;
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<SettingsSearchParams> }) {
  const owner = await getCurrentOwner();
  if (!owner) redirect("/login?next=/pengaturan");

  const { from = "", to = "" } = await searchParams;
  const movements = await listCapitalMovementsAction({
    from: from ? `${from}T00:00:00+07:00` : undefined,
    to: to ? `${to}T23:59:59+07:00` : undefined,
    limit: 100,
    offset: 0,
  });

  return (
    <InternalShell ownerName={owner.display_name}>
      <main className="page">
        <PageHeader
          title="Modal & prive"
          description="Setoran owner dan pengambilan pribadi tidak dihitung sebagai pendapatan atau biaya usaha."
          action={<Link className="button-secondary" href="/pengeluaran">Pengeluaran</Link>}
        />

        <section className="finance-settings-grid">
          <div>
            <h2 className="section-title">Catat pergerakan modal</h2>
            <CapitalMovementForm/>
          </div>

          <div>
            <h2 className="section-title">Riwayat modal &amp; prive</h2>
            <form className="period-filter compact" aria-label="Filter periode modal dan prive">
              <label className="field" htmlFor="capital-from">
                <span>Dari tanggal</span>
                <input id="capital-from" name="from" type="date" defaultValue={from}/>
              </label>
              <label className="field" htmlFor="capital-to">
                <span>Sampai tanggal</span>
                <input id="capital-to" name="to" type="date" defaultValue={to}/>
              </label>
              <button type="submit">Terapkan</button>
              {(from || to) && <Link className="button-secondary" href="/pengaturan">Reset</Link>}
            </form>

            {!movements.ok ? (
              <ErrorState {...movements.error} retryHref="/pengaturan"/>
            ) : movements.data.length === 0 ? (
              <EmptyState
                title={from || to ? "Tidak ada transaksi pada periode ini" : "Belum ada modal atau prive"}
                detail={from || to ? "Ubah rentang tanggal untuk melihat transaksi lain." : "Setoran modal dan pengambilan pribadi akan muncul di sini."}
              />
            ) : (
              <div className="data-list">
                {movements.data.map((movement) => (
                  <article className="data-row finance-row" key={movement.id}>
                    <div>
                      <strong>{capitalMovementLabels[movement.type]}</strong>
                      <span>{movement.movementNumber}</span>
                      {movement.notes && <span>{movement.notes}</span>}
                    </div>
                    <div className="row-end">
                      <strong className={movement.type === "owner_draw" ? "money-out" : "money-in"}>
                        {movement.type === "owner_draw" ? "−" : "+"}{rupiah(movement.amountRupiah)}
                      </strong>
                      <time dateTime={movement.occurredAt}>{formatFinanceDate(movement.occurredAt)}</time>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </InternalShell>
  );
}
