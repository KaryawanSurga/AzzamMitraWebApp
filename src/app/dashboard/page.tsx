import { redirect } from "next/navigation";
import { logout } from "@/app/auth/actions";
import { getCurrentOwner } from "@/lib/supabase/owner";
export default async function DashboardPage() { const owner = await getCurrentOwner(); if (!owner) redirect("/login"); return <main className="dashboard"><section><p className="eyebrow">AREA INTERNAL</p><h1>Selamat datang, {owner.display_name}</h1><p>Sesi aktif sebagai <strong>{owner.email}</strong>.</p><p>Fase ini menyiapkan autentikasi dan fondasi data. Fitur operasional akan hadir pada fase berikutnya.</p><form action={logout}><button type="submit">Keluar</button></form></section></main>; }
