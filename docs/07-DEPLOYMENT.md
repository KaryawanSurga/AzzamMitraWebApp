# Panduan Deployment Cloud

Target: **Vercel** (Next.js) + **Supabase Cloud** (PostgreSQL + Auth). Panduan ini belum dijalankan pada akun produksi; ikuti berurutan dan catat hasil acceptance.

## Prasyarat

- Akun Supabase dan Vercel.
- Repository GitHub terhubung (`KaryawanSurga/AzzamMitraWebApp`).
- Node.js 22.14+ untuk menjalankan migration dari lokal.

## 1. Siapkan Supabase Cloud

1. Buat project baru; simpan region dan database password.
2. Authentication → Providers → aktifkan **Email/Password**.
3. Salin kredensial dari Project Settings → API:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only, jangan pernah diberi prefix `NEXT_PUBLIC_`)
4. Ambil `DATABASE_URL` dari Connection String:
   - **Session pooler** (port `5432` pada host `aws-0-<region>.pooler.supabase.com`) untuk serverless; hindari direct connection karena IPv6.
   - Transaction pooler (port `6543`) tidak dipakai karena driver `pg` memakai prepared statement.
5. Authentication → URL Configuration:
   - Site URL: domain produksi Vercel.
   - Redirect URLs: `https://<domain>/auth/callback`, `https://<domain>/auth/callback?next=/reset-password`.

## 2. Terapkan migration

Dari mesin lokal (Docker tidak diperlukan):

```bash
DATABASE_URL="<session-pooler-url>" npm run db:migrate
```

Periksa SQL terbaru di `drizzle/` sebelum menjalankan pada database produksi. Baseline F1 mengaktifkan RLS pada seluruh tabel aplikasi tanpa policy client.

## 3. Provision owner pertama

1. Authentication → Users → **Add user** (email + password, konfirmasi email).
2. Salin UUID user, lalu di SQL Editor:

```sql
insert into public.users(id, email, display_name)
values ('<uuid-user>', '<email-owner>', '<nama-owner>');
```

Identity tanpa baris `public.users` ditolak dari area internal.

## 4. Deploy ke Vercel

1. Import repository; framework terdeteksi Next.js; Node.js 22.x.
2. Set environment untuk Production (dan Preview bila perlu):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `DATABASE_URL` (session pooler)
3. Deploy. Build tidak menyentuh database saat kompilasi.
4. Tambahkan domain produksi ke Supabase URL Configuration bila memakai domain kustom.

## 5. Smoke test setelah deploy

1. Login owner dan reset password.
2. Catat penjualan lunas, lalu penjualan DP/utang.
3. Catat pembayaran, pengiriman sebagian, dan pengembalian peti.
4. Koreksi dan batalkan satu invoice; pastikan riwayat audit muncul dan nomor tidak dipakai ulang.
5. Buka struk A4 dan thermal; cetak/simpan PDF dari HP.
6. Buka `/laporan`, unduh CSV, dan cocokkan angka dengan dashboard.
7. Catat pengeluaran dan modal/prive; pastikan tidak masuk metrik operasional.
8. Coba login salah 6 kali; pastikan pesan rate limit muncul.

## 6. Backup dan monitoring

- Aktifkan backup harian/PITR pada paket Supabase yang dipakai.
- Uji restore berkala ke project staging: `npm run db:backup`/`db:restore` atau menu Supabase.
- Log terstruktur sudah aktif; hubungkan Sentry saat DSN tersedia dengan menambahkan pengiriman di `src/server/observability.ts`.
- Pantau error rate dan latensi di dashboard Vercel.

## 7. Rollback

- Aplikasi: promote deployment Vercel sebelumnya.
- Database: migration bersifat maju; jangan rollback schema. Pulihkan dari backup/PITR bila terjadi kerusakan data.
- Perbaikan data memakai koreksi/pembatalan aplikasi agar audit tetap utuh.

## Checklist rilis cloud

- [ ] Migration terbaru diterapkan lewat session pooler.
- [ ] Owner pertama punya baris `public.users`.
- [ ] Empat environment variable terpasang di Vercel.
- [ ] Redirect URL auth mengarah ke domain produksi.
- [ ] Smoke test langkah 5 lulus.
- [ ] Backup/PITR aktif dan satu restore drill berhasil.
- [ ] Tidak ada finding keamanan critical/high.
