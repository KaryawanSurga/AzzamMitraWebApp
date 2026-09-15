import { redirect } from "next/navigation";
import { login } from "@/app/auth/actions";
import { AuthForm } from "@/components/auth-form";
import { safeInternalRedirect } from "@/lib/auth/redirect";
import { getCurrentOwner } from "@/lib/supabase/owner";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const owner = await getCurrentOwner();
  if (owner) redirect("/dashboard");
  const next = safeInternalRedirect((await searchParams).next);
  return <main className="auth-page"><section className="auth-card"><p className="eyebrow">AZZAM MITRA</p><h1>Masuk ke area owner</h1><p>Kelola operasional usaha Anda dengan sesi yang aman.</p><AuthForm action={login} mode="login" next={next} /></section></main>;
}
