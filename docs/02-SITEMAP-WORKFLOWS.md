# Sitemap dan Workflows — Webapp Operasional

## Sitemap

- `/login`
- `/dashboard`
- `/penjualan`
- `/penjualan/baru`
- `/penjualan/[id]`
- `/pelanggan`
- `/pelanggan/[id]`
- `/pengeluaran`
- `/pengeluaran/baru`
- `/peti`
- `/laporan`
- `/pengaturan`

## Navigasi utama

Mobile memakai bottom navigation untuk Dashboard, Penjualan, Pengeluaran, Pelanggan, dan Peti. Desktop memakai sidebar yang sama; modal/prive tersedia dari halaman Pengeluaran menuju `/pengaturan`. Aksi cepat **Catat Penjualan** dan **Catat Pengeluaran** selalu mudah ditemukan.

## Penjualan baru

1. Pilih/tambah pelanggan.
2. Isi jumlah peti dan/atau berat aktual.
3. Pilih dasar harga: per peti atau per kg.
4. Isi harga, diskon/biaya, pengiriman, dan catatan.
5. Pilih Lunas, DP, atau Utang; field relevan muncul progresif.
6. Tinjau total, pembayaran awal, sisa, dan jatuh tempo.
7. Konfirmasi; server membuat invoice dan audit event.
8. Buka/cetak/bagikan struk.

## Pembayaran bertahap

1. Buka invoice.
2. Pilih **Catat Pembayaran**.
3. Isi nominal, tanggal, metode, dan catatan/bukti opsional.
4. Server memvalidasi dan menghitung ulang status serta sisa piutang.

## Pengiriman bertahap

1. Buka invoice dan pilih update pengiriman.
2. Catat jumlah peti yang dikirim/diterima dan waktu.
3. Status menjadi sebagian atau diterima sesuai agregat.
4. Peti yang dibawa pelanggan menambah saldo peti pelanggan.

## Peti kembali

1. Buka pelanggan atau halaman Peti.
2. Pilih **Catat Peti Kembali**.
3. Masukkan jumlah dan tanggal.
4. Sistem menolak nilai yang melebihi saldo pelanggan.

## Pengeluaran

Isi tanggal, kategori, nominal, metode opsional, catatan, dan bukti opsional. Pembelian telur adalah kategori pengeluaran, bukan modul pembelian/stok.

## Koreksi

Transaksi terkonfirmasi dikoreksi atau dibatalkan dari detail, dengan alasan wajib dan konfirmasi dampak. Nomor invoice lama tetap tersimpan dan ditandai batal/koreksi.

## State UI wajib

Setiap layar memiliki loading, empty, error, offline/retry, success, validasi field, dan session-expired state. Submit ganda dicegah tanpa menghapus input.
