import { redirect } from "next/navigation";
import { login } from "@/app/auth/actions";
import { AuthForm } from "@/components/auth-form";
import { PwaInstall } from "@/components/pwa-install";
import { safeInternalRedirect } from "@/lib/auth/redirect";
import { getCurrentOwner } from "@/lib/supabase/owner";
import { BrandMark } from "@/components/brand-mark";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const owner = await getCurrentOwner();
  if (owner) redirect("/dashboard");
  const next = safeInternalRedirect((await searchParams).next);
  return <main className="auth-page"><section className="auth-card"><div className="auth-brand"><BrandMark size={30} /><strong>AZZAM MITRA</strong></div><h1>Masuk ke area owner</h1><p>Kelola operasional usaha Anda dengan sesi yang aman.</p><AuthForm action={login} mode="login" next={next} /><PwaInstall className="button-secondary pwa-install"/></section></main>;
}
