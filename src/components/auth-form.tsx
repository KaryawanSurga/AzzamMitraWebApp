"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { AuthState } from "@/app/auth/actions";

type Props = { action: (state: AuthState, data: FormData) => Promise<AuthState>; mode: "login" | "forgot" | "reset"; next?: string };

export function AuthForm({ action, mode, next }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  return <form action={formAction} className="auth-form">
    {mode !== "reset" && <label>Email<input name="email" type="email" autoComplete="email" required /></label>}
    {mode !== "forgot" && <label>{mode === "reset" ? "Kata sandi baru" : "Kata sandi"}<input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required /></label>}
    {next && <input type="hidden" name="next" value={next} />}
    {state.error && <p role="alert" className="error">{state.error}</p>}
    {state.success && <p role="status" className="success">{state.success}</p>}
    <button type="submit" disabled={pending}>{pending ? "Memproses…" : mode === "login" ? "Masuk" : mode === "forgot" ? "Kirim tautan reset" : "Perbarui kata sandi"}</button>
    {mode === "login" && <Link href="/forgot-password">Lupa kata sandi?</Link>}
    {mode !== "login" && <Link href="/login">Kembali ke login</Link>}
  </form>;
}
