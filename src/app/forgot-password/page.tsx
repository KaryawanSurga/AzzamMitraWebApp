import { requestPasswordReset } from "@/app/auth/actions";
import { AuthForm } from "@/components/auth-form";
import { BrandMark } from "@/components/brand-mark";
export default function ForgotPasswordPage() { return <main className="auth-page"><section className="auth-card"><div className="auth-brand"><BrandMark size={30} /><strong>AZZAM MITRA</strong></div><h1>Lupa kata sandi</h1><p>Kami akan mengirim tautan pengaturan ulang bila email terdaftar.</p><AuthForm action={requestPasswordReset} mode="forgot" /></section></main>; }
