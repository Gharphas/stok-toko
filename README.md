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

Cukup buka `index.html` langsung di browser, atau jalankan server lokal:

```bash
# Menggunakan Node.js
node -e "const http=require('http'),fs=require('fs'),path=require('path');const MIME={'.html':'text/html','.css':'text/css','.js':'application/javascript'};http.createServer((req,res)=>{const fp=path.join(__dirname,req.url==='/'?'index.html':req.url);fs.readFile(fp,(err,d)=>{if(err){res.writeHead(404);res.end();}else{res.writeHead(200,{'Content-Type':MIME[path.extname(fp)]||'text/plain'});res.end(d);}});}).listen(5500,()=>console.log('Running at http://localhost:5500'));"
```

Lalu buka browser ke [http://localhost:5500](http://localhost:5500)

## Teknologi
- HTML5 Semantik
- Vanilla CSS (Dark Mode, Glassmorphism, Responsif)
- JavaScript ES6+ (Data disimpan di `localStorage` browser)

## Struktur File
```
stok-toko/
├── index.html    # Struktur halaman utama
├── style.css     # Desain & tema
├── app.js        # Logika aplikasi
└── README.md
```

## Screenshot
Dashboard menampilkan statistik stok, peringatan stok kritis, dan riwayat transaksi terakhir secara real-time.

---
Made with ❤️ by Gharphas
