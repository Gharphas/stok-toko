const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 5500;
const HOST = '0.0.0.0';
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Pastikan direktori data ada
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Inisialisasi struktur database jika belum ada
function getInitialDb() {
  return {
    products: [],
    transactions: [],
    opnames: [],
    lastUpdated: new Date().toISOString()
  };
}

function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf8');
      const data = JSON.parse(content);
      if (!Array.isArray(data.products)) data.products = [];
      if (!Array.isArray(data.transactions)) data.transactions = [];
      if (!Array.isArray(data.opnames)) data.opnames = [];
      return data;
    }
  } catch (err) {
    console.error('Gagal membaca database, membuat database baru:', err.message);
  }
  const init = getInitialDb();
  saveDatabase(init);
  return init;
}

function saveDatabase(db) {
  try {
    db.lastUpdated = new Date().toISOString();
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Gagal menyimpan database:', err.message);
    return false;
  }
}

// In-memory database cache disinkronkan langsung ke file
let database = loadDatabase();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

// Ambil IP Lokal (Wi-Fi / LAN)
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  const url = req.url.split('?')[0];

  // ==========================================
  //  REST API: DATABASE SYNCHRONIZATION
  // ==========================================
  if (url.startsWith('/api/')) {
    // 1. GET /api/data -> Ambil seluruh database
    if (url === '/api/data' && req.method === 'GET') {
      database = loadDatabase(); // muat status file terbaru
      return sendJson(res, 200, {
        success: true,
        data: database
      });
    }

    // 2. POST /api/masuk -> Catat barang masuk langsung ke database
    if (url === '/api/masuk' && req.method === 'POST') {
      try {
        const payload = await parseJsonBody(req);
        database = loadDatabase();

        const { produkId, jumlah, hargaBeli, supplier, nota, keterangan } = payload;
        const pIndex = database.products.findIndex(p => p.id === produkId);

        if (pIndex === -1) {
          return sendJson(res, 404, { success: false, message: 'Barang tidak ditemukan' });
        }

        const qty = Number(jumlah);
        if (isNaN(qty) || qty === 0) {
          return sendJson(res, 400, { success: false, message: 'Jumlah barang masuk harus berupa angka valid selain 0' });
        }

        const prod = database.products[pIndex];
        prod.stok = (Number(prod.stok) || 0) + qty;
        if (hargaBeli !== undefined && hargaBeli !== null && !isNaN(Number(hargaBeli))) {
          prod.hargaBeli = Number(hargaBeli);
        }
        prod.updatedAt = new Date().toISOString();

        const tx = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          jenis: 'masuk',
          produkId,
          namaProduk: prod.nama,
          satuan: prod.satuan,
          jumlah: qty,
          hargaSatuan: Number(hargaBeli) || prod.hargaBeli,
          total: qty * (Number(hargaBeli) || prod.hargaBeli),
          supplier: supplier || '',
          nota: nota || '',
          keterangan: keterangan || '',
          tgl: new Date().toISOString()
        };

        database.transactions.unshift(tx);
        saveDatabase(database);

        return sendJson(res, 200, {
          success: true,
          message: `Berhasil menambah stok +${qty} ${prod.satuan} untuk "${prod.nama}"`,
          product: prod,
          transaction: tx,
          data: database
        });
      } catch (err) {
        return sendJson(res, 500, { success: false, message: err.message });
      }
    }

    // 3. POST /api/keluar -> Catat barang keluar langsung ke database
    if (url === '/api/keluar' && req.method === 'POST') {
      try {
        const payload = await parseJsonBody(req);
        database = loadDatabase();

        const { produkId, jumlah, jenisKeluar, keterangan } = payload;
        const pIndex = database.products.findIndex(p => p.id === produkId);

        if (pIndex === -1) {
          return sendJson(res, 404, { success: false, message: 'Barang tidak ditemukan' });
        }

        const qty = Number(jumlah);
        if (isNaN(qty) || qty === 0) {
          return sendJson(res, 400, { success: false, message: 'Jumlah pengeluaran harus berupa angka valid selain 0' });
        }

        const prod = database.products[pIndex];
        const stokSekarang = Number(prod.stok) || 0;

        // Stok tidak dibatasi (bisa berkurang bebas atau minus)
        prod.stok = stokSekarang - qty;
        prod.updatedAt = new Date().toISOString();

        const tx = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          jenis: 'keluar',
          subJenis: jenisKeluar || 'penjualan',
          produkId,
          namaProduk: prod.nama,
          satuan: prod.satuan,
          jumlah: qty,
          hargaSatuan: prod.hargaJual,
          total: qty * prod.hargaJual,
          keterangan: `[${(jenisKeluar || 'penjualan').toUpperCase()}] ${keterangan || ''}`.trim(),
          tgl: new Date().toISOString()
        };

        database.transactions.unshift(tx);
        saveDatabase(database);

        return sendJson(res, 200, {
          success: true,
          message: `Berhasil mengeluarkan ${qty} ${prod.satuan} "${prod.nama}"`,
          product: prod,
          transaction: tx,
          data: database
        });
      } catch (err) {
        return sendJson(res, 500, { success: false, message: err.message });
      }
    }

    // 4. POST /api/products -> Tambah / Edit barang
    if (url === '/api/products' && req.method === 'POST') {
      try {
        const prodData = await parseJsonBody(req);
        database = loadDatabase();

        if (prodData.id) {
          const idx = database.products.findIndex(p => p.id === prodData.id);
          if (idx > -1) {
            // Jika stok diinputkan pada saat edit, perbarui nilainya tanpa dibatasi
            if (prodData.stok !== undefined && prodData.stok !== null && !isNaN(Number(prodData.stok))) {
              prodData.stok = Number(prodData.stok);
            } else {
              prodData.stok = database.products[idx].stok;
            }
            prodData.updatedAt = new Date().toISOString();
            database.products[idx] = { ...database.products[idx], ...prodData };
          } else {
            prodData.stok = Number(prodData.stok) || 0;
            database.products.push(prodData);
          }
        } else {
          prodData.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
          prodData.stok = Number(prodData.stok) || 0;
          prodData.createdAt = new Date().toISOString();
          prodData.updatedAt = new Date().toISOString();
          database.products.push(prodData);
        }

        saveDatabase(database);
        return sendJson(res, 200, { success: true, product: prodData, data: database });
      } catch (err) {
        return sendJson(res, 500, { success: false, message: err.message });
      }
    }

    // 5. DELETE /api/products/:id -> Hapus barang
    if (url.startsWith('/api/products/') && req.method === 'DELETE') {
      const id = url.replace('/api/products/', '');
      database = loadDatabase();
      database.products = database.products.filter(p => p.id !== id);
      saveDatabase(database);
      return sendJson(res, 200, { success: true, message: 'Barang dihapus', data: database });
    }

    // 6. POST /api/opname -> Simpan penyesuaian stock opname
    if (url === '/api/opname' && req.method === 'POST') {
      try {
        const { changes } = await parseJsonBody(req);
        database = loadDatabase();

        if (Array.isArray(changes) && changes.length) {
          changes.forEach(c => {
            const idx = database.products.findIndex(p => p.id === c.id);
            if (idx > -1) {
              database.products[idx].stok = Number(c.stokFisik);
              database.products[idx].updatedAt = new Date().toISOString();

              database.transactions.unshift({
                id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                jenis: 'opname',
                produkId: c.id,
                namaProduk: c.nama,
                satuan: c.satuan,
                jumlah: Math.abs(c.selisih),
                keterangan: `Opname: sistem ${c.stokSistem} → fisik ${c.stokFisik} (${c.selisih >= 0 ? '+' : ''}${c.selisih}) ${c.keterangan || ''}`.trim(),
                tgl: new Date().toISOString()
              });
            }
          });

          database.opnames.unshift({
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            tgl: new Date().toISOString(),
            items: changes
          });

          saveDatabase(database);
          return sendJson(res, 200, { success: true, message: 'Stock opname berhasil disesuaikan', data: database });
        }
        return sendJson(res, 400, { success: false, message: 'Tidak ada perubahan opname' });
      } catch (err) {
        return sendJson(res, 500, { success: false, message: err.message });
      }
    }

    // 7. DELETE /api/transactions -> Kosongkan riwayat mutasi
    if (url === '/api/transactions' && req.method === 'DELETE') {
      database = loadDatabase();
      database.transactions = [];
      database.opnames = [];
      saveDatabase(database);
      return sendJson(res, 200, { success: true, message: 'Riwayat mutasi dibersihkan', data: database });
    }

    // 8. POST /api/restore -> Pulihkan seluruh database dari file JSON
    if (url === '/api/restore' && req.method === 'POST') {
      try {
        const fullData = await parseJsonBody(req);
        if (fullData && Array.isArray(fullData.products)) {
          database = {
            products: fullData.products,
            transactions: Array.isArray(fullData.transactions) ? fullData.transactions : [],
            opnames: Array.isArray(fullData.opnames) ? fullData.opnames : [],
            lastUpdated: new Date().toISOString()
          };
          saveDatabase(database);
          return sendJson(res, 200, { success: true, message: 'Database berhasil dipulihkan', data: database });
        }
        return sendJson(res, 400, { success: false, message: 'Format data backup tidak valid' });
      } catch (err) {
        return sendJson(res, 500, { success: false, message: err.message });
      }
    }

    return sendJson(res, 404, { success: false, message: 'Endpoint API tidak ditemukan' });
  }

  // ==========================================
  //  STATIC FILE SERVER
  // ==========================================
  let reqPath = url;
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  const filePath = path.join(__dirname, reqPath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>404 File Tidak Ditemukan</h1>');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server Error: ' + err.code);
      }
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });
    res.end(data);
  });
});

server.listen(PORT, HOST, () => {
  const localIP = getLocalIP();
  console.log('\n======================================================');
  console.log(' 🚀 StockMaster Database Server Berjalan!');
  console.log('======================================================');
  console.log(` 💻 Akses di Laptop/PC : http://localhost:${PORT}`);
  console.log(` 📱 Akses di Handphone : http://${localIP}:${PORT}`);
  console.log(` 📂 File Database      : ${DB_FILE}`);
  console.log('======================================================');
  console.log(' 💾 Setiap input Masuk/Keluar langsung tersimpan permanen!');
  console.log(' 💡 Tips: Pastikan Laptop & HP tersambung di Wi-Fi yang sama.\n');
});
