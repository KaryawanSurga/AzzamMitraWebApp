# Roadmap Implementasi MVP

Roadmap ini membagi implementasi menjadi fase yang memiliki batas dan exit criteria eksplisit.

| Fase | Status | Ruang lingkup | Exit criteria |
| --- | --- | --- | --- |
| F0 — Fondasi teknis | Selesai | Next.js, TypeScript strict, Supabase SSR, Drizzle, testing, CI | Scaffold dapat di-install, lint, typecheck, test, dan build pada runtime yang didukung. |
| F1 — Data inti + autentikasi | Dalam proses | Schema relasional, migration awal, login/reset/logout, guard area internal | Migration tervalidasi; sesi owner dan redirect aman teruji; seluruh quality gate lulus. |
| F2 — Pelanggan + penjualan | Dalam proses | CRUD pelanggan dan transaksi penjualan | UAT-01 sampai UAT-03 dan invariant subtotal/backdate/idempotensi lulus. |
| F3 — Pembayaran + pengiriman + peti | Dalam proses | Pembayaran bertahap, delivery parsial, saldo peti | UAT-04 sampai UAT-06 lulus tanpa menggabungkan status pembayaran/pengiriman. |
| F4 — Pengeluaran + modal | Pending | Kategori pengeluaran, modal masuk, prive | UAT-07 dan UAT-08 lulus; modal/prive terpisah dari pendapatan/biaya. |
| F5 — Dashboard + struk + laporan | Pending | Metrik periode, tindakan, print, CSV | UAT-09 serta pemeriksaan A4/thermal dan formula laporan lulus. |
| F6 — Koreksi/audit + hardening + rilis | Pending | Koreksi immutable, audit, keamanan, observability, backup/release | UAT-10 sampai UAT-12 lulus; tidak ada finding critical/high; restore dan release tervalidasi. |

Status F1 tetap **Dalam proses** sampai acceptance test/UAT lingkungan Supabase selesai; repository hanya menyediakan implementasi dan pengujian lokal tanpa provisioning cloud.

F2 kini menyediakan kontrak Zod, kalkulasi presisi, service/repository transaksional, server actions typed, idempotensi seluruh mutasi, serta UI responsif untuk pelanggan dan penjualan. Pengujian lokal mencakup kalkulasi per peti/per kg, pilihan lunas/DP/utang, validasi, retry/double-submit, draft lokal, CRUD/arsip pelanggan, dan state utama. Status tetap **Dalam proses** sampai UAT-01 sampai UAT-03 dijalankan pada lingkungan Supabase nyata; cetak struk tetap bagian F5.

F3 menyediakan pencatatan pembayaran bertahap, pengiriman parsial dengan penerimaan bertahap, dan saldo peti per pelanggan. Aturan yang berlaku: pembayaran tidak boleh melebihi sisa piutang, status pembayaran dihitung ulang dari agregat pembayaran, penerimaan tidak boleh melebihi rencana pengiriman, pengembalian peti tidak boleh melebihi saldo, dan status pembayaran serta status pengiriman tidak saling mengunci. Peti keluar dicatat saat penjualan dikonfirmasi, bukan saat pengiriman, karena saldo peti harus benar walau pengiriman tidak pernah dicatat; baris `adjustment` pada `crate_movements` belum dihitung sampai semantiknya ditetapkan di F6. Seluruh mutasi F3 membawa `idempotencyKey` dengan unique index di `payments`, `deliveries`, `crate_movements`, dan `audit_events`. Status tetap **Dalam proses** sampai UAT-04 sampai UAT-06 dijalankan pada lingkungan Supabase nyata.
