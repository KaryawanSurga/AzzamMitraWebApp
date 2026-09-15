# Technical Specification — Webapp Operasional

## ADR-001: Stack aplikasi

**Context:** aplikasi membutuhkan login, transaksi relasional, laporan, audit, dan UI responsif.

**Options:** Next.js/TypeScript/PostgreSQL; Laravel/PostgreSQL; Firebase.

**Decision:** Next.js + TypeScript, PostgreSQL melalui Supabase, Supabase Auth, Drizzle ORM, Zod, Tailwind CSS, Radix/shadcn, React Hook Form, Vitest/Testing Library, Vercel, dan Sentry.

**Trade-off:** stack satu bahasa mempercepat delivery; PostgreSQL lebih tepat untuk invoice/pembayaran daripada database dokumen. Ada ketergantungan layanan Supabase/Vercel, tetapi dapat dimulai dari free tier.

## ADR-002: Batas Supabase

Supabase menyediakan PostgreSQL dan autentikasi. Logika invoice, pembayaran, status, validasi, idempotency, laporan, dan audit berjalan di backend Next.js; client tidak menulis tabel finansial secara langsung.

## Model data minimum

- `users`
- `customers`
- `sales`
- `sale_items`
- `payments`
- `deliveries`
- `crate_movements`
- `expenses`
- `capital_movements`
- `adjustments`
- `audit_events`

Semua nominal disimpan sebagai integer rupiah atau decimal terdefinisi; berat memakai decimal, bukan float. Record finansial memiliki ID internal, nomor tampilan unik, timestamp UTC, dan representasi Asia/Jakarta di UI.

## Invariant

- `subtotal = pricing_quantity × unit_price` berdasarkan satu dasar harga.
- Harga, satuan, dan kuantitas disimpan sebagai snapshot.
- Total pembayaran valid tidak boleh negatif; refund/koreksi memakai event tersendiri.
- Status pembayaran diturunkan dari total, agregat pembayaran, dan jatuh tempo.
- Peti kembali tidak boleh melebihi saldo peti pelanggan.
- Backdate tidak boleh lebih dari satu tahun dari tanggal server.
- Invoice terkonfirmasi tidak dihapus dan nomornya tidak dipakai ulang.

## Keamanan

- Semua route internal memerlukan sesi owner.
- Validasi dan otorisasi dilakukan server-side.
- Cookie aman, CSRF protection sesuai pola framework, rate limit mutasi/login, dan rotasi secret.
- Bukti pembayaran/pengeluaran memakai storage privat dan signed URL singkat.
- Log tidak merekam password, token, atau data pribadi berlebihan.

## Ketahanan koneksi

- Draft form disimpan lokal dengan versi schema dan masa berlaku.
- Mutasi memakai idempotency key.
- Error koneksi mempertahankan input dan menawarkan retry eksplisit.
- Transaksi tidak dianggap berhasil sebelum server mengonfirmasi.

## Struk dan ekspor

- Struk adalah route server-rendered dengan stylesheet print A4 dan thermal generik.
- PDF memakai dialog print browser pada MVP.
- CSV dihasilkan server sesuai filter dan formula laporan yang sama dengan UI.

## Quality gates

- Lint, typecheck, unit test, integration test, dan production build lolos.
- Test aturan subtotal, pembayaran/status, backdate, peti, pembatalan, idempotency, dan otorisasi.
- UI test untuk mobile, empty/error/loading/offline/session expired, dan print.
- Backup/restore diuji; data demo terpisah dari production.
- Tidak ada finding keamanan critical/high sebelum produksi.
