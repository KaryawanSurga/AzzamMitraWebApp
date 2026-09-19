# Dokumentasi Webapp Operasional Azzam Mitra

Webapp adalah buku operasional internal distributor telur untuk satu owner yang sekaligus bertindak sebagai admin dan kasir. Fokusnya adalah pencatatan cepat penjualan dan pengeluaran, piutang, pengiriman, peti pelanggan, struk, serta laporan sederhana.

## Dokumen

1. [PRD](./01-PRD.md)
2. [Sitemap dan workflows](./02-SITEMAP-WORKFLOWS.md)
3. [Technical specification](./03-TECHNICAL-SPEC.md)
4. [UAT](./04-UAT.md)
5. [Roadmap implementasi](./05-IMPLEMENTATION-ROADMAP.md)
6. [Operasional, backup, dan rilis](./06-OPERATIONS.md)
7. [Panduan deployment cloud](./07-DEPLOYMENT.md)
8. [Panduan owner (untuk client)](./08-PANDUAN-OWNER.md)

## Keputusan baseline

- Online-only dengan draft lokal saat koneksi terganggu.
- Penjualan memakai peti atau kilogram sebagai satu dasar harga; keduanya boleh dicatat sebagai informasi.
- Status transaksi, pembayaran, dan pengiriman dipisahkan.
- Pembayaran mendukung lunas, DP/sebagian, dan utang/tempo.
- Tidak ada modul stok, grade, pemasok, HPP, atau saldo per rekening dalam MVP.
- Pembelian telur dicatat sebagai kategori pengeluaran.
- Laporan menampilkan **Estimasi Laba Bersih**, bukan laba akuntansi presisi.
- Peti diperlakukan sebagai pinjaman pelanggan dengan saldo keluar-kembali.
- Transaksi boleh bertanggal mundur maksimal satu tahun dari tanggal server.
- Seluruh saldo awal ditetapkan nol.

## Source of truth

- PRD menentukan scope dan aturan bisnis.
- Workflows menentukan perilaku layar.
- Technical specification menentukan kontrak implementasi.
- UAT menentukan syarat penerimaan.
