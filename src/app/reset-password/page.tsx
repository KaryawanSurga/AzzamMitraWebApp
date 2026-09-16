import { redirect } from "next/navigation";
import { updatePassword } from "@/app/auth/actions";
import { AuthForm } from "@/components/auth-form";
import { createClient } from "@/lib/supabase/server";
import { BrandMark } from "@/components/brand-mark";
export default async function ResetPasswordPage() { const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect("/login"); return <main className="auth-page"><section className="auth-card"><div className="auth-brand"><BrandMark size={30} /><strong>AZZAM MITRA</strong></div><h1>Atur kata sandi baru</h1><AuthForm action={updatePassword} mode="reset" /></section></main>; }
