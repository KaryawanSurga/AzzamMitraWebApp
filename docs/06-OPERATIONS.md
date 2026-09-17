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

## Checklist rilis

1. `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` hijau di commit yang akan dirilis.
2. `npm run db:generate` tidak menghasilkan migration baru (schema dan snapshot sinkron).
3. Jalankan `npm run db:migrate` pada staging; periksa SQL migration baru terlebih dahulu.
4. Jalankan smoke test: login owner, catat penjualan, catat pembayaran, koreksi/batalkan invoice, buka struk, unduh CSV laporan.
5. Simpan backup sebelum migration production.
6. Tandai rilis dengan tag `vX.Y.Z`; workflow `release.yml` membuat GitHub Release setelah seluruh quality gate lulus.
7. Catat perubahan pada deskripsi rilis dan tautkan ke dokumentasi terkait.

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
