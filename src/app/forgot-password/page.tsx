import { requestPasswordReset } from "@/app/auth/actions";
import { AuthForm } from "@/components/auth-form";
export default function ForgotPasswordPage() { return <main className="auth-page"><section className="auth-card"><p className="eyebrow">PEMULIHAN AKUN</p><h1>Lupa kata sandi</h1><p>Kami akan mengirim tautan pengaturan ulang bila email terdaftar.</p><AuthForm action={requestPasswordReset} mode="forgot" /></section></main>; }
