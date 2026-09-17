# Roadmap Implementasi MVP

Roadmap ini membagi implementasi menjadi fase yang memiliki batas dan exit criteria eksplisit.

| Fase | Status | Ruang lingkup | Exit criteria |
| --- | --- | --- | --- |
| F0 — Fondasi teknis | Selesai | Next.js, TypeScript strict, Supabase SSR, Drizzle, testing, CI | Scaffold dapat di-install, lint, typecheck, test, dan build pada runtime yang didukung. |
| F1 — Data inti + autentikasi | Dalam proses | Schema relasional, migration awal, login/reset/logout, guard area internal | Migration tervalidasi; sesi owner dan redirect aman teruji; seluruh quality gate lulus. |
| F2 — Pelanggan + penjualan | Dalam proses | CRUD pelanggan dan transaksi penjualan | UAT-01 sampai UAT-03 dan invariant subtotal/backdate/idempotensi lulus. |
| F3 — Pembayaran + pengiriman + peti | Dalam proses | Pembayaran bertahap, delivery parsial, saldo peti | UAT-04 sampai UAT-06 lulus tanpa menggabungkan status pembayaran/pengiriman. |
| F4 — Pengeluaran + modal | Dalam proses | Kategori pengeluaran, modal masuk, prive | Implementasi dan UAT lokal selesai; acceptance cloud UAT-07 dan UAT-08 masih pending. |
| F5 — Dashboard + struk + laporan | Dalam proses | Metrik periode, tindakan, print, CSV | Dashboard arus operasi selesai dan tervalidasi lokal; UAT-09, A4/thermal, dan formula laporan lengkap masih pending. |
| F6 — Koreksi/audit + hardening + rilis | Pending | Koreksi immutable, audit, keamanan, observability, backup/release | UAT-10 sampai UAT-12 lulus; tidak ada finding critical/high; restore dan release tervalidasi. |

Status F1 tetap **Dalam proses** sampai acceptance test/UAT lingkungan Supabase selesai; repository hanya menyediakan implementasi dan pengujian lokal tanpa provisioning cloud.

F2 kini menyediakan kontrak Zod, kalkulasi presisi, service/repository transaksional, server actions typed, idempotensi seluruh mutasi, serta UI responsif untuk pelanggan dan penjualan. Pengujian lokal mencakup kalkulasi per peti/per kg, pilihan lunas/DP/utang, validasi, retry/double-submit, draft lokal, CRUD/arsip pelanggan, dan state utama. Status tetap **Dalam proses** sampai UAT-01 sampai UAT-03 dijalankan pada lingkungan Supabase nyata; cetak struk tetap bagian F5.

F3 menyediakan pencatatan pembayaran bertahap, pengiriman parsial dengan penerimaan bertahap, dan saldo peti per pelanggan. Aturan yang berlaku: pembayaran tidak boleh melebihi sisa piutang, status pembayaran dihitung ulang dari agregat pembayaran, penerimaan tidak boleh melebihi rencana pengiriman, pengembalian peti tidak boleh melebihi saldo, dan status pembayaran serta status pengiriman tidak saling mengunci. Peti keluar dicatat saat penjualan dikonfirmasi, bukan saat pengiriman, karena saldo peti harus benar walau pengiriman tidak pernah dicatat; baris `adjustment` pada `crate_movements` belum dihitung sampai semantiknya ditetapkan di F6. Seluruh mutasi F3 membawa `idempotencyKey` dengan unique index di `payments`, `deliveries`, `crate_movements`, dan `audit_events`. Status tetap **Dalam proses** sampai UAT-04 sampai UAT-06 dijalankan pada lingkungan Supabase nyata.

F4 menyediakan kategori pengeluaran, pencatatan modal masuk, dan prive dalam koleksi terpisah beserta filter periode. Lapisan domain, migration, repository PostgreSQL, service, server actions, UI `/pengeluaran`, `/pengeluaran/baru`, dan `/pengaturan`, idempotensi, serta audit atomik sudah tersedia. UAT-07 dan UAT-08 lulus pada Supabase lokal: pembelian telur dan biaya operasional tersimpan sebagai pengeluaran, sedangkan modal/prive hanya masuk `capital_movements`. Upload bukti ditunda sampai kebijakan bucket privat, retensi, dan akses ditetapkan. Status tetap **Dalam proses** sampai acceptance pada lingkungan Supabase cloud/deployment selesai.

F5 dimulai dengan dashboard arus operasi `/dashboard`: total pembayaran pelanggan sebagai uang masuk, pengeluaran usaha, dan arus kas operasi disajikan untuk pilihan 7/30/90 hari. Grafik harian, ringkasan metrik, loading/error/empty state, tampilan desktop/mobile, repository PostgreSQL, service, server action, serta pengujian domain/service/repository/komponen sudah tersedia. Modal masuk dan prive sengaja dikecualikan dari grafik agar tidak dianggap pendapatan atau biaya usaha. Verifikasi Supabase lokal pada data nyata menghasilkan uang masuk Rp2.000.000, pengeluaran Rp1.175.000, dan arus kas operasi Rp825.000. Status tetap **Dalam proses** karena daftar tindakan, estimasi laba/piutang, struk A4/thermal, laporan periode lengkap, ekspor CSV, dan UAT-09 belum selesai.
