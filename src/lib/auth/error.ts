export type AuthFailure = {
  code?: string;
  status?: number;
};

export function loginErrorMessage(error: AuthFailure): string {
  if (error.code === "invalid_credentials") {
    return "Email atau kata sandi salah. Silakan coba lagi.";
  }
  if (error.code === "over_request_rate_limit" || error.status === 429) {
    return "Terlalu banyak percobaan masuk. Tunggu beberapa menit lalu coba lagi.";
  }
  return "Layanan autentikasi belum tersedia. Periksa koneksi Supabase lalu coba lagi.";
}
