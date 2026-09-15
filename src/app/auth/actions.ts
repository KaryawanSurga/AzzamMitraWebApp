"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { safeInternalRedirect } from "@/lib/auth/redirect";

export type AuthState = { error?: string; success?: string };
const credentialsSchema = z.object({ email: z.email(), password: z.string().min(8) });

export async function login(_state: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Email atau kata sandi tidak valid." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Email atau kata sandi salah. Silakan coba lagi." };
  redirect(safeInternalRedirect(formData.get("next")?.toString()));
}

export async function requestPasswordReset(_state: AuthState, formData: FormData): Promise<AuthState> {
  const email = z.email().safeParse(formData.get("email"));
  if (!email.success) return { error: "Masukkan alamat email yang valid." };
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
