import Link from "next/link";
import { redirect } from "next/navigation";
import { ExpenseForm } from "@/components/expense-form";
import { InternalShell } from "@/components/internal-shell";
import { PageHeader } from "@/components/ui";
import { getCurrentOwner } from "@/lib/supabase/owner";

export default async function NewExpensePage() {
  const owner = await getCurrentOwner();
  if (!owner) redirect("/login?next=/pengeluaran/baru");

  return (
    <InternalShell ownerName={owner.display_name}>
      <main className="page finance-entry-page">
        <PageHeader
          title="Catat pengeluaran"
          description="Masukkan biaya usaha. Modal masuk dan prive dicatat di halaman terpisah."
          action={<Link className="button-secondary" href="/pengeluaran">Kembali</Link>}
        />
        <ExpenseForm/>
        <p className="form-footnote">Bukti transaksi belum diunggah ke aplikasi. Simpan dokumen asli sampai kebijakan penyimpanan privat ditetapkan.</p>
      </main>
    </InternalShell>
  );
}
