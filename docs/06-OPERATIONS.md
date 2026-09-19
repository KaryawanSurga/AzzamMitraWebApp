# Operasional, Backup, dan Rilis

Dokumen ini melengkapi roadmap F6: prosedur yang harus dijalankan sebelum dan sesudah rilis, dengan batas jelas antara verifikasi lokal dan acceptance cloud.

## Backup dan restore

Prasyarat: PostgreSQL client (`pg_dump`, `pg_restore`) tersedia di `PATH`, dan `DATABASE_URL` menunjuk database yang dituju.

```bash
npm run db:backup                          # membuat backups/azzam-mitra-<stempel>.dump
CONFIRM_RESTORE=yes npm run db:restore -- backups/azzam-mitra-<stempel>.dump
```

Aturan:

- Backup otomatis memakai format custom Supabase-compatible dan tidak menyertakan owner (`--no-owner`).
- Restore selalu meminta `CONFIRM_RESTORE=yes` karena menimpa data pada `DATABASE_URL`.
- Folder `backups/` diabaikan git; jangan menyimpan dump berisi data produksi di repository.
- Data demo harus memakai project/database terpisah dari production.

Validasi restore (wajib sebelum rilis besar):

1. Siapkan database kosong terpisah (bukan production), jalankan restore.
2. Jalankan `npm run db:migrate` untuk memastikan migration terbaru cocok.
3. Bandingkan jumlah baris tabel inti (`sales`, `payments`, `expenses`, `crate_movements`, `audit_events`) dengan sumber.
4. Buka `/laporan` pada periode contoh dan pastikan angka sama dengan sumber.

### Supabase lokal tanpa pg_dump di host

Jika PostgreSQL client tidak terpasang di host, jalankan dump/restore lewat container:

```bash
MSYS_NO_PATHCONV=1 docker exec supabase_db_Azzam_Mitra_Webapp pg_dump -U postgres -d postgres -Fc --no-owner -f /tmp/azzam.dump
docker cp supabase_db_Azzam_Mitra_Webapp:/tmp/azzam.dump backups/azzam-mitra-lokal.dump
MSYS_NO_PATHCONV=1 docker exec supabase_db_Azzam_Mitra_Webapp psql -U postgres -c "create database azzam_restore_check"
MSYS_NO_PATHCONV=1 docker exec supabase_db_Azzam_Mitra_Webapp pg_restore -U postgres -d azzam_restore_check --no-owner --no-privileges /tmp/azzam.dump
MSYS_NO_PATHCONV=1 docker exec supabase_db_Azzam_Mitra_Webapp psql -U postgres -c "drop database azzam_restore_check"
```

Hasil validasi 2026-09-18 pada Supabase lokal: seluruh 11 tabel aplikasi memiliki jumlah baris identik antara sumber dan hasil restore (users 1, customers 4, sales 4, sale_items 4, payments 5, deliveries 1, crate_movements 5, expenses 2, capital_movements 2, adjustments 4, audit_events 21). Peringatan restore hanya pada skema internal Supabase (`vault.secrets`), bukan tabel aplikasi.

## Acceptance database nyata

```bash
npm run uat:db
```

Menjalankan alur penjualan, koreksi, pembatalan, riwayat audit, dan pelaporan terhadap `DATABASE_URL` nyata. Test di-skip pada `npm test` biasa dan pada CI tanpa database UAT. Tanggal 2026-09-18 alur ini lulus pada Supabase lokal, dan halaman `/dashboard`, `/laporan`, detail invoice (aktif dan batal), struk, serta ekspor CSV diverifikasi lewat sesi owner.

## Checklist rilis

1. `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` hijau di commit yang akan dirilis.
2. `npm run db:generate` tidak menghasilkan migration baru (schema dan snapshot sinkron).
3. Jalankan `npm run db:migrate` pada staging; periksa SQL migration baru terlebih dahulu.
4. Jalankan smoke test: login owner, catat penjualan, catat pembayaran, koreksi/batalkan invoice, buka struk, unduh CSV laporan.
5. Simpan backup sebelum migration production.
6. Tandai rilis dengan tag `vX.Y.Z`; workflow `release.yml` membuat GitHub Release setelah seluruh quality gate lulus.
7. Catat perubahan pada deskripsi rilis dan tautkan ke dokumentasi terkait.

## Riwayat rilis

- `v0.1.0` (2026-09-18): rilis pertama F0-F6. Workflow Release menjalankan lint, typecheck, test, dan build di runner lalu membuat GitHub Release otomatis. Validasi lokal: UAT-09/UAT-10, restore PostgreSQL, dan smoke test UI lulus.
- Deployment produksi (2026-09-19): aplikasi live di `https://azzam-mitra-webapp.vercel.app` (Vercel, tim al-dev3) dengan database Supabase Cloud `thdzlietazriyexhnadd` (region Seoul). Migration 7/7 diterapkan, empat env produksi terpasang (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` session pooler). Smoke test login + dashboard + PWA + manifest lulus; data uji dibersihkan dan hanya akun owner client yang tersisa.
- Sisa sebelum produksi penuh: set URL auth Supabase ke domain produksi, konfigurasi SMTP untuk reset password mandiri, dan revoke token deploy sementara.

## Monitoring dan observability

- `src/server/observability.ts` menulis log terstruktur JSON dan membuang field sensitif (password, token, secret, cookie).
- Kegagalan repository yang tidak terduga otomatis tercatat sebagai `repository.unavailable` lewat `toRepositoryError`.
- Integrasi Sentry (ADR-001) belum dipasang; saat DSN tersedia, hubungkan di `logServerEvent`/`reportServerError` tanpa mengubah pemanggil.
- Jangan mencatat kredensial, token sesi, atau isi bukti pembayaran pada log.

## Keamanan

- Header keamanan dasar diatur di `next.config.ts` (nosniff, frame DENY, referrer policy, permissions policy).
- Semua route internal memverifikasi sesi owner di server; tabel public memakai RLS tanpa policy client.
- Rate limit login (5 percobaan/15 menit per alamat+email) dan mutasi (per owner) bersifat in-memory per instance. Pada deployment multi-instance, tambahkan rate limit di edge/WAF atau berbasis database.
- Rotasi secret Supabase service role dan `DATABASE_URL` berkala; service role hanya boleh dipakai server.
- Bukti pembayaran/pengeluaran menunggu bucket privat + signed URL; kolom `evidence_path` sudah disiapkan dan tidak diisi dari client.

## Batas verifikasi

- Seluruh pengujian di repository berjalan lokal (Vitest + PGlite). Acceptance UAT-01 sampai UAT-12 pada Supabase cloud/deployment tetap wajib sebelum produksi.
- Validasi backup/restore pada dokumen ini baru tervalidasi saat dijalankan pada environment ber-PostgreSQL nyata.
