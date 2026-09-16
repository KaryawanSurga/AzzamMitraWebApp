import { notFound, redirect } from "next/navigation";
import { getCustomerAction } from "@/app/actions/f2";
import { getCrateAccountAction, listCrateMovementsAction } from "@/app/actions/f3";
import { CrateReturnForm } from "@/components/crate-return-form";
import { CustomerForm } from "@/components/customer-form";
import { InternalShell } from "@/components/internal-shell";
import { ErrorState, PageHeader, formatCrate, movementLabels } from "@/components/ui";
import { getCurrentOwner } from "@/lib/supabase/owner";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const owner = await getCurrentOwner();
  if (!owner) redirect("/login?next=/pelanggan");
  const { id } = await params;
  const result = await getCustomerAction({ id });
  if (!result.ok && result.error.code === "not_found") notFound();
  const [account, movements] = result.ok
    ? await Promise.all([getCrateAccountAction({ id }), listCrateMovementsAction({ customerId: id, limit: 10, offset: 0 })])
    : [null, null];

  return (
    <InternalShell ownerName={owner.display_name}>
      <main className="page">
        <PageHeader
          title={result.ok ? result.data.name : "Detail pelanggan"}
          description={result.ok ? `${result.data.customerNumber}${result.data.isActive ? "" : " · Dinonaktifkan"}` : undefined}
        />
        {!result.ok ? <ErrorState {...result.error} retryHref={`/pelanggan/${id}`}/> : <>
          <CustomerForm customer={result.data}/>
          <section className="operations-section">
            <h2>Peti</h2>
            {!account ? null : !account.ok ? <ErrorState {...account.error} retryHref={`/pelanggan/${id}`}/> : <>
              <p className="delivery-meta">Saldo peti saat ini <strong className="crate-balance">{formatCrate(account.data.balanceMilli)}</strong>.</p>
              <CrateReturnForm accounts={[{ customerId: account.data.customerId, customerName: account.data.customerName, balanceMilli: account.data.balanceMilli }]} fixedCustomerId={id}/>
              {movements?.ok && movements.data.length > 0 && <div className="data-list">{movements.data.map((movement) => (
                <div className="data-row" key={movement.id}>
                  <div><strong>{movementLabels[movement.type]}</strong><span>{movement.occurredAt}{movement.notes ? ` · ${movement.notes}` : ""}</span></div>
                  <div className="row-end"><strong className="crate-balance">{formatCrate(movement.crateQuantityMilli)}</strong><span>{movement.type === "out" ? "Bertambah" : "Berkurang"}</span></div>
                </div>
              ))}</div>}
            </>}
          </section>
        </>}
      </main>
    </InternalShell>
  );
}
