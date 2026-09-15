import { redirect } from "next/navigation";
import { logout } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";
export default async function DashboardPage() { const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect("/login"); return <main className="dashboard"><section><p className="eyebrow">AREA INTERNAL</p><h1>Selamat datang, Owner</h1><p>Sesi aktif sebagai <strong>{user.email ?? "owner"}</strong>.</p><p>Fase ini menyiapkan autentikasi dan fondasi data. Fitur operasional akan hadir pada fase berikutnya.</p><form action={logout}><button type="submit">Keluar</button></form></section></main>; }
