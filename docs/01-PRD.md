# PRD — Webapp Operasional Azzam Mitra

## Tujuan

Memudahkan owner distributor telur mencatat penjualan dan pengeluaran dari HP atau laptop, mengetahui uang masuk/keluar, mengelola piutang dan pengiriman, melacak peti pelanggan, serta menerbitkan struk digital tanpa kompleksitas ERP.

## Pengguna

Satu owner yang juga berperan sebagai admin dan kasir. Multi-user dan approval berada di luar MVP.

## Functional requirements

### Login dan dashboard

- Login owner dan reset password.
- Ringkasan penjualan, uang masuk, pengeluaran, arus kas bersih, estimasi laba bersih, dan piutang per periode.
- Daftar tindakan: belum diantar, jatuh tempo, terlambat, dan peti belum kembali.

### Pelanggan dan penjualan

- Data pelanggan: nama, WhatsApp, alamat, catatan.
- Nomor invoice unik dan tidak digunakan ulang.
- Item mencatat jumlah peti, berat aktual opsional, dasar harga per peti/per kg, harga snapshot, diskon/biaya, dan subtotal.
- Total hanya dihitung dari satu dasar harga yang dipilih.
- Penjualan dapat lunas, DP, atau utang dengan jatuh tempo.
- Beberapa pembayaran dan metode campuran didukung melalui riwayat pembayaran.

### Status

- Transaksi: Draft, Dikonfirmasi, Selesai, Dibatalkan.
- Pembayaran: Belum Dibayar, Sebagian/DP, Lunas, Jatuh Tempo, Terlambat, Refund.
- Pengiriman: Belum Diproses, Disiapkan, Siap Diantar, Dalam Perjalanan, Diantar Sebagian, Diterima, Gagal, Dibatalkan.
- Status pembayaran dihitung otomatis dari total, pembayaran, dan tanggal jatuh tempo.
- Pembayaran dan pengiriman tidak saling mengunci.

### Pengiriman dan peti

- Pengiriman penuh atau bertahap, dengan jumlah dan waktu penerimaan.
- Penjualan menambah peti di pelanggan; pengembalian mengurangi saldo peti.
- Riwayat keluar-kembali dipertahankan. Deposit, denda, dan peti rusak di luar MVP.

### Pengeluaran dan modal

- Kategori minimum: pembelian telur, transportasi/pengiriman, BBM/tol/parkir, bongkar muat, upah, kemasan/peti, perawatan, sewa/listrik/operasional, dan lainnya.
- Modal masuk dan pengambilan pribadi dicatat terpisah dari pendapatan/biaya usaha.
- Metode pembayaran hanya informasi; tidak ada saldo per kas/bank.

### Struk dan laporan

- Struk digital ramah A4 dan thermal generik, dapat dicetak/disimpan PDF browser.
- Laporan omzet, uang masuk, pengeluaran, arus kas bersih, piutang, dan estimasi laba bersih.
- Estimasi laba bersih = penjualan bersih + pendapatan lain − seluruh pengeluaran bisnis periode.
- Ekspor CSV mengikuti filter periode.

### Koreksi dan audit

- Draft boleh dihapus.
- Transaksi terkonfirmasi tidak dihapus permanen; pembatalan/koreksi memerlukan alasan.
- Audit menyimpan pelaku, waktu, nilai sebelum/sesudah, dan alasan.
- Retur, potongan, refund, dan koreksi terkait ke invoice asli; transaksi awal tidak diedit diam-diam.

## Non-functional requirements

- Mobile-first, Bahasa Indonesia, IDR, zona waktu Asia/Jakarta.
- Online-only; draft form bertahan ketika koneksi terputus dan retry tidak membuat transaksi ganda.
- Mutasi idempotent, validasi server, autentikasi, rate limiting, audit, backup, dan error monitoring.
- Transaksi backdate maksimal satu tahun berdasarkan waktu server.

## Out of scope

- Stok, grade telur, HPP, pemasok, dan utang pemasok.
- Saldo per rekening, double-entry UI, integrasi bank.
- Offline penuh, multi-user, approval, payroll, multi-cabang, printer Bluetooth khusus, dan AI prediksi.

## Trade-off laporan

Tanpa stok dan HPP, aplikasi tidak dapat menghasilkan laba akuntansi presisi. Istilah resmi di UI adalah **Estimasi Laba Bersih**.
