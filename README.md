# Azzam Mitra Webapp

Fondasi Fase 1 serta implementasi operasional Fase 2–5 Azzam Mitra: autentikasi owner, pelanggan, penjualan, pembayaran, pengiriman, peti, pengeluaran, modal/prive, dan dashboard arus operasi dengan UI responsif.

## Prasyarat

- Node.js 22.14 atau lebih baru (CI memakai versi minimum 22.14)
- npm 10 atau lebih baru
- PostgreSQL/Supabase hanya diperlukan saat menjalankan code path database

## Menjalankan secara lokal

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Buka `http://localhost:3000`. Shell awal dan production build tidak mengakses database atau membutuhkan secret production. Ganti nilai contoh di `.env.local` sebelum memakai Supabase atau database.

### Supabase lokal

Docker Desktop harus aktif. Jalankan stack dan migration dengan:

```bash
npx supabase start
npm run db:migrate
```

Perbarui nilai Supabase pada `.env.local` dari output `npx supabase status`. Script database otomatis membaca `.env.local`; environment proses tetap memiliki prioritas bila nilainya diberikan secara eksplisit.

## Setup Supabase Auth

1. Buat project Supabase dan aktifkan provider Email/Password.
2. Isi URL project, anon/publishable key, dan `SUPABASE_SERVICE_ROLE_KEY` pada `.env.local`. Service-role key hanya dipakai server untuk memastikan identity memiliki profil owner; jangan pernah memberinya prefix `NEXT_PUBLIC_` atau mengimpornya ke Client Component.
3. Di **Authentication → URL Configuration**, set Site URL lokal ke `http://localhost:3000` dan tambahkan `http://localhost:3000/auth/callback` ke Redirect URLs.
4. Terapkan seluruh migration F1, lalu buat satu user owner dari dashboard Supabase atau invitation resmi. Provision profil `public.users` melalui SQL Editor/server tepercaya dengan `id` yang sama dengan identity `auth.users`. Identity tanpa profil ini ditolak dari area internal.

Callback menukar kode PKCE menjadi sesi dan hanya meneruskan redirect internal. Route `/dashboard` diverifikasi ulang di Server Component; proxy memperbarui cookie sesi dan melakukan redirect awal.

## Environment

| Variabel | Lingkup | Kegunaan |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server | Anon/publishable key Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Server saja | Lookup profil owner yang melewati RLS; wajib dirahasiakan |
| `DATABASE_URL` | Server saja | Koneksi PostgreSQL untuk Drizzle |

Semua environment divalidasi saat code path terkait dipanggil. Jangan memakai prefix `NEXT_PUBLIC_` untuk secret. `.env.example` hanya berisi placeholder dan aman disalin; jangan commit `.env.local`.

## Commands

```bash
npm run dev          # development server
npm run lint         # ESLint
npm run typecheck    # strict TypeScript check
npm test             # Vitest sekali jalan
npm run test:watch   # Vitest watch mode
npm run build        # production build
npm run db:generate  # generate migration dari schema Drizzle
npm run db:migrate   # apply migration (memerlukan DATABASE_URL)
npm run db:studio    # buka Drizzle Studio (memerlukan DATABASE_URL)
npm run db:backup    # dump database ke backups/ (memerlukan pg_dump)
npm run db:restore   # restore dump (memerlukan CONFIRM_RESTORE=yes)
```

Perintah Drizzle membaca `.env.local` melalui `node --env-file-if-exists`. Migration tidak pernah dijalankan otomatis saat aplikasi dimulai.

## Struktur

- `src/app` — Next.js App Router dan global styles. Halaman `/prototype` adalah contoh desain berisi data dummy tanpa autentikasi, bukan bagian alur produksi.
- `src/components` — komponen UI bersama.
- `src/config` — validasi environment public dan server.
- `src/db` — koneksi PostgreSQL lazy dan entry point schema Drizzle.
- `src/lib/supabase` — factory Supabase SSR untuk browser/server.
- `src/domain` — kontrak Zod dan kalkulasi bisnis murni tanpa floating point.
- `src/server/f2` — service dan repository pelanggan/penjualan.
- `src/server/f3` — service dan repository pembayaran/pengiriman/peti.
- `src/server/f4` — service dan repository pengeluaran/modal/prive.
- `src/server/f5` — service dan repository dashboard/laporan.
- `src/server/rate-limit.ts` dan `src/server/observability.ts` — pembatas mutasi/login dan log server terstruktur.
- `scripts` — backup/restore database (`db:backup`, `db:restore`).
- `src/test` — setup test bersama dan penerapan migration nyata ke PGlite.
- `docs` — PRD, workflow, spesifikasi teknis, UAT, roadmap, dan operasional sebagai source of truth.
- `brand` — brand kit Azzam Mitra: board, logo SVG, dan sumbernya. Token warna dan tipografi dipakai langsung oleh `src/app/globals.css`.

`npm run db:generate` hanya membandingkan file schema dengan snapshot Drizzle dan tidak membuka koneksi database. Periksa SQL di `drizzle/` sebelum menjalankan `npm run db:migrate` pada database yang dituju. Baseline migration F1 mengaktifkan RLS pada seluruh 11 tabel aplikasi tanpa policy client, sehingga role `anon`/`authenticated` ditolak secara default. Backend tepercaya tetap dapat bekerja melalui koneksi PostgreSQL atau service role. Migration tidak dijalankan otomatis dan repository tidak memuat secret.

Fase 2 menyediakan server actions di `src/app/actions/f2.ts`; semua read/mutation melewati guard owner dan mengembalikan union result typed (`validation`, `unauthorized`, `not_found`, `conflict`, atau `retryable`). Setiap mutasi pelanggan dan penjualan wajib membawa UUID `idempotencyKey`; retry mengembalikan hasil mutation pertama. Status pembayaran sale diturunkan ulang dari pembayaran, jatuh tempo, dan tanggal server Asia/Jakarta saat dibaca. Browser tetap tidak menulis tabel public secara langsung. Halaman `/dashboard`, `/pelanggan`, `/pelanggan/[id]`, `/penjualan`, `/penjualan/baru`, dan `/penjualan/[id]` sudah tersedia beserta state loading, empty, error, dan not-found.

Fase 3 menambahkan server actions di `src/app/actions/f3.ts` untuk pembayaran bertahap, pengiriman parsial, dan peti, dengan halaman `/peti` serta bagian pembayaran dan pengiriman pada detail invoice. Invariant yang dijaga server: pembayaran tidak melebihi sisa piutang, status pembayaran dihitung dari agregat pembayaran, penerimaan tidak melebihi rencana pengiriman, rencana pengiriman tidak melebihi peti pada penjualan, dan pengembalian peti tidak melebihi saldo pelanggan. Peti keluar dicatat saat penjualan dikonfirmasi. Setiap mutasi F3 membawa `idempotencyKey` yang dijaga unique index.

Fase 4 menambahkan kontrak, migration, repository transaksional, server actions, dan UI untuk pengeluaran serta modal/prive. Route `/pengeluaran` menyediakan filter periode dan route `/pengeluaran/baru` mencatat biaya usaha; route `/pengaturan` memisahkan modal masuk dan prive dari pendapatan/biaya. Mutasi F4 bersifat idempoten dan menulis audit event dalam transaksi yang sama. Bukti pengeluaran sengaja belum diunggah sampai bucket privat, retensi, dan kebijakan akses ditetapkan; kolom `evidence_path` tetap disiapkan. UAT-07 dan UAT-08 telah dijalankan pada Supabase lokal, sedangkan acceptance deployment/cloud masih pending.

Fase 5 menyediakan dashboard arus operasi responsif di `/dashboard`: pembayaran pelanggan sebagai uang masuk, pengeluaran usaha, arus kas operasi 7/30/90 hari, ringkasan penjualan/piutang/estimasi laba, serta daftar tindakan harian (jatuh tempo, pengiriman tertunda, peti belum kembali). Halaman `/laporan` menyajikan laporan periode lengkap dengan filter tanggal dan ekspor CSV dari formula yang sama, sedangkan `/penjualan/[id]/struk` mencetak struk A4 atau thermal 80 mm. Modal masuk dan prive tidak masuk metrik operasional. UAT-09 tervalidasi lokal lewat pengujian integrasi service + repository; acceptance pada Supabase cloud/deployment masih pending.

Aplikasi sudah PWA: halaman login menyediakan tombol **Install aplikasi di HP** (Android/Chrome), petunjuk Add to Home Screen untuk iPhone, manifest + ikon maskable, service worker, dan fallback offline. Deployment cukup HTTPS — tanpa Play Store dan tanpa domain kustom. Langkah lengkap ada di [panduan deployment](./docs/07-DEPLOYMENT.md).

Fase 6 menyediakan koreksi immutable: invoice terkonfirmasi dapat dikoreksi atau dibatalkan dengan alasan wajib, nomor invoice tidak dipakai ulang, dan setiap mutasi menulis `adjustments` serta audit `before`/`after` dalam transaksi yang sama. Detail invoice menampilkan riwayat koreksi dan jejak audit; invoice batal dikeluarkan dari omzet, uang masuk, dan piutang. Ditambahkan pula rate limit login/mutasi, log server terstruktur dengan redaksi data sensitif, header keamanan dasar, script backup/restore dengan guard, workflow rilis berbasis tag, serta dokumen [operasional](./docs/06-OPERATIONS.md). UAT-10 tervalidasi lokal (termasuk acceptance pada Supabase lokal via `npm run uat:db` dan verifikasi halaman dashboard/laporan/detail invoice/struk/CSV); restore tervalidasi pada PostgreSQL lokal dengan jumlah baris identik di 11 tabel aplikasi. UAT-11 (backdate) dan UAT-12 (draft/retry) sudah tercakup pengujian F2/F3. Rilis bertag `v0.1.0` dibuat 2026-09-18 lewat workflow Release setelah quality gate lulus; acceptance manual UAT-11/12 masih pending.

## Dokumentasi produk

- [Panduan dokumentasi](./docs/README.md)
- [PRD](./docs/01-PRD.md)
- [Sitemap dan workflows](./docs/02-SITEMAP-WORKFLOWS.md)
- [Technical specification](./docs/03-TECHNICAL-SPEC.md)
- [UAT](./docs/04-UAT.md)
- [Roadmap implementasi](./docs/05-IMPLEMENTATION-ROADMAP.md)
- [Operasional, backup, dan rilis](./docs/06-OPERATIONS.md)
- [Panduan deployment cloud](./docs/07-DEPLOYMENT.md)
