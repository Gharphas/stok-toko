# stok-toko

Aplikasi **Hitung Stock Barang Toko** berbasis web (HTML, CSS, JavaScript).

## Fitur
- 📦 **Katalog Barang** — Tambah, edit, hapus barang dengan kategori, satuan, harga beli & jual
- ⬇️ **Barang Masuk** — Catat pemasukan barang dari supplier, stok otomatis bertambah
- ⬆️ **Barang Keluar** — Catat pengeluaran/penjualan, proteksi stok minus otomatis
- 🧮 **Hitung Barang (Stock Opname)** — Input jumlah fisik, hitung selisih, sesuaikan stok sistem
- 📊 **Dashboard** — Statistik real-time: total barang, nilai aset, stok kritis
- 📋 **Riwayat Mutasi** — Log semua transaksi masuk/keluar/opname
- 🌙 **Dark Mode** — Toggle mode gelap/terang, tersimpan otomatis
- 📱 **Responsif** — Tampilan optimal di desktop, tablet, dan smartphone

## Cara Menjalankan

### 1. Jalankan di Komputer & Buka di HP (Jaringan Wi-Fi)
Jalankan server lokal menggunakan Node.js:
```bash
node serve.js
```
Terminal akan langsung menampilkan alamat akses:
- **Di Laptop/PC**: `http://localhost:5500`
- **Di Handphone**: `http://192.168.1.11:5500` *(atau IP Wi-Fi Anda)*

> **Tips HP**: Agar tampilan terlihat seperti aplikasi asli tanpa bar browser, buka link di Chrome (Android) lalu pilih **"Tambahkan ke Layar Utama" (Install App)**, atau di Safari (iOS) pilih **"Add to Home Screen"**.

### 2. Buka Online Lewat GitHub Pages
Aplikasi ini juga dapat diakses dari mana saja tanpa perlu menyalakan laptop jika GitHub Pages telah diaktifkan:
- **URL**: `https://gharphas.github.io/stok-toko/`

## Teknologi
- HTML5 Semantik + PWA Meta Tags (Responsif Mobile & Desktop)
- Vanilla CSS (Mobile-First, Bottom Navigation, Dark Mode, Glassmorphism)
- JavaScript ES6+ (Penyimpanan lokal `localStorage` di browser)

## Struktur File
```
stok-toko/
├── index.html    # Struktur halaman utama & Bottom Navigation
├── style.css     # Desain, tema dark mode, & responsive mobile
├── app.js        # Logika aplikasi & navigasi handphone
├── serve.js      # Server lokal multi-device (Laptop & HP)
└── README.md
```

---
Made with ❤️ by Gharphas
