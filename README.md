# Azzam Mitra Webapp

Baseline aplikasi operasional internal Azzam Mitra. Repository ini menyediakan fondasi teknis MVP; autentikasi, dashboard, dan fitur bisnis belum diimplementasikan.

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

Schema bisnis dan migration sengaja belum dibuat. Sesuai ADR-002, browser tidak akan menulis tabel finansial secara langsung; aturan bisnis dan otorisasi berada di backend Next.js.

## Dokumentasi produk

- [Panduan dokumentasi](./docs/README.md)
- [PRD](./docs/01-PRD.md)
- [Sitemap dan workflows](./docs/02-SITEMAP-WORKFLOWS.md)
- [Technical specification](./docs/03-TECHNICAL-SPEC.md)
- [UAT](./docs/04-UAT.md)
