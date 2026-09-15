# Azzam Mitra Webapp

Fondasi Fase 1 aplikasi operasional internal Azzam Mitra: model data relasional, migration awal, autentikasi owner, dan shell dashboard terproteksi.

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

## Setup Supabase Auth

1. Buat project Supabase dan aktifkan provider Email/Password.
2. Isi URL project dan anon/publishable key pada `.env.local`. Anon key boleh berada di browser; jangan pernah menambahkan service-role key dengan prefix `NEXT_PUBLIC_`.
3. Di **Authentication → URL Configuration**, set Site URL lokal ke `http://localhost:3000` dan tambahkan `http://localhost:3000/auth/callback` ke Redirect URLs.
4. Buat satu user owner dari dashboard Supabase atau invitation resmi. Setelah migration diterapkan, buat profil `public.users` dengan `id` yang sama dengan identity `auth.users`.

Callback menukar kode PKCE menjadi sesi dan hanya meneruskan redirect internal. Route `/dashboard` diverifikasi ulang di Server Component; proxy memperbarui cookie sesi dan melakukan redirect awal.

## Environment

| Variabel | Lingkup | Kegunaan |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server | Anon/publishable key Supabase |
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
```

## Struktur

- `src/app` — Next.js App Router dan global styles.
- `src/components` — komponen UI bersama.
- `src/config` — validasi environment public dan server.
- `src/db` — koneksi PostgreSQL lazy dan entry point schema Drizzle.
- `src/lib/supabase` — factory Supabase SSR untuk browser/server.
- `src/test` — setup test bersama.
- `docs` — PRD, workflow, spesifikasi teknis, dan UAT sebagai source of truth.

`npm run db:generate` hanya membandingkan file schema dengan snapshot Drizzle dan tidak membuka koneksi database. Periksa SQL di `drizzle/` sebelum menjalankan `npm run db:migrate` pada database yang dituju. Migration tidak dijalankan otomatis dan repository tidak memuat secret.

Fase 1 belum menyediakan CRUD atau mutation data bisnis. Sesuai ADR-002, browser tidak menulis tabel finansial secara langsung; service dan aturan bisnis server-side baru dibangun pada fase berikutnya. Provisioning Supabase, akun production, RLS/policy deployment, rate limiting, monitoring, dan deployment juga berada di luar fase ini.

## Dokumentasi produk

- [Panduan dokumentasi](./docs/README.md)
- [PRD](./docs/01-PRD.md)
- [Sitemap dan workflows](./docs/02-SITEMAP-WORKFLOWS.md)
- [Technical specification](./docs/03-TECHNICAL-SPEC.md)
- [UAT](./docs/04-UAT.md)
- [Roadmap implementasi](./docs/05-IMPLEMENTATION-ROADMAP.md)
