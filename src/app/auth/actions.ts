"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { loginErrorMessage } from "@/lib/auth/error";
import { safeInternalRedirect } from "@/lib/auth/redirect";
import { consumeRateLimit } from "@/server/rate-limit";

export type AuthState = { error?: string; success?: string };
const credentialsSchema = z.object({ email: z.email(), password: z.string().min(8) });
const WINDOW_MS = 15 * 60_000;

async function clientAddress(): Promise<string> {
  const list = await headers();
  return list.get("x-forwarded-for")?.split(",")[0]?.trim() || list.get("x-real-ip") || "local";
}

export async function login(_state: AuthState, formData: FormData): Promise<AuthState> {
  const rawEmail = String(formData.get("email") ?? "").toLowerCase();
  const gate = consumeRateLimit(`login:${await clientAddress()}:${rawEmail}`, 5, WINDOW_MS);
  if (!gate.allowed) return { error: `Terlalu banyak percobaan masuk. Coba lagi dalam ${Math.ceil(gate.retryAfterSeconds / 60)} menit.` };
  const parsed = credentialsSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Email atau kata sandi tidak valid." };
  const supabase = await createClient();
  try {
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) return { error: loginErrorMessage(error) };
  } catch {
    return { error: loginErrorMessage({}) };
  }
  redirect(safeInternalRedirect(formData.get("next")?.toString()));
}

export async function requestPasswordReset(_state: AuthState, formData: FormData): Promise<AuthState> {
  const email = z.email().safeParse(formData.get("email"));
  if (!email.success) return { error: "Masukkan alamat email yang valid." };
  const gate = consumeRateLimit(`reset:${await clientAddress()}:${email.data.toLowerCase()}`, 3, WINDOW_MS);
  if (!gate.allowed) return { error: `Terlalu banyak permintaan. Coba lagi dalam ${Math.ceil(gate.retryAfterSeconds / 60)} menit.` };
  const origin = (await headers()).get("origin");
  if (!origin) return { error: "Permintaan tidak dapat diproses. Silakan coba lagi." };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: `${origin}/auth/callback?next=/reset-password` });
  return { success: "Jika email terdaftar, tautan pengaturan ulang telah dikirim." };
}

export async function updatePassword(_state: AuthState, formData: FormData): Promise<AuthState> {
  const password = z.string().min(8).safeParse(formData.get("password"));
  if (!password.success) return { error: "Kata sandi minimal 8 karakter." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) return { error: "Kata sandi gagal diperbarui. Minta tautan baru dan coba lagi." };
  return { success: "Kata sandi berhasil diperbarui. Anda dapat kembali ke dashboard." };
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
