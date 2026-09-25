# stok-toko — StockMaster POS & Inventory

Aplikasi **Manajemen Stok Barang & Kasir Toko (POS)** modern berbasis web dengan analitik keuangan, laporan laba bersih, multi-kategori, dan sinkronisasi multi-device (Laptop & HP).

---

## 🚀 Fitur Unggulan

- 🛒 **Kasir & Keranjang POS (Point of Sale)**
  - Scan / tambah banyak barang ke keranjang kasir sekaligus.
  - Stepper kuantitas (`-` / `+`), kalkulasi subtotal otomatis, dan proteksi transaksi.
  - Input pembayaran tunai dengan tombol jalan pintas uang pas & pecahan (Rp 10.000 s/d Rp 100.000).
  - Tampilan kembalian real-time.
  - **Cetak Struk Pembayaran**: Format nota thermal standar kasir (58mm/80mm) siap print.
  - **Bagikan Struk WhatsApp**: Salin format nota belanja rapi ke chat WhatsApp pelanggan dengan 1 klik.

- 📈 **Laporan Laba Bersih & Omzet Penjualan (Dashboard Finansial)**
  - **Omzet Penjualan (Kotor)**: Total nilai kotor penjualan, counter transaksi, dan total unit laku.
  - **Laba Bersih**: Keuntungan nyata toko (`Omzet - HPP Modal Terjual`) & persentase Margin Laba (%).
  - **Modal Penjualan (HPP)**: Biaya pokok dari seluruh barang yang laku terjual.
  - **Nilai Aset Modal Stok**: Valuasi total modal barang yang tersisa di toko saat ini.
  - **Filter Periode Interaktif**: Hari Ini, 7 Hari Terakhir, Bulan Ini, dan Semua Waktu.
  - **Tampilan Produk Terlaris (*Top Selling Items*) & Paling Cepat Habis**: Peringkat volume penjualan tertinggi, bar visual penjualan, deteksi dini voucher/barang yang segera habis (*Runout Alert*), filter kategori (Voucher, Rokok, F&B, ATK), serta tombol aksi cepat *+ Restock*.
  - **Tabel Produk Paling Menguntungkan**: Peringkat produk dengan kontribusi laba terbesar & margin %.
  - **Cetak Laporan Keuangan**: Cetak atau simpan PDF ringkasan laba rugi lengkap dengan tabel rincian dan tanda tangan penanggung jawab toko.

- 🏷️ **Pemisahan Kategori Produk Toko**
  - **Voucher & Pulsa** (filter kuota internet & provider).
  - **Rokok** (filter merk & isi per bungkus).
  - **Makanan & Minuman (F&B)**.
  - **Alat Tulis Kantor (ATK)**.
  - **Kategori Lainnya**.
  - Shortcut filter kategori di katalog dan dashboard ringkasan stok.

- 📷 **Scanner Barcode Cerdas (Kamera & Hardware USB/Bluetooth)**
  - Scan barcode produk menggunakan kamera HP / laptop atau scanner barcode fisik USB/Bluetooth.
  - Mode otomatis: Langsung masuk ke Keranjang POS saat di tab kasir, atau mode auto-input (+1 masuk / -1 kasir).
  - Beep audio & vibrasi haptic feedback saat scan berhasil.

- 📦 **Manajemen Stok & Mutasi Lengkap**
  - **Katalog Barang**: Tambah, edit, hapus barang dengan barcode, kategori, satuan, harga beli & jual.
  - **Barang Masuk**: Catat pasokan barang dari supplier, update harga beli & stok otomatis.
  - **Barang Keluar**: Catat penjualan kasir, rusak, hilang, atau pemakaian internal.
  - **Hitung Barang (Stock Opname)**: Verifikasi stok fisik vs stok sistem dengan hitung selisih otomatis.
  - **Riwayat Mutasi**: Log lengkap seluruh transaksi masuk/keluar/opname dengan filter tanggal & jenis.

- 🔐 **Autentikasi & Kontrol Hak Akses (Multi-User)**
  - Login pengguna dengan role **Admin** (akses penuh) dan **Kasir** (akses operasional kasir & penjualan).
  - Manajemen akun pengguna toko.

- 🌙 **Modern UI, Glassmorphism & Dark Mode**
  - Tampilan elegan, responsif untuk Mobile & Desktop (PWA ready).
  - Toggle Mode Gelap / Terang yang tersimpan otomatis.

---

## 💻 Cara Menjalankan

### 1. Jalankan di Komputer & Buka di HP (Jaringan Wi-Fi Sama)
Jalankan server lokal menggunakan Node.js:
```bash
node serve.js
```

Terminal akan menampilkan alamat akses:
- **Di Laptop/PC**: `http://localhost:5500`
- **Di Handphone**: `http://[IP-WIFI-ANDA]:5500` *(Contoh: `http://192.168.1.11:5500`)*

> 💡 **Tips Penggunaan di HP**: Buka link di Chrome (Android) lalu pilih menu **"Tambahkan ke Layar Utama" (Install App)**, atau di Safari (iOS) pilih **"Add to Home Screen"** untuk pengalaman layar penuh seperti aplikasi native.

### 2. Akses Online via GitHub Pages
Aplikasi juga dapat diakses dari mana saja via browser:
- **URL**: `https://gharphas.github.io/stok-toko/`

---

## 🛠️ Arsitektur & Teknologi

- **Frontend**: HTML5 Semantik, Vanilla CSS3 (CSS Variables, Flexbox/Grid, Glassmorphism, `@media print`), JavaScript ES6+.
- **Backend & Database**: Node.js HTTP REST API Server (`serve.js`), JSON Database storage (`data/db.json`), dengan sinkronisasi `localStorage` untuk offline fallback.
- **Pustaka Tambahan**: Remix Icon (ikon antarmuka), Html5-QRCode (kamera barcode scanner).

---

## 📂 Struktur File

```
stok-toko/
├── index.html       # Struktur UI halaman, modal POS, struk, dan laporan
├── style.css        # Desain responsif, dark mode, cetak thermal, & tema
├── app.js           # Engine kasir POS, analitik laba rugi, & navigasi
├── serve.js         # REST API server & sinkronisasi data multi-device
├── data/
│   └── db.json      # File database persisten lokal toko
└── README.md        # Dokumentasi lengkap aplikasi
```

---
Made with ❤️ by Gharphas
