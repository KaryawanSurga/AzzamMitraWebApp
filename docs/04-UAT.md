# User Acceptance Testing — Webapp Operasional

## Prasyarat

- Environment UAT dan akun owner tersedia.
- Data contoh tidak bercampur dengan production.
- Zona waktu Asia/Jakarta dan mata uang IDR.
- Uji minimal pada HP Android kecil dan laptop modern.

## Skenario inti

### UAT-01 — Penjualan lunas per peti

Given pelanggan Budi tersedia, when owner menjual 10 peti dengan harga per peti dan membayar penuh, then invoice unik, subtotal benar, status Lunas, dan struk dapat dicetak.

### UAT-02 — Penjualan per kg dengan DP

Given item mencatat 10 peti dan 103,5 kg, when dasar harga kg dan DP dipilih, then subtotal hanya memakai kg × harga/kg, status Sebagian, serta sisa piutang benar.

### UAT-03 — Utang dan jatuh tempo

Given invoice belum dibayar, when jatuh tempo lewat, then status berubah menjadi Terlambat tanpa mengubah status pengiriman.

### UAT-04 — Pembayaran bertahap

Given invoice memiliki sisa piutang, when beberapa pembayaran tunai/transfer dicatat, then riwayat, agregat, sisa, dan status akurat serta klik ganda tidak menduplikasi pembayaran.

### UAT-05 — Pengiriman sebagian

Given pesanan 10 peti, when 6 lalu 4 peti diterima, then status bergerak dari Diantar Sebagian ke Diterima dan pembayaran tetap independen.

### UAT-06 — Peti keluar dan kembali

Given 10 peti berada di Budi, when 6 dikembalikan, then saldo menjadi 4; sistem menolak pengembalian melebihi saldo.

### UAT-07 — Pengeluaran

When pembelian telur dan biaya operasional dicatat, then keduanya masuk kategori pengeluaran dan laporan periode yang benar tanpa membuat stok/HPP.

### UAT-08 — Modal dan prive

When setoran owner dan pengambilan pribadi dicatat, then keduanya terpisah dari pendapatan serta biaya usaha.

### UAT-09 — Laporan

Given saldo awal nol dan transaksi campuran, when periode dipilih, then omzet, uang masuk, pengeluaran, arus kas, estimasi laba bersih, piutang, dan CSV sesuai sumber; tidak ada metrik stok/HPP/utang pemasok.

### UAT-10 — Koreksi dan audit

Given invoice terkonfirmasi, when owner membatalkan atau mengoreksi dengan alasan, then data awal tetap terlacak, nomor tidak dipakai ulang, dan audit menyimpan siapa/kapan/perubahan.

### UAT-11 — Backdate

Then tanggal sampai satu tahun diterima dan tanggal lebih lama ditolak dengan pesan spesifik.

### UAT-12 — Gangguan internet

When koneksi putus saat form terisi, then input tetap ada, kegagalan jelas, retry tersedia, dan hanya satu transaksi dibuat setelah berhasil.

## Pemeriksaan UX

- Aksi utama selesai tanpa zoom/horizontal scroll pada HP.
- Label, format IDR/kg, validasi, loading, error, empty, dan session-expired jelas.
- Badge transaksi, pembayaran, dan pengiriman tidak digabung.
- Print terbaca pada A4 dan thermal generik.

## Exit criteria

- Seluruh skenario inti lulus.
- Tidak ada defect critical/high.
- Build production, backup/restore, autentikasi, audit, dan monitoring telah diverifikasi.

## Cakupan otomatis saat ini

- UAT-01..09: invarian domain, service, dan repository teruji lokal (Vitest + PGlite); eksekusi manual pada environment UAT tetap wajib.
- UAT-10: kontrak domain koreksi/pembatalan, service, komponen, integrasi repository PGlite, dan acceptance pada Supabase lokal (`npm run uat:db`) termasuk audit before/after serta verifikasi UI dashboard/laporan/detail invoice/struk/CSV.
- UAT-11: `validateTransactionDate` untuk batas satu tahun dan penolakan tanggal masa depan, termasuk di service F3.
- UAT-12: skema draft dengan versi dan masa berlaku, pemulihan draft, pembersihan setelah sukses, dan idempotensi mutasi.
- Backup/restore: script dengan guard teruji; dump/restore tervalidasi pada Supabase lokal via container dengan jumlah baris identik di 11 tabel aplikasi (2026-09-18). Validasi pada database deployment tetap wajib sebelum produksi.
