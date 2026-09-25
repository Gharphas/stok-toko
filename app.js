/**
 * StockMaster — Application Logic (app.js)
 * Features: Katalog Barang, Barang Masuk, Barang Keluar, Hitung Barang (Stock Opname)
 * Storage: localStorage
 */

// ============================================================
//  DATABASE MANAGER (Server REST API + Local Fallback)
// ============================================================
// ============================================================
//  DATABASE MANAGER (Multi-device Real-Time Sync & Protection)
// ============================================================
const DB = {
  PRODUCTS: 'sm_products',
  TRANSACTIONS: 'sm_transactions',
  OPNAMES: 'sm_opnames',
  LAST_UPDATED: 'sm_last_updated',
  SERVER_URL: 'sm_server_url',
  _isServer: false,
  _mode: 'offline', // 'server' | 'github' | 'raw_github' | 'offline'
  _cache: { products: [], transactions: [], opnames: [], lastUpdated: null },

  getApiUrl(endpoint) {
    const custom = localStorage.getItem(this.SERVER_URL);
    if (custom && custom.trim()) {
      return custom.trim().replace(/\/+$/, '') + endpoint;
    }
    // Jika dibuka dari localhost / IP lokal laptop:
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || /^192\.168\./.test(window.location.hostname) || /^10\./.test(window.location.hostname)) {
      return endpoint;
    }
    return endpoint;
  },

  async init() {
    // 1. Muat dari localStorage terlebih dahulu (instant UI render, anti blank)
    try {
      this._cache.products = JSON.parse(localStorage.getItem(this.PRODUCTS)) || [];
      this._cache.transactions = JSON.parse(localStorage.getItem(this.TRANSACTIONS)) || [];
      this._cache.opnames = JSON.parse(localStorage.getItem(this.OPNAMES)) || [];
      this._cache.lastUpdated = localStorage.getItem(this.LAST_UPDATED) || null;
    } catch {
      this._cache = { products: [], transactions: [], opnames: [], lastUpdated: null };
    }
    this.updateLastUpdatedDisplay();

    // 2. Hubungkan ke database server (data/db.json) atau GitHub database
    await this.fetchFromServer();
  },

  async fetchFromServer() {
    const apiUrl = this.getApiUrl('/api/data');
    let loadedData = null;
    let source = '';

    // 1. Coba hubungi REST API Server (Laptop / Localhost / IP Wi-Fi)
    try {
      const res = await fetch(apiUrl, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          loadedData = json.data;
          source = 'server';
        }
      }
    } catch (err) {
      // Server lokal tidak terjangkau (misal buka di luar jaringan Wi-Fi toko)
    }

    // 2. Jika bukan di server lokal (misal dibuka di GitHub Pages), coba ambil file data/db.json statis
    if (!loadedData) {
      try {
        const res = await fetch('./data/db.json?t=' + Date.now(), { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (json && (Array.isArray(json.products) || Array.isArray(json.transactions))) {
            loadedData = json;
            source = 'github';
          }
        }
      } catch (err) {}
    }

    // 3. Fallback online: coba ambil langsung dari Raw GitHub jika buka online
    if (!loadedData && (!this._cache.products || this._cache.products.length === 0)) {
      try {
        const res = await fetch('https://raw.githubusercontent.com/Gharphas/stok-toko/main/data/db.json?t=' + Date.now(), { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (json && (Array.isArray(json.products) || Array.isArray(json.transactions))) {
            loadedData = json;
            source = 'raw_github';
          }
        }
      } catch (err) {}
    }

    // PROSES SINKRONISASI CERDAS — ANTI RESET & PERTAHANKAN POSISI TERAKHIR
    if (loadedData) {
      const remoteProducts = Array.isArray(loadedData.products) ? loadedData.products : [];
      const remoteTxs = Array.isArray(loadedData.transactions) ? loadedData.transactions : [];
      const remoteOpnames = Array.isArray(loadedData.opnames) ? loadedData.opnames : [];
      const remoteLastUpdated = loadedData.lastUpdated ? new Date(loadedData.lastUpdated).getTime() : 0;
      const localLastUpdated = this._cache.lastUpdated ? new Date(this._cache.lastUpdated).getTime() : 0;

      // Kasus A: Server kosong ([]), tapi HP/Laptop memiliki data produk lokal yang sudah ada
      if (remoteProducts.length === 0 && this._cache.products.length > 0) {
        console.log('Server kosong namun data lokal ada. Otomatis sinkronkan data lokal ke server...');
        if (source === 'server') {
          await this.restoreFull({
            products: this._cache.products,
            transactions: this._cache.transactions,
            opnames: this._cache.opnames,
            lastUpdated: this._cache.lastUpdated || new Date().toISOString()
          });
        }
        this._isServer = (source === 'server');
        this._mode = source;
        this.updateStatusPill(true, source);
        return true;
      }

      // Kasus B: Data lokal kosong (HP baru dibuka), ambil langsung dari remote
      if (this._cache.products.length === 0 && remoteProducts.length > 0) {
        this._cache.products = remoteProducts;
        this._cache.transactions = remoteTxs;
        this._cache.opnames = remoteOpnames;
        this._cache.lastUpdated = loadedData.lastUpdated || new Date().toISOString();
        this._persistLocal();
        this._isServer = (source === 'server');
        this._mode = source;
        this.updateStatusPill(true, source);
        return true;
      }

      // Kasus C: Keduanya ada data -> gunakan data yang paling update
      if (remoteLastUpdated >= localLastUpdated || remoteProducts.length >= this._cache.products.length) {
        this._cache.products = remoteProducts;
        this._cache.transactions = remoteTxs;
        this._cache.opnames = remoteOpnames;
        this._cache.lastUpdated = loadedData.lastUpdated || new Date().toISOString();
        this._persistLocal();
      } else {
        // Data lokal lebih baru, jika terhubung ke server, kirim ke server
        if (source === 'server') {
          await this.restoreFull({
            products: this._cache.products,
            transactions: this._cache.transactions,
            opnames: this._cache.opnames,
            lastUpdated: this._cache.lastUpdated || new Date().toISOString()
          });
        }
      }

      this._isServer = (source === 'server');
      this._mode = source;
      this.updateStatusPill(true, source);
      return true;
    }

    // Jika offline sama sekali, gunakan data lokal yang ada
    this._isServer = false;
    this._mode = 'offline';
    this.updateStatusPill(false, 'offline');
    return false;
  },

  _persistLocal() {
    localStorage.setItem(this.PRODUCTS, JSON.stringify(this._cache.products));
    localStorage.setItem(this.TRANSACTIONS, JSON.stringify(this._cache.transactions));
    localStorage.setItem(this.OPNAMES, JSON.stringify(this._cache.opnames));
    if (this._cache.lastUpdated) {
      localStorage.setItem(this.LAST_UPDATED, this._cache.lastUpdated);
    }
    this.updateLastUpdatedDisplay();
  },

  updateLastUpdatedDisplay() {
    const el = document.getElementById('dbLastUpdatedText');
    if (el) {
      el.textContent = this._cache.lastUpdated ? formatDate(this._cache.lastUpdated) : 'Belum ada mutasi';
    }
  },

  getProducts()     { return this._cache.products; },
  getTransactions() { return this._cache.transactions; },
  getOpnames()      { return this._cache.opnames; },

  async saveProduct(data) {
    data.updatedAt = new Date().toISOString();
    this._cache.lastUpdated = data.updatedAt;

    if (this._isServer) {
      try {
        const res = await fetch(this.getApiUrl('/api/products'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const json = await res.json();
        if (json.success && json.data) {
          this._cache = json.data;
          this._persistLocal();
          return json;
        }
      } catch (err) {
        console.warn('Simpan offline:', err);
      }
    }

    // Fallback lokal
    const idx = this._cache.products.findIndex(p => p.id === data.id);
    if (idx > -1) {
      if (data.stok !== undefined && data.stok !== null && !isNaN(Number(data.stok))) {
        data.stok = Number(data.stok);
      } else {
        data.stok = this._cache.products[idx].stok;
      }
      this._cache.products[idx] = { ...this._cache.products[idx], ...data };
    } else {
      if (!data.id) data.id = genId();
      data.stok = Number(data.stok) || 0;
      data.createdAt = new Date().toISOString();
      this._cache.products.push(data);
    }
    this._persistLocal();
    return { success: true, product: data };
  },

  async deleteProduct(id) {
    this._cache.lastUpdated = new Date().toISOString();
    if (this._isServer) {
      try {
        const res = await fetch(this.getApiUrl(`/api/products/${id}`), { method: 'DELETE' });
        const json = await res.json();
        if (json.success && json.data) {
          this._cache = json.data;
          this._persistLocal();
          return json;
        }
      } catch (err) {}
    }

    this._cache.products = this._cache.products.filter(p => p.id !== id);
    this._persistLocal();
    return { success: true };
  },

  async catatMasuk(payload) {
    this._cache.lastUpdated = new Date().toISOString();
    if (this._isServer) {
      try {
        const res = await fetch(this.getApiUrl('/api/masuk'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.success && json.data) {
          this._cache = json.data;
          this._persistLocal();
          return json;
        } else {
          throw new Error(json.message || 'Gagal menyimpan barang masuk');
        }
      } catch (err) {
        if (!err.message.includes('Gagal')) throw err;
      }
    }

    // Fallback offline
    const idx = this._cache.products.findIndex(p => p.id === payload.produkId);
    if (idx === -1) throw new Error('Barang tidak ditemukan');

    const prod = this._cache.products[idx];
    const qty = Number(payload.jumlah) || 0;
    prod.stok = (Number(prod.stok) || 0) + qty;
    if (payload.hargaBeli !== undefined && payload.hargaBeli !== null && !isNaN(Number(payload.hargaBeli))) {
      prod.hargaBeli = Number(payload.hargaBeli);
    }
    prod.updatedAt = new Date().toISOString();

    const tx = {
      id: genId(),
      jenis: 'masuk',
      produkId: prod.id,
      namaProduk: prod.nama,
      satuan: prod.satuan,
      jumlah: qty,
      hargaSatuan: Number(payload.hargaBeli) || prod.hargaBeli,
      total: qty * (Number(payload.hargaBeli) || prod.hargaBeli),
      supplier: payload.supplier || '',
      nota: payload.nota || '',
      keterangan: payload.keterangan || '',
      tgl: new Date().toISOString()
    };
    this._cache.transactions.unshift(tx);
    this._persistLocal();
    return { success: true, product: prod, transaction: tx };
  },

  async catatKeluar(payload) {
    this._cache.lastUpdated = new Date().toISOString();
    if (this._isServer) {
      try {
        const res = await fetch(this.getApiUrl('/api/keluar'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.success && json.data) {
          this._cache = json.data;
          this._persistLocal();
          return json;
        } else {
          throw new Error(json.message || 'Gagal menyimpan barang keluar');
        }
      } catch (err) {
        if (err.message && !err.message.includes('Gagal')) throw err;
      }
    }

    // Fallback offline
    const idx = this._cache.products.findIndex(p => p.id === payload.produkId);
    if (idx === -1) throw new Error('Barang tidak ditemukan');

    const prod = this._cache.products[idx];
    const stokSekarang = Number(prod.stok) || 0;
    const qty = Number(payload.jumlah) || 0;

    // Stok tidak dibatasi (bisa berkurang bebas atau minus)
    prod.stok = stokSekarang - qty;
    prod.updatedAt = new Date().toISOString();

    const tx = {
      id: genId(),
      jenis: 'keluar',
      subJenis: payload.jenisKeluar || 'penjualan',
      produkId: prod.id,
      namaProduk: prod.nama,
      satuan: prod.satuan,
      jumlah: qty,
      hargaSatuan: prod.hargaJual,
      total: qty * prod.hargaJual,
      keterangan: `[${(payload.jenisKeluar || 'penjualan').toUpperCase()}] ${payload.keterangan || ''}`.trim(),
      tgl: new Date().toISOString()
    };
    this._cache.transactions.unshift(tx);
    this._persistLocal();
    return { success: true, product: prod, transaction: tx };
  },

  async catatOpname(changes) {
    this._cache.lastUpdated = new Date().toISOString();
    if (this._isServer) {
      try {
        const res = await fetch(this.getApiUrl('/api/opname'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ changes })
        });
        const json = await res.json();
        if (json.success && json.data) {
          this._cache = json.data;
          this._persistLocal();
          return json;
        }
      } catch (err) {}
    }

    // Fallback offline
    changes.forEach(c => {
      const idx = this._cache.products.findIndex(p => p.id === c.id);
      if (idx > -1) {
        this._cache.products[idx].stok = Number(c.stokFisik);
        this._cache.products[idx].updatedAt = new Date().toISOString();
        this._cache.transactions.unshift({
          id: genId(),
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
    this._cache.opnames.unshift({ id: genId(), tgl: new Date().toISOString(), items: changes });
    this._persistLocal();
    return { success: true };
  },

  async clearTransactions() {
    this._cache.lastUpdated = new Date().toISOString();
    if (this._isServer) {
      try {
        const res = await fetch(this.getApiUrl('/api/transactions'), { method: 'DELETE' });
        const json = await res.json();
        if (json.success && json.data) {
          this._cache = json.data;
          this._persistLocal();
          return json;
        }
      } catch (err) {}
    }
    this._cache.transactions = [];
    this._cache.opnames = [];
    this._persistLocal();
    return { success: true };
  },

  async restoreFull(fullData) {
    if (!fullData.lastUpdated) fullData.lastUpdated = new Date().toISOString();
    this._cache.lastUpdated = fullData.lastUpdated;

    if (this._isServer) {
      try {
        const res = await fetch(this.getApiUrl('/api/restore'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fullData)
        });
        const json = await res.json();
        if (json.success && json.data) {
          this._cache = json.data;
          this._persistLocal();
          return json;
        }
      } catch (err) {}
    }
    this._cache.products = Array.isArray(fullData.products) ? fullData.products : [];
    this._cache.transactions = Array.isArray(fullData.transactions) ? fullData.transactions : [];
    this._cache.opnames = Array.isArray(fullData.opnames) ? fullData.opnames : [];
    this._persistLocal();
    return { success: true };
  },

  exportSyncCode() {
    const data = {
      p: this._cache.products,
      t: this._cache.transactions,
      o: this._cache.opnames,
      u: this._cache.lastUpdated || new Date().toISOString()
    };
    try {
      return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
    } catch {
      return btoa(JSON.stringify(data));
    }
  },

  async importSyncCode(codeStr) {
    if (!codeStr || !codeStr.trim()) throw new Error('Kode sinkronisasi kosong!');
    let json;
    try {
      const decoded = decodeURIComponent(escape(atob(codeStr.trim())));
      json = JSON.parse(decoded);
    } catch (e) {
      try {
        json = JSON.parse(atob(codeStr.trim()));
      } catch (err) {
        json = JSON.parse(codeStr.trim());
      }
    }
    const full = {
      products: json.p || json.products || [],
      transactions: json.t || json.transactions || [],
      opnames: json.o || json.opnames || [],
      lastUpdated: json.u || json.lastUpdated || new Date().toISOString()
    };
    await this.restoreFull(full);
    return full;
  },

  updateStatusPill(isOnline, source = 'server') {
    const pill = document.getElementById('dbStatusPill');
    const text = document.getElementById('dbStatusText');
    const badge = document.getElementById('dbModeBadge');
    const syncText = document.getElementById('dbSyncStatusText');
    if (!pill) return;

    if (isOnline) {
      pill.className = 'db-status-pill';
      if (source === 'server') {
        text.textContent = 'Database Laptop (Real-time)';
        if (syncText) syncText.textContent = 'Aktif & Real-time (Wi-Fi Server)';
        if (badge) {
          badge.className = 'badge badge-aman';
          badge.innerHTML = '<i class="ri-checkbox-circle-fill"></i> Database Server (db.json)';
        }
      } else {
        text.textContent = 'Database Online (GitHub Sync)';
        if (syncText) syncText.textContent = 'Tersinkron ke GitHub (data/db.json)';
        if (badge) {
          badge.className = 'badge badge-aman';
          badge.innerHTML = '<i class="ri-cloud-fill"></i> Cloud GitHub Pages';
        }
      }
    } else {
      pill.className = 'db-status-pill offline';
      text.textContent = 'Mode Offline (Penyimpanan HP)';
      if (syncText) syncText.textContent = 'Tersimpan di Handphone (Aman)';
      if (badge) {
        badge.className = 'badge badge-menipis';
        badge.innerHTML = '<i class="ri-smartphone-line"></i> Penyimpanan Lokal HP';
      }
    }
  }
};

// ============================================================
//  UTILITIES
// ============================================================
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function formatRupiah(num) {
  if (isNaN(num)) return 'Rp 0';
  return 'Rp ' + Number(num).toLocaleString('id-ID');
}

function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) +
         ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function formatDateShort(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

let toastTimer = null;
function showToast(msg, type = 'success') {
  const el = document.getElementById('toast');
  const icons = { success: 'ri-checkbox-circle-fill', error: 'ri-error-warning-fill', warning: 'ri-alert-fill', info: 'ri-information-fill' };
  el.className = `toast show ${type}`;
  el.innerHTML = `<i class="${icons[type] || icons.info}"></i> ${msg}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 3200);
}

function getStockStatus(product) {
  const stok = Number(product.stok) || 0;
  if (stok < 0) return 'minus';
  if (stok === 0) return 'habis';
  const minStok = Number(product.minStok) || 0;
  if (minStok > 0 && stok <= minStok) return 'menipis';
  return 'aman';
}

function statusBadge(status) {
  const labels = { aman: 'Stok Aman', menipis: 'Stok Menipis', habis: 'Stok Habis', minus: 'Stok Minus' };
  return `<span class="badge badge-${status}">${labels[status] || status}</span>`;
}

// ============================================================
//  KLASIFIKASI & METADATA JENIS PRODUK (Voucher, Rokok, F&B, ATK)
// ============================================================
function getCategoryMeta(kategori) {
  const k = (kategori || '').toLowerCase().trim();
  if (k.includes('vocer') || k.includes('voucher') || k.includes('kuota') || k.includes('pulsa') || k.includes('perdana') || k.includes('paket data') || k.includes('internet')) {
    return {
      group: 'Voucher & Pulsa',
      icon: 'ri-wifi-line',
      label: 'Voucher & Pulsa',
      colorCls: 'cat-voucher'
    };
  }
  if (k.includes('rokok') || k.includes('surya') || k.includes('sampoerna') || k.includes('mild') || k.includes('gudang garam') || k.includes('djarum') || k.includes('marlboro') || k.includes('filter') || k.includes('kretek')) {
    return {
      group: 'Rokok',
      icon: 'ri-fire-line',
      label: 'Rokok',
      colorCls: 'cat-rokok'
    };
  }
  if (k.includes('makan') || k.includes('minum') || k.includes('snack') || k.includes('kopi') || k.includes('mie') || k.includes('f&b') || k.includes('sembako') || k.includes('biskuit') || k.includes('air') || k.includes('teh')) {
    return {
      group: 'Makanan & Minuman',
      icon: 'ri-restaurant-line',
      label: 'Makanan & Minuman',
      colorCls: 'cat-fnb'
    };
  }
  if (k.includes('atk') || k.includes('tulis') || k.includes('kertas') || k.includes('buku') || k.includes('pulpen') || k.includes('pensil') || k.includes('kantor') || k.includes('fotokopi') || k.includes('map') || k.includes('lakban')) {
    return {
      group: 'ATK',
      icon: 'ri-pencil-ruler-2-line',
      label: 'ATK',
      colorCls: 'cat-atk'
    };
  }
  return {
    group: kategori || 'Lainnya',
    icon: 'ri-price-tag-3-line',
    label: kategori || 'Umum',
    colorCls: 'cat-other'
  };
}

let currentKatalogCategory = '';
let currentOpnameCategory = '';
let currentMasukCategory = '';
let currentKeluarCategory = '';

// Confirm modal helper
let confirmCallback = null;
function showConfirm(title, msg, onOk) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMsg').textContent = msg;
  confirmCallback = onOk;
  document.getElementById('modalConfirm').classList.add('open');
}
document.getElementById('okConfirm').addEventListener('click', () => {
  document.getElementById('modalConfirm').classList.remove('open');
  if (confirmCallback) confirmCallback();
  confirmCallback = null;
});
document.getElementById('cancelConfirm').addEventListener('click', () => {
  document.getElementById('modalConfirm').classList.remove('open');
  confirmCallback = null;
});
document.getElementById('closeConfirmModal').addEventListener('click', () => {
  document.getElementById('modalConfirm').classList.remove('open');
});

// ============================================================
//  TAB NAVIGATION
// ============================================================
const tabTitles = {
  dashboard: 'Dashboard',
  produk: 'Katalog Barang',
  masuk: 'Barang Masuk',
  keluar: 'Barang Keluar',
  opname: 'Hitung Barang',
  riwayat: 'Riwayat Mutasi',
};

function switchTab(name) {
  // Update sidebar nav
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navEl = document.getElementById(`nav-${name}`);
  if (navEl) navEl.classList.add('active');

  // Update bottom nav
  document.querySelectorAll('.bottom-nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === name);
  });

  // Update views
  document.querySelectorAll('.tab-view').forEach(el => el.classList.remove('active'));
  const view = document.getElementById(`tab-${name}`);
  if (view) view.classList.add('active');

  // Update topbar title
  document.getElementById('topbarTitle').textContent = tabTitles[name] || name;

  // Refresh content
  renderByTab(name);

  // Close mobile sidebar and overlay
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  if (sidebar) sidebar.classList.remove('mobile-open');
  if (sidebarOverlay) sidebarOverlay.classList.remove('active');
}

function renderByTab(name) {
  if (name === 'dashboard') renderDashboard();
  if (name === 'produk')   renderTableProduk();
  if (name === 'masuk')    { populateProdukSelects(); renderListMasuk(); }
  if (name === 'keluar')   { populateProdukSelects(); renderListKeluar(); }
  if (name === 'opname')   renderOpname();
  if (name === 'riwayat')  renderRiwayat();
}

// Nav click events (Sidebar)
document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    switchTab(el.dataset.tab);
  });
});

// Nav click events (Bottom Navigation Bar)
document.querySelectorAll('.bottom-nav-item').forEach(el => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    if (navigator.vibrate) {
      try { navigator.vibrate(12); } catch {}
    }
    if (el.id === 'bnav-scan') {
      openScannerModal('action');
      return;
    }
    const tab = el.dataset.tab;
    if (tab) switchTab(tab);
  });
});

// ============================================================
//  GLOBAL SEARCH
// ============================================================
document.getElementById('globalSearch').addEventListener('input', function() {
  const q = this.value.trim().toLowerCase();
  if (!q) return;
  switchTab('produk');
  setTimeout(() => filterAndRenderProduk(q), 50);
});

// ============================================================
//  DARK MODE
// ============================================================
function applyTheme(dark) {
  document.body.classList.toggle('dark', dark);
  const themeIcon = document.getElementById('themeIcon');
  const themeQuickIcon = document.getElementById('themeQuickIcon');
  const themeLabel = document.getElementById('themeLabel');
  
  if (themeIcon) themeIcon.className = dark ? 'ri-sun-line' : 'ri-moon-line';
  if (themeQuickIcon) themeQuickIcon.className = dark ? 'ri-sun-line' : 'ri-moon-line';
  if (themeLabel) themeLabel.textContent = dark ? 'Mode Terang' : 'Mode Gelap';
  localStorage.setItem('sm_theme', dark ? 'dark' : 'light');
}

document.getElementById('themeToggle').addEventListener('click', () => {
  applyTheme(!document.body.classList.contains('dark'));
});
document.getElementById('themeQuickBtn')?.addEventListener('click', () => {
  applyTheme(!document.body.classList.contains('dark'));
});

// Load saved theme
applyTheme(localStorage.getItem('sm_theme') === 'dark');

// ============================================================
//  TOPBAR DATE
// ============================================================
function updateDate() {
  const el = document.getElementById('topbarDate');
  if (!el) return;
  el.textContent = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}
updateDate();
setInterval(updateDate, 60000);

// ============================================================
//  MOBILE SIDEBAR & DRAWER
// ============================================================
const sidebarEl = document.getElementById('sidebar');
const overlayEl = document.getElementById('sidebarOverlay');

function openMobileSidebar() {
  sidebarEl.classList.add('mobile-open');
  overlayEl.classList.add('active');
}
function closeMobileSidebar() {
  sidebarEl.classList.remove('mobile-open');
  overlayEl.classList.remove('active');
}

document.getElementById('menuBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  if (sidebarEl.classList.contains('mobile-open')) {
    closeMobileSidebar();
  } else {
    openMobileSidebar();
  }
});

document.getElementById('sidebarCloseBtn')?.addEventListener('click', closeMobileSidebar);
overlayEl?.addEventListener('click', closeMobileSidebar);

// ============================================================
//  PANDUAN BUKA DI HANDPHONE MODAL
// ============================================================
const modalPhoneGuide = document.getElementById('modalPhoneGuide');
function showPhoneGuide() {
  if (modalPhoneGuide) modalPhoneGuide.classList.add('open');
  closeMobileSidebar();
}
function hidePhoneGuide() {
  if (modalPhoneGuide) modalPhoneGuide.classList.remove('open');
}

document.getElementById('btnOpenPhoneGuide')?.addEventListener('click', showPhoneGuide);
document.getElementById('topbarPhoneBtn')?.addEventListener('click', showPhoneGuide);
document.getElementById('closePhoneModal')?.addEventListener('click', hidePhoneGuide);
document.getElementById('btnDonePhoneModal')?.addEventListener('click', hidePhoneGuide);

modalPhoneGuide?.addEventListener('click', (e) => {
  if (e.target === modalPhoneGuide) hidePhoneGuide();
});

// Guide tabs switch
document.querySelectorAll('.guide-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.guide-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const guideType = tab.dataset.guide;
    const onlinePane = document.getElementById('guide-online');
    const wifiPane = document.getElementById('guide-wifi');
    if (guideType === 'online') {
      onlinePane.style.display = 'block';
      wifiPane.style.display = 'none';
    } else {
      onlinePane.style.display = 'none';
      wifiPane.style.display = 'block';
    }
  });
});

// Copy GitHub URL button
document.getElementById('btnCopyGhUrl')?.addEventListener('click', () => {
  const urlInput = document.getElementById('ghUrlInput');
  if (urlInput) {
    urlInput.select();
    navigator.clipboard.writeText(urlInput.value).then(() => {
      showToast('Link GitHub Pages berhasil disalin!', 'success');
    }).catch(() => {
      showToast('Silakan salin manual: ' + urlInput.value, 'info');
    });
  }
});

// ============================================================
//  DASHBOARD
// ============================================================
function renderDashboard() {
  const products = DB.getProducts();
  const transactions = DB.getTransactions();

  // Stats
  const totalJenis = products.length;
  const totalUnit  = products.reduce((s, p) => s + (Number(p.stok) || 0), 0);
  const totalNilai = products.reduce((s, p) => s + (Number(p.stok) * Number(p.hargaBeli) || 0), 0);
  const kritis     = products.filter(p => getStockStatus(p) !== 'aman').length;

  document.getElementById('statJenis').textContent = totalJenis;
  document.getElementById('statUnit').textContent  = totalUnit.toLocaleString('id-ID');
  document.getElementById('statNilai').textContent = formatRupiah(totalNilai);
  document.getElementById('statKritis').textContent = kritis;

  // Ringkasan per jenis produk (Voucher, Rokok, Makanan & Minuman, ATK)
  renderDashboardCategories();

  // Recent transactions (last 6)
  const recentEl = document.getElementById('dashRecentList');
  const recent = [...transactions].sort((a,b) => new Date(b.tgl) - new Date(a.tgl)).slice(0, 6);
  if (!recent.length) {
    recentEl.innerHTML = `<div class="empty-state"><i class="ri-inbox-2-line"></i><p>Belum ada transaksi</p></div>`;
  } else {
    recentEl.innerHTML = recent.map(t => {
      const isIn  = t.jenis === 'masuk';
      const icon  = isIn ? 'ri-arrow-down-circle-fill' : (t.jenis === 'opname' ? 'ri-calculator-fill' : 'ri-arrow-up-circle-fill');
      const cls   = isIn ? 'masuk' : (t.jenis === 'opname' ? '' : 'keluar');
      const sign  = isIn ? '+' : (t.jenis === 'opname' ? '±' : '-');
      const amt   = t.jumlah ? `${sign}${t.jumlah} ${t.satuan || ''}` : '';
      return `<div class="tx-item">
        <div class="tx-icon ${cls}"><i class="${icon}"></i></div>
        <div class="tx-info">
          <div class="tx-name">${t.namaProduk || t.keterangan || '-'}</div>
          <div class="tx-meta">${formatDate(t.tgl)}</div>
        </div>
        <div class="tx-amount ${cls}">${amt}</div>
      </div>`;
    }).join('');
  }

  // Stock alerts
  const alertEl = document.getElementById('dashAlertList');
  const alerts = products.filter(p => getStockStatus(p) !== 'aman');
  if (!alerts.length) {
    alertEl.innerHTML = `<div class="empty-state"><i class="ri-checkbox-circle-line"></i><p>Semua stok aman ✓</p></div>`;
  } else {
    alertEl.innerHTML = alerts.map(p => {
      const st = getStockStatus(p);
      const badgeText = st === 'minus' ? 'Minus' : st === 'habis' ? 'Habis' : 'Menipis';
      return `<div class="alert-item ${st}">
        <div>
          <div class="ai-name">${p.nama}</div>
          <div class="ai-info">${Number(p.stok).toLocaleString('id-ID')} ${p.satuan}${p.minStok > 0 ? ` &bull; Min: ${p.minStok} ${p.satuan}` : ''}</div>
        </div>
        <span class="ai-badge badge badge-${st}">${badgeText}</span>
      </div>`;
    }).join('');
  }
}

function renderDashboardCategories() {
  const container = document.getElementById('dashCategoryGrid');
  if (!container) return;

  const products = DB.getProducts();
  const categoriesDef = [
    { key: 'Voucher & Pulsa', name: 'Voucher & Paket Data', icon: 'ri-wifi-line', cls: 'cat-voucher' },
    { key: 'Rokok', name: 'Rokok', icon: 'ri-fire-line', cls: 'cat-rokok' },
    { key: 'Makanan & Minuman', name: 'Makanan & Minuman', icon: 'ri-restaurant-line', cls: 'cat-fnb' },
    { key: 'ATK', name: 'ATK (Alat Tulis Kantor)', icon: 'ri-pencil-ruler-2-line', cls: 'cat-atk' },
  ];

  const grouped = {};
  categoriesDef.forEach(c => {
    grouped[c.key] = { count: 0, units: 0, aset: 0, ...c };
  });
  let otherGroup = { key: 'Lainnya', name: 'Kategori Lainnya', icon: 'ri-price-tag-3-line', cls: 'cat-other', count: 0, units: 0, aset: 0 };

  products.forEach(p => {
    const meta = getCategoryMeta(p.kategori);
    const grp = meta.group;
    if (grouped[grp]) {
      grouped[grp].count++;
      grouped[grp].units += (Number(p.stok) || 0);
      grouped[grp].aset += (Number(p.stok) * Number(p.hargaBeli) || 0);
    } else {
      otherGroup.count++;
      otherGroup.units += (Number(p.stok) || 0);
      otherGroup.aset += (Number(p.stok) * Number(p.hargaBeli) || 0);
    }
  });

  const allCards = [...Object.values(grouped)];
  if (otherGroup.count > 0) {
    allCards.push(otherGroup);
  }

  container.innerHTML = allCards.map(c => `
    <div class="cat-card" onclick="filterKatalogByGroup('${c.key}')" title="Klik untuk lihat produk ${c.name} di katalog">
      <div>
        <div class="cat-card-header">
          <span class="cat-card-title">${c.name}</span>
          <div class="cat-card-icon ${c.cls}"><i class="${c.icon}"></i></div>
        </div>
        <div class="cat-card-count">
          ${c.count} <span style="font-size:.78rem;font-weight:500;color:var(--text-3);">SKU</span>
        </div>
      </div>
      <div class="cat-card-stats">
        <span>Stok: <strong>${c.units.toLocaleString('id-ID')} unit</strong></span>
        <span>Aset: <strong>${formatRupiah(c.aset)}</strong></span>
      </div>
    </div>
  `).join('');
}

function filterKatalogByGroup(groupKey) {
  currentKatalogCategory = groupKey;
  switchTab('produk');
  renderTableProduk(groupKey);
}

// ============================================================
//  KATALOG PRODUK (DENGAN PEMISAHAN KATEGORI)
// ============================================================
let editingProdukId = null;

function renderKatalogCategoryPills() {
  const container = document.getElementById('katalogCategoryPills');
  if (!container) return;

  const products = DB.getProducts();
  const categoriesDef = [
    { key: '', name: 'Semua Produk', icon: 'ri-apps-2-line' },
    { key: 'Voucher & Pulsa', name: 'Voucher & Pulsa', icon: 'ri-wifi-line' },
    { key: 'Rokok', name: 'Rokok', icon: 'ri-fire-line' },
    { key: 'Makanan & Minuman', name: 'Makanan & Minuman', icon: 'ri-restaurant-line' },
    { key: 'ATK', name: 'ATK', icon: 'ri-pencil-ruler-2-line' },
  ];

  const counts = { '': products.length };
  categoriesDef.forEach(c => { if (c.key) counts[c.key] = 0; });
  let otherCount = 0;

  products.forEach(p => {
    const meta = getCategoryMeta(p.kategori);
    if (counts[meta.group] !== undefined) {
      counts[meta.group]++;
    } else {
      otherCount++;
    }
  });

  const list = [...categoriesDef];
  if (otherCount > 0) {
    list.push({ key: 'Lainnya', name: 'Lainnya', icon: 'ri-price-tag-3-line' });
    counts['Lainnya'] = otherCount;
  }

  container.innerHTML = list.map(c => `
    <button type="button" class="cat-pill ${currentKatalogCategory === c.key ? 'active' : ''}" data-cat="${c.key}">
      <i class="${c.icon}"></i> ${c.name}
      <span class="pill-count">${counts[c.key] || 0}</span>
    </button>
  `).join('');

  container.querySelectorAll('.cat-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      currentKatalogCategory = btn.dataset.cat;
      const sel = document.getElementById('filterKategori');
      if (sel) sel.value = currentKatalogCategory;
      renderTableProduk(currentKatalogCategory);
    });
  });
}

function renderTableProduk(filterKat = currentKatalogCategory, filterSt = '', q = '') {
  currentKatalogCategory = filterKat !== undefined ? filterKat : currentKatalogCategory;
  renderKatalogCategoryPills();

  let products = DB.getProducts();

  // Populate kategori datalist & filter select
  const kats = [...new Set(products.map(p => p.kategori).filter(Boolean))];
  const datalist = document.getElementById('kategoriList');
  if (datalist) {
    datalist.innerHTML = ['Voucher & Pulsa', 'Rokok', 'Makanan & Minuman', 'ATK', ...kats].map(k => `<option value="${k}">`).join('');
  }
  const sel = document.getElementById('filterKategori');
  if (sel) {
    const cur = currentKatalogCategory || sel.value;
    sel.innerHTML = `<option value="">Semua Kategori</option>` +
      ['Voucher & Pulsa', 'Rokok', 'Makanan & Minuman', 'ATK'].map(k => `<option value="${k}" ${k === cur ? 'selected' : ''}>${k}</option>`).join('') +
      kats.filter(k => !['Voucher & Pulsa', 'Rokok', 'Makanan & Minuman', 'ATK'].includes(k)).map(k => `<option value="${k}" ${k === cur ? 'selected' : ''}>${k}</option>`).join('');
  }

  const activeKat = currentKatalogCategory || (sel ? sel.value : '');
  if (activeKat) {
    products = products.filter(p => {
      const meta = getCategoryMeta(p.kategori);
      if (activeKat === 'Lainnya') {
        return !['Voucher & Pulsa', 'Rokok', 'Makanan & Minuman', 'ATK'].includes(meta.group);
      }
      return meta.group.toLowerCase() === activeKat.toLowerCase() ||
             (p.kategori && p.kategori.toLowerCase() === activeKat.toLowerCase());
    });
  }

  if (filterSt || document.getElementById('filterStatus').value) {
    const f = filterSt || document.getElementById('filterStatus').value;
    if (f) products = products.filter(p => getStockStatus(p) === f);
  }
  if (q) {
    const qLower = q.toLowerCase();
    products = products.filter(p =>
      p.nama.toLowerCase().includes(qLower) ||
      (p.kategori && p.kategori.toLowerCase().includes(qLower)) ||
      (p.kode && p.kode.toLowerCase().includes(qLower))
    );
  }

  const tbody = document.getElementById('bodyProduk');
  if (!products.length) {
    tbody.innerHTML = `<tr><td colspan="10" class="empty-row"><i class="ri-inbox-2-line"></i> Tidak ada barang dalam kategori ${activeKat ? `"${activeKat}"` : ''}</td></tr>`;
    return;
  }
  tbody.innerHTML = products.map((p, i) => {
    const st = getStockStatus(p);
    const meta = getCategoryMeta(p.kategori);
    return `<tr>
      <td>${i+1}</td>
      <td class="fw-bold">
        ${p.nama}
        ${p.kode ? `<br><small style="font-family:monospace;font-weight:normal;color:var(--text-3);"><i class="ri-barcode-line"></i> ${p.kode}</small>` : ''}
      </td>
      <td>
        <span class="cat-badge ${meta.colorCls}">
          <i class="${meta.icon}"></i> ${p.kategori || meta.label}
        </span>
      </td>
      <td>${p.satuan}</td>
      <td class="fw-bold ${st === 'minus' ? 'text-red' : st === 'habis' ? 'text-red' : st === 'menipis' ? 'text-yellow' : ''}">${Number(p.stok).toLocaleString('id-ID')}</td>
      <td>${p.minStok !== undefined && p.minStok !== null ? p.minStok : 0}</td>
      <td>${formatRupiah(p.hargaBeli)}</td>
      <td>${formatRupiah(p.hargaJual)}</td>
      <td>${statusBadge(st)}</td>
      <td>
        <div style="display:flex;gap:.3rem;">
          <button class="btn btn-icon" onclick="openEditProduk('${p.id}')" title="Edit"><i class="ri-edit-line"></i></button>
          <button class="btn btn-icon danger" onclick="hapusProduk('${p.id}')" title="Hapus"><i class="ri-delete-bin-line"></i></button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function filterAndRenderProduk(q) {
  renderTableProduk(currentKatalogCategory, '', q);
}

document.getElementById('filterKategori').addEventListener('change', function() {
  currentKatalogCategory = this.value;
  renderTableProduk(currentKatalogCategory);
});
document.getElementById('filterStatus').addEventListener('change', () => renderTableProduk());

// Add product button
document.getElementById('btnAddProduk').addEventListener('click', () => {
  editingProdukId = null;
  document.getElementById('formProduk').reset();
  document.getElementById('produkId').value = '';
  if (document.getElementById('produkKode')) document.getElementById('produkKode').value = '';
  document.querySelectorAll('#categoryPresets .preset-chip').forEach(c => c.classList.remove('active'));
  const lbl = document.getElementById('lblProdukStok');
  if (lbl) lbl.textContent = 'Stok Awal';
  document.getElementById('produkStokAwal').value = '0';
  document.getElementById('produkMinStok').value = '0';
  document.getElementById('modalProdukTitle').textContent = 'Tambah Barang Baru';
  document.getElementById('saveProdukBtn').textContent = 'Simpan Barang';
  document.getElementById('modalProduk').classList.add('open');
});
document.getElementById('closeProdukModal').addEventListener('click', () => document.getElementById('modalProduk').classList.remove('open'));
document.getElementById('cancelProdukModal').addEventListener('click', () => document.getElementById('modalProduk').classList.remove('open'));
document.getElementById('modalProduk').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modalProduk')) document.getElementById('modalProduk').classList.remove('open');
});

// Preset Chips Kategori di Modal Tambah/Edit Produk
document.querySelectorAll('#categoryPresets .preset-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('#categoryPresets .preset-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    const cat = chip.dataset.cat;
    const inp = document.getElementById('produkKategori');
    if (inp) inp.value = cat;
    const defSatuan = chip.dataset.satuan;
    const satSelect = document.getElementById('produkSatuan');
    if (defSatuan && satSelect) {
      satSelect.value = defSatuan;
    }
  });
});

// Filter Jenis Produk pada Form Barang Masuk
document.querySelectorAll('#masukCatFilter .tx-cat-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#masukCatFilter .tx-cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentMasukCategory = btn.dataset.cat;
    populateProdukSelects(currentMasukCategory, currentKeluarCategory);
  });
});

// Filter Jenis Produk pada Form Barang Keluar
document.querySelectorAll('#keluarCatFilter .tx-cat-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#keluarCatFilter .tx-cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentKeluarCategory = btn.dataset.cat;
    populateProdukSelects(currentMasukCategory, currentKeluarCategory);
  });
});

// Save product
document.getElementById('formProduk').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('produkId').value;
  const rawStok = document.getElementById('produkStokAwal').value;
  const stokVal = rawStok !== '' ? Number(rawStok) : 0;
  const rawMinStok = document.getElementById('produkMinStok').value;
  const minStokVal = rawMinStok !== '' ? Number(rawMinStok) : 0;

  const data = {
    id: id || '',
    kode:       (document.getElementById('produkKode')?.value || '').trim(),
    nama:       document.getElementById('produkNama').value.trim(),
    kategori:   document.getElementById('produkKategori').value.trim(),
    satuan:     document.getElementById('produkSatuan').value,
    stok:       stokVal,
    minStok:    minStokVal,
    hargaBeli:  Number(document.getElementById('produkHargaBeli').value) || 0,
    hargaJual:  Number(document.getElementById('produkHargaJual').value) || 0,
    deskripsi:  document.getElementById('produkDeskripsi').value.trim(),
  };

  await DB.saveProduct(data);
  document.getElementById('modalProduk').classList.remove('open');
  renderTableProduk();
  showToast(id ? 'Barang berhasil diperbarui di database!' : 'Barang baru berhasil disimpan ke database!', 'success');
});

function openEditProduk(id) {
  const p = DB.getProducts().find(x => x.id === id);
  if (!p) return;
  editingProdukId = id;
  document.getElementById('produkId').value = p.id;
  if (document.getElementById('produkKode')) document.getElementById('produkKode').value = p.kode || '';
  document.getElementById('produkNama').value = p.nama;
  document.getElementById('produkKategori').value = p.kategori || '';
  
  // Highlight active preset chip if matches
  const meta = getCategoryMeta(p.kategori);
  document.querySelectorAll('#categoryPresets .preset-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.cat.toLowerCase() === meta.group.toLowerCase() || c.dataset.cat.toLowerCase() === (p.kategori || '').toLowerCase());
  });

  document.getElementById('produkSatuan').value = p.satuan;
  const lbl = document.getElementById('lblProdukStok');
  if (lbl) lbl.textContent = 'Jumlah Stok';
  document.getElementById('produkStokAwal').value = p.stok;
  document.getElementById('produkMinStok').value = p.minStok !== undefined && p.minStok !== null ? p.minStok : 0;
  document.getElementById('produkHargaBeli').value = p.hargaBeli;
  document.getElementById('produkHargaJual').value = p.hargaJual;
  document.getElementById('produkDeskripsi').value = p.deskripsi || '';
  document.getElementById('modalProdukTitle').textContent = 'Edit Barang';
  document.getElementById('saveProdukBtn').textContent = 'Perbarui Barang';
  document.getElementById('modalProduk').classList.add('open');
}

function hapusProduk(id) {
  const p = DB.getProducts().find(x => x.id === id);
  if (!p) return;
  showConfirm('Hapus Barang', `Hapus "${p.nama}" dari katalog? Data stok akan terhapus dari database.`, async () => {
    await DB.deleteProduct(id);
    renderTableProduk();
    showToast('Barang berhasil dihapus dari database.', 'warning');
  });
}

// ============================================================
//  POPULATE PRODUCT SELECTS (dengan Filter Jenis Produk)
// ============================================================
function populateProdukSelects(catMasuk = currentMasukCategory, catKeluar = currentKeluarCategory) {
  const products = DB.getProducts();

  // Filter untuk Form Masuk
  let prodsMasuk = products;
  if (catMasuk) {
    prodsMasuk = products.filter(p => {
      const meta = getCategoryMeta(p.kategori);
      return meta.group === catMasuk || p.kategori === catMasuk;
    });
  }
  const optMasuk = prodsMasuk.length
    ? prodsMasuk.map(p => `<option value="${p.id}">${p.kode ? '[' + p.kode + '] ' : ''}${p.nama} (Stok: ${p.stok} ${p.satuan})</option>`).join('')
    : `<option value="" disabled>${catMasuk ? 'Belum ada produk ' + catMasuk : 'Belum ada barang di Katalog'}</option>`;

  const elMasuk = document.getElementById('masukProduk');
  if (elMasuk) {
    const prev = elMasuk.value;
    elMasuk.innerHTML = `<option value="">-- Pilih Barang ${catMasuk ? '(' + catMasuk + ')' : ''} --</option>` + optMasuk;
    if (prev && prodsMasuk.some(p => p.id === prev)) elMasuk.value = prev;
  }

  // Filter untuk Form Keluar
  let prodsKeluar = products;
  if (catKeluar) {
    prodsKeluar = products.filter(p => {
      const meta = getCategoryMeta(p.kategori);
      return meta.group === catKeluar || p.kategori === catKeluar;
    });
  }
  const optKeluar = prodsKeluar.length
    ? prodsKeluar.map(p => `<option value="${p.id}">${p.kode ? '[' + p.kode + '] ' : ''}${p.nama} (Stok: ${p.stok} ${p.satuan})</option>`).join('')
    : `<option value="" disabled>${catKeluar ? 'Belum ada produk ' + catKeluar : 'Belum ada barang di Katalog'}</option>`;

  const elKeluar = document.getElementById('keluarProduk');
  if (elKeluar) {
    const prev = elKeluar.value;
    elKeluar.innerHTML = `<option value="">-- Pilih Barang ${catKeluar ? '(' + catKeluar + ')' : ''} --</option>` + optKeluar;
    if (prev && prodsKeluar.some(p => p.id === prev)) elKeluar.value = prev;
  }
}

// ============================================================
//  BARANG MASUK
// ============================================================
document.getElementById('masukProduk').addEventListener('change', updateMasukPreview);
document.getElementById('masukJumlah').addEventListener('input', updateMasukPreview);
document.getElementById('masukHarga').addEventListener('input', updateMasukPreview);

function updateMasukPreview() {
  const jumlah = Number(document.getElementById('masukJumlah').value) || 0;
  const harga  = Number(document.getElementById('masukHarga').value) || 0;
  const total  = jumlah * harga;
  const pb = document.getElementById('masukPreview');
  if (jumlah > 0 && harga > 0) {
    pb.style.display = 'block';
    document.getElementById('masukTotal').textContent = formatRupiah(total);
  } else {
    pb.style.display = 'none';
  }
}

document.getElementById('formMasuk').addEventListener('submit', async (e) => {
  e.preventDefault();
  const produkId  = document.getElementById('masukProduk').value;
  const jumlah    = Number(document.getElementById('masukJumlah').value);
  const hargaBeli = Number(document.getElementById('masukHarga').value);
  const supplier  = document.getElementById('masukSupplier').value.trim();
  const nota      = document.getElementById('masukNota').value.trim();
  const ket       = document.getElementById('masukKet').value.trim();

  if (!produkId) { showToast('Pilih barang terlebih dahulu.', 'error'); return; }
  if (isNaN(jumlah) || jumlah === 0) { showToast('Masukkan jumlah barang masuk yang valid (tidak boleh 0).', 'error'); return; }

  try {
    const res = await DB.catatMasuk({ produkId, jumlah, hargaBeli, supplier, nota, keterangan: ket });
    document.getElementById('formMasuk').reset();
    document.getElementById('masukPreview').style.display = 'none';
    populateProdukSelects();
    renderListMasuk();
    showToast(res.message || `+${jumlah} barang masuk berhasil disimpan permanen ke database!`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
});

function renderListMasuk() {
  const txs = DB.getTransactions().filter(t => t.jenis === 'masuk').slice(0, 20);
  const el  = document.getElementById('listMasuk');
  if (!txs.length) {
    el.innerHTML = `<div class="empty-state"><i class="ri-inbox-2-line"></i><p>Belum ada data barang masuk</p></div>`;
    return;
  }
  el.innerHTML = txs.map(t => `
    <div class="tx-item">
      <div class="tx-icon masuk"><i class="ri-arrow-down-circle-fill"></i></div>
      <div class="tx-info">
        <div class="tx-name">${t.namaProduk}</div>
        <div class="tx-meta">${formatDate(t.tgl)}${t.supplier ? ' &bull; ' + t.supplier : ''}</div>
      </div>
      <div class="tx-amount masuk">+${t.jumlah} ${t.satuan}</div>
    </div>
  `).join('');
}

// ============================================================
//  BARANG KELUAR
// ============================================================
document.getElementById('keluarProduk').addEventListener('change', function() {
  const pid = this.value;
  const el  = document.getElementById('keluarStokInfo');
  if (!pid) { el.textContent = 'Pilih barang terlebih dahulu'; return; }
  const p = DB.getProducts().find(x => x.id === pid);
  if (p) {
    const stokNum = Number(p.stok) || 0;
    el.textContent = `${stokNum.toLocaleString('id-ID')} ${p.satuan}`;
    el.style.color = stokNum < 0 ? 'var(--red)' : stokNum === 0 ? 'var(--red)' : (p.minStok > 0 && stokNum <= p.minStok) ? 'var(--yellow)' : 'var(--green)';
  }
  updateKeluarPreview();
});
document.getElementById('keluarJumlah').addEventListener('input', updateKeluarPreview);

function updateKeluarPreview() {
  const pid    = document.getElementById('keluarProduk').value;
  const jumlah = Number(document.getElementById('keluarJumlah').value) || 0;
  const p      = pid ? DB.getProducts().find(x => x.id === pid) : null;
  const pb     = document.getElementById('keluarPreview');
  if (p && jumlah > 0) {
    pb.style.display = 'block';
    document.getElementById('keluarTotal').textContent = formatRupiah(jumlah * p.hargaJual);
  } else {
    pb.style.display = 'none';
  }
}

document.getElementById('formKeluar').addEventListener('submit', async (e) => {
  e.preventDefault();
  const produkId = document.getElementById('keluarProduk').value;
  const jumlah   = Number(document.getElementById('keluarJumlah').value);
  const jenis    = document.getElementById('keluarJenis').value;
  const ket      = document.getElementById('keluarKet').value.trim();

  if (!produkId) { showToast('Pilih barang terlebih dahulu.', 'error'); return; }
  if (isNaN(jumlah) || jumlah === 0) { showToast('Masukkan jumlah pengeluaran yang valid (tidak boleh 0).', 'error'); return; }

  try {
    const res = await DB.catatKeluar({ produkId, jumlah, jenisKeluar: jenis, keterangan: ket });
    document.getElementById('formKeluar').reset();
    document.getElementById('keluarStokInfo').textContent = 'Pilih barang terlebih dahulu';
    document.getElementById('keluarStokInfo').style.color = '';
    document.getElementById('keluarPreview').style.display = 'none';
    populateProdukSelects();
    renderListKeluar();
    showToast(res.message || `-${jumlah} barang keluar berhasil disimpan ke database!`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
});

function renderListKeluar() {
  const txs = DB.getTransactions().filter(t => t.jenis === 'keluar').slice(0, 20);
  const el  = document.getElementById('listKeluar');
  if (!txs.length) {
    el.innerHTML = `<div class="empty-state"><i class="ri-inbox-2-line"></i><p>Belum ada data barang keluar</p></div>`;
    return;
  }
  el.innerHTML = txs.map(t => `
    <div class="tx-item">
      <div class="tx-icon keluar"><i class="ri-arrow-up-circle-fill"></i></div>
      <div class="tx-info">
        <div class="tx-name">${t.namaProduk}</div>
        <div class="tx-meta">${formatDate(t.tgl)} &bull; ${t.jenisKeluar || '-'}</div>
      </div>
      <div class="tx-amount keluar">-${t.jumlah} ${t.satuan}</div>
    </div>
  `).join('');
}

// ============================================================
//  HITUNG BARANG / STOCK OPNAME (DENGAN PEMISAHAN KATEGORI)
// ============================================================
function renderOpnameCategoryPills() {
  const container = document.getElementById('opnameCategoryPills');
  if (!container) return;

  const products = DB.getProducts();
  const categoriesDef = [
    { key: '', name: 'Semua Produk', icon: 'ri-apps-2-line' },
    { key: 'Voucher & Pulsa', name: 'Voucher & Pulsa', icon: 'ri-wifi-line' },
    { key: 'Rokok', name: 'Rokok', icon: 'ri-fire-line' },
    { key: 'Makanan & Minuman', name: 'Makanan & Minuman', icon: 'ri-restaurant-line' },
    { key: 'ATK', name: 'ATK', icon: 'ri-pencil-ruler-2-line' },
  ];

  const counts = { '': products.length };
  categoriesDef.forEach(c => { if (c.key) counts[c.key] = 0; });
  let otherCount = 0;

  products.forEach(p => {
    const meta = getCategoryMeta(p.kategori);
    if (counts[meta.group] !== undefined) {
      counts[meta.group]++;
    } else {
      otherCount++;
    }
  });

  const list = [...categoriesDef];
  if (otherCount > 0) {
    list.push({ key: 'Lainnya', name: 'Lainnya', icon: 'ri-price-tag-3-line' });
    counts['Lainnya'] = otherCount;
  }

  container.innerHTML = list.map(c => `
    <button type="button" class="cat-pill ${currentOpnameCategory === c.key ? 'active' : ''}" data-cat="${c.key}">
      <i class="${c.icon}"></i> ${c.name}
      <span class="pill-count">${counts[c.key] || 0}</span>
    </button>
  `).join('');

  container.querySelectorAll('.cat-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      currentOpnameCategory = btn.dataset.cat;
      renderOpname(currentOpnameCategory);
    });
  });
}

function renderOpname(filterCat = currentOpnameCategory) {
  currentOpnameCategory = filterCat !== undefined ? filterCat : currentOpnameCategory;
  renderOpnameCategoryPills();

  let products = DB.getProducts();
  if (currentOpnameCategory) {
    products = products.filter(p => {
      const meta = getCategoryMeta(p.kategori);
      if (currentOpnameCategory === 'Lainnya') {
        return !['Voucher & Pulsa', 'Rokok', 'Makanan & Minuman', 'ATK'].includes(meta.group);
      }
      return meta.group.toLowerCase() === currentOpnameCategory.toLowerCase() ||
             (p.kategori && p.kategori.toLowerCase() === currentOpnameCategory.toLowerCase());
    });
  }

  const tbody = document.getElementById('bodyOpname');
  if (!products.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-row"><i class="ri-inbox-2-line"></i> Tidak ada barang dalam kategori ${currentOpnameCategory ? `"${currentOpnameCategory}"` : ''}</td></tr>`;
    renderOpnameHistory();
    return;
  }
  tbody.innerHTML = products.map(p => {
    const meta = getCategoryMeta(p.kategori);
    return `
      <tr data-id="${p.id}" data-sistem="${p.stok}" data-satuan="${p.satuan}" data-nama="${p.nama}">
        <td class="fw-bold">
          ${p.nama}
          <br><span class="cat-badge ${meta.colorCls}" style="font-size:.68rem;padding:.1rem .4rem;margin-top:.2rem;"><i class="${meta.icon}"></i> ${p.kategori || meta.label}</span>
        </td>
        <td>${p.satuan}</td>
        <td class="fw-bold">${Number(p.stok).toLocaleString('id-ID')}</td>
        <td>
          <input type="number" class="form-control opname-input" 
                 id="opname-${p.id}" 
                 step="any" placeholder="Masukkan jumlah fisik"
                 style="max-width:160px;"
                 oninput="updateDiff('${p.id}')" />
        </td>
        <td id="diff-${p.id}" class="diff-zero">—</td>
        <td>
          <input type="text" class="form-control" id="opname-ket-${p.id}" 
                 placeholder="Catatan..." style="max-width:180px;" />
        </td>
      </tr>
    `;
  }).join('');
  renderOpnameHistory();
}

function updateDiff(id) {
  const row    = document.querySelector(`tr[data-id="${id}"]`);
  const sistem = Number(row?.dataset.sistem) || 0;
  const fisik  = Number(document.getElementById(`opname-${id}`)?.value);
  const el     = document.getElementById(`diff-${id}`);
  if (!el) return;
  if (document.getElementById(`opname-${id}`).value === '') {
    el.textContent = '—'; el.className = 'diff-zero'; return;
  }
  const diff = fisik - sistem;
  if (diff > 0)      { el.textContent = `+${diff}`; el.className = 'diff-pos'; }
  else if (diff < 0) { el.textContent = `${diff}`;  el.className = 'diff-neg'; }
  else               { el.textContent = '0 (Cocok)'; el.className = 'diff-zero'; }
}

document.getElementById('btnResetOpname').addEventListener('click', () => {
  document.querySelectorAll('.opname-input').forEach(inp => {
    inp.value = '';
    const id = inp.id.replace('opname-', '');
    const el = document.getElementById(`diff-${id}`);
    if (el) { el.textContent = '—'; el.className = 'diff-zero'; }
  });
  showToast('Input opname direset.', 'info');
});

document.getElementById('btnSesuaikanOpname').addEventListener('click', () => {
  const products = DB.getProducts();
  const rows = document.querySelectorAll('#bodyOpname tr[data-id]');
  const changes = [];

  rows.forEach(row => {
    const id  = row.dataset.id;
    const inp = document.getElementById(`opname-${id}`);
    if (!inp || inp.value === '') return;
    const fisik  = Number(inp.value);
    const sistem = Number(row.dataset.sistem);
    const ket    = document.getElementById(`opname-ket-${id}`)?.value.trim() || '';
    if (!isNaN(fisik)) {
      changes.push({ id, nama: row.dataset.nama, satuan: row.dataset.satuan, stokSistem: sistem, stokFisik: fisik, selisih: fisik - sistem, keterangan: ket });
    }
  });

  if (!changes.length) {
    showToast('Tidak ada input fisik yang diisi.', 'warning'); return;
  }

  showConfirm(
    'Sesuaikan Stok Sistem',
    `Akan menyesuaikan stok untuk ${changes.length} barang berdasarkan hasil hitung fisik. Lanjutkan?`,
    async () => {
      await DB.catatOpname(changes);
      renderOpname();
      showToast(`Stok ${changes.length} barang berhasil disesuaikan dan disimpan ke database!`, 'success');
    }
  );
});

function renderOpnameHistory() {
  const opnames = DB.getOpnames();
  const el = document.getElementById('opnameHistory');
  if (!opnames.length) {
    el.innerHTML = `<div class="empty-state"><i class="ri-inbox-2-line"></i><p>Belum ada riwayat opname</p></div>`;
    return;
  }
  el.innerHTML = opnames.slice(0, 10).map(o => {
    const surplus = o.items.filter(i => i.selisih > 0).length;
    const minus   = o.items.filter(i => i.selisih < 0).length;
    const cocok   = o.items.filter(i => i.selisih === 0).length;
    return `<div class="opname-log">
      <div class="opname-log-header">
        <span class="opname-log-title"><i class="ri-calculator-line"></i> Stock Opname — ${o.items.length} barang</span>
        <span class="opname-log-date">${formatDate(o.tgl)}</span>
      </div>
      <div class="opname-log-items">
        <span class="diff-pos">Surplus: ${surplus}</span> &bull;
        <span class="diff-neg">Minus: ${minus}</span> &bull;
        <span class="diff-zero">Cocok: ${cocok}</span>
        <div style="margin-top:.4rem;">${o.items.slice(0,3).map(i =>
          `<span>${i.nama}: <b class="${i.selisih > 0 ? 'diff-pos' : i.selisih < 0 ? 'diff-neg' : 'diff-zero'}">${i.selisih >= 0 ? '+' : ''}${i.selisih}</b></span>`
        ).join(' &bull; ')}${o.items.length > 3 ? ` &bull; <span>+${o.items.length-3} lainnya</span>` : ''}</div>
      </div>
    </div>`;
  }).join('');
}

// ============================================================
//  RIWAYAT MUTASI
// ============================================================
function renderRiwayat() {
  let txs   = DB.getTransactions();
  const jenis = document.getElementById('filterRiwayatJenis').value;
  const tgl   = document.getElementById('filterRiwayatTgl').value;

  if (jenis) txs = txs.filter(t => t.jenis === jenis);
  if (tgl) {
    txs = txs.filter(t => {
      const d = new Date(t.tgl);
      return d.toISOString().startsWith(tgl);
    });
  }
  txs = txs.sort((a,b) => new Date(b.tgl) - new Date(a.tgl));

  const tbody = document.getElementById('bodyRiwayat');
  if (!txs.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-row"><i class="ri-inbox-2-line"></i> Belum ada riwayat mutasi</td></tr>`;
    return;
  }
  tbody.innerHTML = txs.map(t => {
    const jenisLabel = t.jenis === 'masuk' ? 'Barang Masuk' : t.jenis === 'keluar' ? 'Barang Keluar' : 'Stock Opname';
    const sign = t.jenis === 'masuk' ? '+' : t.jenis === 'keluar' ? '-' : '±';
    const bCls = `badge-${t.jenis === 'masuk' ? 'masuk' : t.jenis === 'keluar' ? 'keluar' : 'opname'}`;
    return `<tr>
      <td style="white-space:nowrap;">${formatDate(t.tgl)}</td>
      <td><span class="badge ${bCls}">${jenisLabel}</span></td>
      <td class="fw-bold">${t.namaProduk || '-'}</td>
      <td>${sign}${t.jumlah} ${t.satuan || ''}</td>
      <td>${t.keterangan || t.supplier || '-'}</td>
      <td>${t.total ? formatRupiah(t.total) : '-'}</td>
    </tr>`;
  }).join('');
}

document.getElementById('filterRiwayatJenis').addEventListener('change', renderRiwayat);
document.getElementById('filterRiwayatTgl').addEventListener('change', renderRiwayat);
document.getElementById('btnClearRiwayat').addEventListener('click', () => {
  showConfirm('Hapus Semua Riwayat', 'Ini akan menghapus seluruh riwayat mutasi di database. Data stok tidak berubah.', async () => {
    await DB.clearTransactions();
    renderRiwayat();
    showToast('Riwayat mutasi berhasil dihapus dari database.', 'warning');
  });
});

// ============================================================
//  KELOLA DATABASE & BACKUP MODAL
// ============================================================
const modalDbBackup = document.getElementById('modalDbBackup');
function showDbModal() {
  if (modalDbBackup) modalDbBackup.classList.add('open');
  closeMobileSidebar();
}
function hideDbModal() {
  if (modalDbBackup) modalDbBackup.classList.remove('open');
}

document.getElementById('btnOpenDbBackup')?.addEventListener('click', showDbModal);
document.getElementById('closeDbModal')?.addEventListener('click', hideDbModal);
document.getElementById('btnDoneDbModal')?.addEventListener('click', hideDbModal);
modalDbBackup?.addEventListener('click', (e) => {
  if (e.target === modalDbBackup) hideDbModal();
});

// Download backup JSON
document.getElementById('btnDownloadBackup')?.addEventListener('click', () => {
  const dbData = {
    products: DB.getProducts(),
    transactions: DB.getTransactions(),
    opnames: DB.getOpnames(),
    exportedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(dbData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dStr = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `backup-stockmaster-${dStr}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('File backup database berhasil didownload!', 'success');
});

// Restore backup from JSON
document.getElementById('fileRestoreDb')?.addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async function(evt) {
    try {
      const data = JSON.parse(evt.target.result);
      if (!Array.isArray(data.products)) throw new Error('Format file backup tidak sesuai');
      showConfirm('Pulihkan Database', `Pulihkan ${data.products.length} barang dan ${(data.transactions || []).length} riwayat dari file backup? Data saat ini akan ditimpa.`, async () => {
        await DB.restoreFull(data);
        hideDbModal();
        renderDashboard();
        renderTableProduk();
        populateProdukSelects();
        showToast('Database berhasil dipulihkan dari file backup!', 'success');
      });
    } catch (err) {
      showToast('Gagal memulihkan database: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
  this.value = '';
});

// Muat data contoh (manual pilihan pengguna)
document.getElementById('btnLoadSampleData')?.addEventListener('click', () => {
  showConfirm('Muat Data Contoh', 'Tambahkan produk contoh Voucher, Rokok, Makanan & Minuman, serta ATK ke database?', async () => {
    const seeds = [
      { id: genId(), kode: '8993175535012', nama: 'Voucher Telkomsel 10GB 30 Hari', kategori: 'Voucher & Pulsa', satuan: 'Pcs', stok: 25, minStok: 5, hargaBeli: 28000, hargaJual: 32000, deskripsi: '' },
      { id: genId(), kode: '8992761123001', nama: 'Voucher Tri 6GB 1 Hari', kategori: 'Voucher & Pulsa', satuan: 'Pcs', stok: 15, minStok: 5, hargaBeli: 8000, hargaJual: 10000, deskripsi: '' },
      { id: genId(), kode: '8992745123456', nama: 'Sampoerna A Mild 16', kategori: 'Rokok', satuan: 'Bungkus', stok: 30, minStok: 10, hargaBeli: 31500, hargaJual: 34000, deskripsi: '' },
      { id: genId(), kode: '8992745987654', nama: 'Gudang Garam Surya 12', kategori: 'Rokok', satuan: 'Bungkus', stok: 20, minStok: 8, hargaBeli: 24000, hargaJual: 26000, deskripsi: '' },
      { id: genId(), kode: '8992753123456', nama: 'Indomie Goreng Original', kategori: 'Makanan & Minuman', satuan: 'Pcs', stok: 48, minStok: 15, hargaBeli: 2900, hargaJual: 3500, deskripsi: '' },
      { id: genId(), kode: '8992775123456', nama: 'Teh Pucuk Harum 350ml', kategori: 'Makanan & Minuman', satuan: 'Botol', stok: 24, minStok: 6, hargaBeli: 3200, hargaJual: 4000, deskripsi: '' },
      { id: genId(), kode: '8991389223344', nama: 'Buku Tulis Sinar Dunia 38 Lembar', kategori: 'ATK', satuan: 'Pcs', stok: 40, minStok: 10, hargaBeli: 3500, hargaJual: 4500, deskripsi: '' },
      { id: genId(), kode: '8992812001122', nama: 'Pulpen Standard AE7 Hitam', kategori: 'ATK', satuan: 'Pcs', stok: 50, minStok: 12, hargaBeli: 2000, hargaJual: 3000, deskripsi: '' },
    ];
    for (const p of seeds) {
      await DB.saveProduct(p);
    }
    hideDbModal();
    renderDashboard();
    renderTableProduk();
    populateProdukSelects();
    showToast('Produk contoh (Voucher, Rokok, F&B, ATK) berhasil ditambahkan!', 'success');
  });
});

// Kosongkan database
document.getElementById('btnResetAllData')?.addEventListener('click', () => {
  showConfirm('Kosongkan Seluruh Database', 'PERINGATAN: Semua data barang dan mutasi akan dihapus permanen. Lanjutkan?', async () => {
    await DB.restoreFull({ products: [], transactions: [], opnames: [] });
    hideDbModal();
    renderDashboard();
    renderTableProduk();
    populateProdukSelects();
    showToast('Seluruh database telah dikosongkan.', 'warning');
  });
});

// ============================================================
//  MULTI-DEVICE SYNC & SERVER SETTINGS
// ============================================================
// Copy Wi-Fi Server URL
document.getElementById('btnCopyWifiUrl')?.addEventListener('click', () => {
  const inp = document.getElementById('wifiUrlInput');
  if (inp) {
    inp.select();
    navigator.clipboard.writeText(inp.value).then(() => {
      showToast('Link Wi-Fi Server berhasil disalin! Buka di browser HP Anda.', 'success');
    }).catch(() => {
      showToast('Salin manual: ' + inp.value, 'info');
    });
  }
});

// Salin Kode Sinkronisasi Data Antar HP
document.getElementById('btnCopySyncCode')?.addEventListener('click', () => {
  const code = DB.exportSyncCode();
  navigator.clipboard.writeText(code).then(() => {
    showToast('Kode data berhasil disalin! Kirim via WhatsApp/pesan ke HP lain lalu klik "Tempel di HP Ini".', 'success');
  }).catch(() => {
    prompt('Salin kode sinkronisasi ini:', code);
  });
});

// Toggle Tampilan Input Tempel Kode
document.getElementById('btnTogglePasteSync')?.addEventListener('click', () => {
  const c = document.getElementById('pasteSyncContainer');
  if (c) c.style.display = c.style.display === 'none' ? 'block' : 'none';
});

// Terapkan Kode Sinkronisasi
document.getElementById('btnApplySyncCode')?.addEventListener('click', async () => {
  const val = document.getElementById('syncCodeInput')?.value.trim();
  if (!val) {
    showToast('Silakan tempel kode sinkronisasi terlebih dahulu!', 'warning');
    return;
  }
  try {
    const full = await DB.importSyncCode(val);
    renderDashboard();
    renderTableProduk();
    populateProdukSelects();
    hideDbModal();
    showToast(`Berhasil menyamakan ${full.products.length} barang dari HP lain! Data tersimpan aman dan tidak akan tereset.`, 'success');
  } catch (err) {
    showToast('Kode sinkronisasi tidak valid: ' + err.message, 'error');
  }
});

// Hubungkan ke Alamat Server Laptop Tertentu
document.getElementById('btnSaveServerUrl')?.addEventListener('click', async () => {
  const val = document.getElementById('inputServerUrl')?.value.trim();
  if (val) {
    localStorage.setItem(DB.SERVER_URL, val);
    showToast('Menghubungkan ke: ' + val + '...', 'info');
    const ok = await DB.fetchFromServer();
    if (ok) {
      renderDashboard();
      renderTableProduk();
      populateProdukSelects();
      showToast('Berhasil terhubung ke database server laptop! Data tersinkron real-time.', 'success');
    } else {
      showToast('Belum dapat terhubung. Pastikan laptop & HP berada di Wi-Fi yang sama.', 'warning');
    }
  }
});

// Muat inputServerUrl dari localStorage jika pernah disimpan
const savedServer = localStorage.getItem(DB.SERVER_URL);
if (savedServer && document.getElementById('inputServerUrl')) {
  document.getElementById('inputServerUrl').value = savedServer;
}

// ============================================================
//  MANUAL REFRESH & SINKRONISASI DATA
// ============================================================
let isRefreshing = false;
async function triggerDataRefresh(showFeedback = true) {
  if (isRefreshing) return;
  isRefreshing = true;

  const btn = document.getElementById('topbarRefreshBtn');
  const btnModal = document.getElementById('btnManualSyncDb');
  if (btn) btn.classList.add('spinning');
  if (btnModal) {
    btnModal.disabled = true;
    btnModal.innerHTML = '<i class="ri-refresh-line"></i> Menyinkronkan...';
  }

  try {
    const ok = await DB.fetchFromServer();
    const activeTab = document.querySelector('.nav-item.active')?.dataset.tab || 'dashboard';
    renderByTab(activeTab);
    populateProdukSelects();

    if (showFeedback) {
      if (ok) {
        if (DB._mode === 'server') {
          showToast('Data tersinkronisasi dengan server lokal (Real-Time)!', 'success');
        } else if (DB._mode === 'github' || DB._mode === 'raw_github') {
          showToast('Data tersinkronisasi dari GitHub database!', 'success');
        } else {
          showToast('Data diperbarui (Penyimpanan lokal aman)!', 'info');
        }
      } else {
        showToast('Data saat ini tersimpan aman di perangkat lokal.', 'info');
      }
    }
  } catch (err) {
    if (showFeedback) showToast('Gagal menyinkronkan data: ' + err.message, 'error');
  } finally {
    isRefreshing = false;
    if (btn) {
      setTimeout(() => btn.classList.remove('spinning'), 400);
    }
    if (btnModal) {
      btnModal.disabled = false;
      btnModal.innerHTML = '<i class="ri-refresh-line"></i> Refresh &amp; Sinkronkan Sekarang';
    }
  }
}

document.getElementById('topbarRefreshBtn')?.addEventListener('click', () => {
  triggerDataRefresh(true);
});

document.getElementById('dbStatusPill')?.addEventListener('click', () => {
  triggerDataRefresh(true);
});

document.getElementById('btnManualSyncDb')?.addEventListener('click', () => {
  triggerDataRefresh(true);
});

// ============================================================
//  SCAN BARCODE & INPUT DATA INSTAN
// ============================================================
let html5QrCode = null;
let isScanning = false;
let scannerTarget = 'action'; // 'action' | 'masuk' | 'keluar' | 'produk_form' | 'katalog'
let scannerMode = 'action';   // 'action' | 'masuk' | 'keluar'
let lastScannedCode = null;
let lastScanTimestamp = 0;
let currentCameraFacing = 'environment';
let currentTorch = false;
let currentScannedProduct = null;
let currentScanQty = 1;

function playScanBeep(success = true) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (success) {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.start();
      osc.stop(ctx.currentTime + 0.28);
    }
  } catch (e) {}
}

function updateScannerModeUI() {
  document.querySelectorAll('.scan-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === scannerMode);
  });
  const sub = document.getElementById('scannerModalSub');
  if (sub) {
    if (scannerTarget === 'produk_form') {
      sub.textContent = 'Arahkan kamera ke barcode untuk mengisi kode barang';
    } else if (scannerTarget === 'katalog') {
      sub.textContent = 'Arahkan kamera untuk mencari barang di katalog';
    } else if (scannerMode === 'masuk') {
      sub.textContent = 'Mode Auto Masuk: Scan otomatis catat +1 stok masuk';
    } else if (scannerMode === 'keluar') {
      sub.textContent = 'Mode Auto Kasir: Scan otomatis kurangi -1 stok penjualan';
    } else {
      sub.textContent = 'Input & cari stok instan dengan kamera atau scanner';
    }
  }
}

async function openScannerModal(target = 'action') {
  scannerTarget = target;
  if (target === 'masuk') scannerMode = 'masuk';
  else if (target === 'keluar') scannerMode = 'keluar';
  else if (target === 'action') scannerMode = 'action';

  const modeSwitch = document.getElementById('scannerModeSwitch');
  if (modeSwitch) {
    modeSwitch.style.display = (target === 'produk_form' || target === 'katalog') ? 'none' : 'grid';
  }

  updateScannerModeUI();

  const resCard = document.getElementById('scanResultCard');
  if (resCard) {
    resCard.style.display = 'none';
    resCard.innerHTML = '';
  }
  const autoBanner = document.getElementById('scanAutoBanner');
  if (autoBanner) autoBanner.style.display = 'none';
  const hint = document.getElementById('scannerHint');
  if (hint) hint.textContent = 'Arahkan kamera ke barcode / QR code produk';

  const modal = document.getElementById('modalScanner');
  if (modal) modal.classList.add('open');

  lastScannedCode = null;
  lastScanTimestamp = 0;

  if (typeof Html5Qrcode === 'undefined') {
    document.getElementById('scannerManualBox').style.display = 'block';
    showToast('Scanner kamera sedang disiapkan. Anda juga dapat mengetik barcode manual di bawah.', 'info');
    return;
  }

  try {
    if (!html5QrCode) {
      html5QrCode = new Html5Qrcode('scannerReader');
    }

    if (isScanning) {
      await html5QrCode.stop();
      isScanning = false;
    }

    const config = {
      fps: 15,
      qrbox: { width: 250, height: 180 },
      aspectRatio: 1.333333
    };

    await html5QrCode.start(
      { facingMode: currentCameraFacing },
      config,
      onBarcodeScanSuccess,
      () => {}
    );
    isScanning = true;

    try {
      const caps = html5QrCode.getRunningTrackCapabilities();
      const torchBtn = document.getElementById('btnToggleTorch');
      if (torchBtn && caps.torch) {
        torchBtn.style.display = 'inline-flex';
      }
    } catch {}

  } catch (err) {
    console.warn('Gagal membuka kamera facingMode:', err);
    try {
      const cameras = await Html5Qrcode.getCameras();
      if (cameras && cameras.length) {
        const camId = cameras[cameras.length - 1].id;
        await html5QrCode.start(camId, { fps: 15, qrbox: { width: 250, height: 180 } }, onBarcodeScanSuccess, () => {});
        isScanning = true;
      } else {
        throw new Error('Tidak ada perangkat kamera');
      }
    } catch (e2) {
      console.warn('Kamera tidak bisa diakses:', e2);
      document.getElementById('scannerManualBox').style.display = 'block';
      if (hint) hint.textContent = 'Kamera tidak dapat diakses. Gunakan input manual.';
      showToast('Kamera tidak dapat dibuka atau izin ditolak. Silakan gunakan input manual / scanner USB.', 'warning');
    }
  }
}

async function closeScannerModal() {
  const modal = document.getElementById('modalScanner');
  if (modal) modal.classList.remove('open');
  if (html5QrCode && isScanning) {
    try {
      await html5QrCode.stop();
    } catch (e) {}
    isScanning = false;
  }
  const autoBanner = document.getElementById('scanAutoBanner');
  if (autoBanner) autoBanner.style.display = 'none';
  const resCard = document.getElementById('scanResultCard');
  if (resCard) resCard.style.display = 'none';
  document.getElementById('scannerManualBox').style.display = 'none';
  lastScannedCode = null;
}

function onBarcodeScanSuccess(decodedText) {
  const now = Date.now();
  if (decodedText === lastScannedCode && (now - lastScanTimestamp) < 1200) {
    return;
  }
  lastScannedCode = decodedText;
  lastScanTimestamp = now;

  handleScannedBarcode(decodedText);
}

async function handleScannedBarcode(rawCode) {
  const code = (rawCode || '').trim();
  if (!code) return;

  const products = DB.getProducts();
  const codeLower = code.toLowerCase();
  const found = products.find(p =>
    (p.kode && p.kode.toLowerCase() === codeLower) ||
    p.id === code ||
    p.nama.toLowerCase() === codeLower
  );

  playScanBeep(!!found);
  if (navigator.vibrate) {
    try { navigator.vibrate(found ? 70 : [50, 50, 50]); } catch {}
  }

  // 1. Target: FORM TAMBAH/EDIT PRODUK
  if (scannerTarget === 'produk_form') {
    const inp = document.getElementById('produkKode');
    if (inp) inp.value = code;
    await closeScannerModal();
    showToast(`Barcode "${code}" berhasil disematkan ke barang!`, 'success');
    return;
  }

  // 2. Target: TAB BARANG MASUK
  if (scannerTarget === 'masuk') {
    if (found) {
      const sel = document.getElementById('masukProduk');
      if (sel) sel.value = found.id;
      updateMasukPreview();
      await closeScannerModal();
      const qtyInp = document.getElementById('masukJumlah');
      if (qtyInp) {
        qtyInp.focus();
        qtyInp.select();
      }
      showToast(`Barang "${found.nama}" dipilih! Silakan isi jumlah masuk.`, 'success');
    } else {
      renderNotFoundCard(code);
    }
    return;
  }

  // 3. Target: TAB BARANG KELUAR
  if (scannerTarget === 'keluar') {
    if (found) {
      const sel = document.getElementById('keluarProduk');
      if (sel) sel.value = found.id;
      updateKeluarPreview();
      await closeScannerModal();
      const qtyInp = document.getElementById('keluarJumlah');
      if (qtyInp) {
        qtyInp.focus();
        qtyInp.select();
      }
      showToast(`Barang "${found.nama}" dipilih! Silakan isi jumlah keluar.`, 'success');
    } else {
      renderNotFoundCard(code);
    }
    return;
  }

  // 4. Target: KATALOG CARI
  if (scannerTarget === 'katalog') {
    if (found) {
      await closeScannerModal();
      switchTab('produk');
      const s = document.getElementById('globalSearch');
      if (s) s.value = found.nama;
      filterAndRenderProduk(found.nama.toLowerCase());
      showToast(`Menemukan "${found.nama}" di katalog`, 'info');
    } else {
      renderNotFoundCard(code);
    }
    return;
  }

  // 5. Universal Quick Scan ('action')
  if (scannerMode === 'masuk') {
    if (found) {
      try {
        await DB.catatMasuk({
          produkId: found.id,
          jumlah: 1,
          hargaBeli: found.hargaBeli,
          keterangan: 'Scan Cepat Auto Masuk (+1)'
        });
        showAutoScanBanner('masuk', found, 1);
        populateProdukSelects();
        const activeTab = document.querySelector('.nav-item.active')?.dataset.tab || 'dashboard';
        renderByTab(activeTab);
      } catch (err) {
        showToast(err.message, 'error');
      }
    } else {
      renderNotFoundCard(code);
    }
    return;
  }

  if (scannerMode === 'keluar') {
    if (found) {
      try {
        await DB.catatKeluar({
          produkId: found.id,
          jumlah: 1,
          jenisKeluar: 'penjualan',
          keterangan: 'Scan Cepat Kasir (-1)'
        });
        showAutoScanBanner('keluar', found, 1);
        populateProdukSelects();
        const activeTab = document.querySelector('.nav-item.active')?.dataset.tab || 'dashboard';
        renderByTab(activeTab);
      } catch (err) {
        showToast(err.message, 'error');
      }
    } else {
      renderNotFoundCard(code);
    }
    return;
  }

  if (found) {
    renderScanResultCard(found, code);
  } else {
    renderNotFoundCard(code);
  }
}

function showAutoScanBanner(type, prod, qty) {
  const b = document.getElementById('scanAutoBanner');
  if (!b) return;
  const isMasuk = type === 'masuk';
  const updatedStok = Number(prod.stok);
  b.innerHTML = `
    <div class="scan-banner-success" style="border-left:4px solid ${isMasuk ? 'var(--green)' : 'var(--red)'};">
      <i class="${isMasuk ? 'ri-arrow-down-circle-fill text-green' : 'ri-arrow-up-circle-fill text-red'}" style="font-size:1.3rem;"></i>
      <div style="flex:1;">
        <div style="font-weight:700;">${isMasuk ? '+'+qty : '-'+qty} ${prod.satuan} ${prod.nama}</div>
        <div style="font-size:.74rem;color:var(--text-2);">
          ${isMasuk ? 'Barang masuk tercatat!' : 'Penjualan kasir tercatat!'} &bull; Stok saat ini: <strong>${updatedStok} ${prod.satuan}</strong>
        </div>
      </div>
    </div>
  `;
  b.style.display = 'block';

  clearTimeout(b._timer);
  b._timer = setTimeout(() => {
    b.style.display = 'none';
  }, 4000);
}

function renderScanResultCard(p, scannedCode) {
  currentScannedProduct = p;
  currentScanQty = 1;

  const card = document.getElementById('scanResultCard');
  if (!card) return;

  const st = getStockStatus(p);

  card.innerHTML = `
    <div class="scan-res-header">
      <div>
        <div class="scan-res-title">${p.nama}</div>
        <div class="scan-res-meta">
          <span>${p.kategori || 'Umum'}</span> &bull; 
          <span class="scan-res-code"><i class="ri-barcode-line"></i> ${p.kode || p.id}</span>
        </div>
      </div>
      <div style="text-align:right;">
        <span class="badge ${st === 'aman' ? 'badge-aman' : st === 'menipis' ? 'badge-menipis' : 'badge-habis'}">
          ${p.stok} ${p.satuan}
        </span>
        <div style="font-size:.78rem;font-weight:700;color:var(--primary);margin-top:.2rem;">
          ${formatRupiah(p.hargaJual)}
        </div>
      </div>
    </div>

    <!-- Stepper Qty Input -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin:.5rem 0 .25rem;">
      <span style="font-size:.8rem;font-weight:600;color:var(--text-2);">Jumlah Barang:</span>
      <div style="display:flex;align-items:center;gap:.35rem;">
        <button type="button" class="scan-qty-btn" id="btnScanQtyMinus"><i class="ri-subtract-line"></i></button>
        <input type="number" id="scanQtyInput" class="scan-qty-input" value="1" min="1" step="any" style="width:65px;" />
        <button type="button" class="scan-qty-btn" id="btnScanQtyPlus"><i class="ri-add-line"></i></button>
      </div>
    </div>

    <!-- Action Buttons Grid -->
    <div class="scan-actions-grid" style="margin-top:.65rem;">
      <button type="button" class="btn btn-success btn-sm btn-block" id="btnExecScanMasuk">
        <i class="ri-arrow-down-circle-fill"></i> + Masuk Stok
      </button>
      <button type="button" class="btn btn-danger btn-sm btn-block" id="btnExecScanKeluar">
        <i class="ri-shopping-cart-fill"></i> - Kasir / Keluar
      </button>
    </div>

    <div style="display:flex;gap:.4rem;margin-top:.5rem;">
      <button type="button" class="btn btn-ghost btn-sm" id="btnScanOpname" style="flex:1;font-size:.76rem;">
        <i class="ri-calculator-line"></i> Hitung Stok
      </button>
      <button type="button" class="btn btn-ghost btn-sm" id="btnScanEdit" style="flex:1;font-size:.76rem;">
        <i class="ri-edit-line"></i> Edit Produk
      </button>
      <button type="button" class="btn btn-ghost btn-sm" id="btnScanNext" style="font-size:.76rem;" title="Scan Barang Lain">
        <i class="ri-refresh-line"></i> Scan Lain
      </button>
    </div>
  `;

  card.style.display = 'block';

  const qtyInp = document.getElementById('scanQtyInput');
  document.getElementById('btnScanQtyMinus')?.addEventListener('click', () => {
    let val = Number(qtyInp.value) || 1;
    if (val > 1) val -= 1;
    qtyInp.value = val;
    currentScanQty = val;
  });
  document.getElementById('btnScanQtyPlus')?.addEventListener('click', () => {
    let val = Number(qtyInp.value) || 0;
    val += 1;
    qtyInp.value = val;
    currentScanQty = val;
  });
  qtyInp?.addEventListener('input', () => {
    currentScanQty = Number(qtyInp.value) || 1;
  });

  document.getElementById('btnExecScanMasuk')?.addEventListener('click', async () => {
    const qty = Number(qtyInp.value) || 1;
    try {
      await DB.catatMasuk({
        produkId: p.id,
        jumlah: qty,
        hargaBeli: p.hargaBeli,
        keterangan: 'Scan Cepat Barang Masuk'
      });
      showToast(`+${qty} ${p.satuan} "${p.nama}" berhasil ditambahkan ke database!`, 'success');
      populateProdukSelects();
      const activeTab = document.querySelector('.nav-item.active')?.dataset.tab || 'dashboard';
      renderByTab(activeTab);
      p.stok = Number(p.stok) + qty;
      renderScanResultCard(p, scannedCode);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('btnExecScanKeluar')?.addEventListener('click', async () => {
    const qty = Number(qtyInp.value) || 1;
    try {
      await DB.catatKeluar({
        produkId: p.id,
        jumlah: qty,
        jenisKeluar: 'penjualan',
        keterangan: 'Scan Cepat Kasir / Penjualan'
      });
      showToast(`-${qty} ${p.satuan} "${p.nama}" berhasil dicatat sebagai penjualan!`, 'success');
      populateProdukSelects();
      const activeTab = document.querySelector('.nav-item.active')?.dataset.tab || 'dashboard';
      renderByTab(activeTab);
      p.stok = Number(p.stok) - qty;
      renderScanResultCard(p, scannedCode);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('btnScanOpname')?.addEventListener('click', async () => {
    await closeScannerModal();
    switchTab('opname');
    showToast(`Pilih penyesuaian stok untuk "${p.nama}"`, 'info');
  });

  document.getElementById('btnScanEdit')?.addEventListener('click', async () => {
    await closeScannerModal();
    openEditProduk(p.id);
  });

  document.getElementById('btnScanNext')?.addEventListener('click', () => {
    card.style.display = 'none';
    lastScannedCode = null;
  });
}

function renderNotFoundCard(code) {
  const card = document.getElementById('scanResultCard');
  if (!card) return;

  card.innerHTML = `
    <div style="text-align:center;padding:.85rem .5rem;">
      <i class="ri-error-warning-line text-yellow" style="font-size:2.2rem;display:inline-block;margin-bottom:.3rem;"></i>
      <h4 style="font-size:.95rem;margin-bottom:.2rem;">Barcode Belum Terdaftar</h4>
      <div style="margin-bottom:.5rem;">
        <code style="font-family:monospace;background:var(--surface);border:1px solid var(--border);padding:.2rem .6rem;border-radius:4px;font-size:.88rem;color:var(--primary);font-weight:700;">${code}</code>
      </div>
      <p style="font-size:.76rem;color:var(--text-2);margin-bottom:.85rem;line-height:1.4;">
        Barang dengan barcode ini belum ada di database katalog Anda. Daftarkan sekarang dengan 1-klik:
      </p>
      <div style="display:flex;gap:.5rem;justify-content:center;">
        <button type="button" class="btn btn-primary btn-sm" id="btnRegisterNewFromScan">
          <i class="ri-add-line"></i> Tambah Sebagai Barang Baru
        </button>
        <button type="button" class="btn btn-ghost btn-sm" id="btnRescanFromCard">
          <i class="ri-refresh-line"></i> Scan Ulang
        </button>
      </div>
    </div>
  `;
  card.style.display = 'block';

  document.getElementById('btnRegisterNewFromScan')?.addEventListener('click', async () => {
    await closeScannerModal();
    editingProdukId = null;
    document.getElementById('formProduk').reset();
    document.getElementById('produkId').value = '';
    if (document.getElementById('produkKode')) {
      document.getElementById('produkKode').value = code;
    }
    const lbl = document.getElementById('lblProdukStok');
    if (lbl) lbl.textContent = 'Stok Awal';
    document.getElementById('produkStokAwal').value = '0';
    document.getElementById('produkMinStok').value = '0';
    document.getElementById('modalProdukTitle').textContent = 'Tambah Barang Baru';
    document.getElementById('saveProdukBtn').textContent = 'Simpan Barang';
    document.getElementById('modalProduk').classList.add('open');
    document.getElementById('produkNama').focus();
    showToast(`Barcode ${code} disematkan. Silakan isi nama & harga barang.`, 'info');
  });

  document.getElementById('btnRescanFromCard')?.addEventListener('click', () => {
    card.style.display = 'none';
    lastScannedCode = null;
  });
}

// Event Listeners Scanner
document.getElementById('topbarScanBtn')?.addEventListener('click', () => {
  openScannerModal('action');
});
document.getElementById('btnScanKatalog')?.addEventListener('click', () => {
  openScannerModal('katalog');
});
document.getElementById('btnScanMasuk')?.addEventListener('click', () => {
  openScannerModal('masuk');
});
document.getElementById('btnScanKeluar')?.addEventListener('click', () => {
  openScannerModal('keluar');
});
document.getElementById('btnScanBarcodeForm')?.addEventListener('click', () => {
  openScannerModal('produk_form');
});
document.getElementById('closeScannerModal')?.addEventListener('click', () => {
  closeScannerModal();
});
document.getElementById('modalScanner')?.addEventListener('click', (e) => {
  if (e.target === document.getElementById('modalScanner')) {
    closeScannerModal();
  }
});

// Mode switch click events
document.getElementById('btnModeAction')?.addEventListener('click', () => {
  scannerMode = 'action';
  updateScannerModeUI();
});
document.getElementById('btnModeMasuk')?.addEventListener('click', () => {
  scannerMode = 'masuk';
  updateScannerModeUI();
});
document.getElementById('btnModeKeluar')?.addEventListener('click', () => {
  scannerMode = 'keluar';
  updateScannerModeUI();
});

// Switch Camera Front / Back
document.getElementById('btnSwitchCamera')?.addEventListener('click', async () => {
  currentCameraFacing = currentCameraFacing === 'environment' ? 'user' : 'environment';
  if (isScanning && html5QrCode) {
    await html5QrCode.stop();
    isScanning = false;
  }
  openScannerModal(scannerTarget);
});

// Toggle Senter / Torch
document.getElementById('btnToggleTorch')?.addEventListener('click', async () => {
  if (html5QrCode && isScanning) {
    try {
      currentTorch = !currentTorch;
      await html5QrCode.applyVideoConstraints({
        advanced: [{ torch: currentTorch }]
      });
      document.getElementById('btnToggleTorch').classList.toggle('active', currentTorch);
    } catch (e) {
      console.warn('Torch error:', e);
    }
  }
});

// Toggle Manual Barcode Input
document.getElementById('btnToggleManualInput')?.addEventListener('click', () => {
  const box = document.getElementById('scannerManualBox');
  if (!box) return;
  const isHidden = box.style.display === 'none' || !box.style.display;
  box.style.display = isHidden ? 'block' : 'none';
  if (isHidden) {
    const inp = document.getElementById('manualBarcodeInput');
    if (inp) {
      inp.focus();
      inp.select();
    }
  }
});

// Submit Manual Barcode
document.getElementById('btnSubmitManualBarcode')?.addEventListener('click', () => {
  const inp = document.getElementById('manualBarcodeInput');
  if (inp && inp.value.trim()) {
    handleScannedBarcode(inp.value.trim());
    inp.value = '';
  }
});
document.getElementById('manualBarcodeInput')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const val = e.target.value.trim();
    if (val) {
      handleScannedBarcode(val);
      e.target.value = '';
    }
  }
});

// Listener Hardware USB / Bluetooth Barcode Scanner
let hwBarcodeBuffer = '';
let hwBarcodeLastTime = 0;
window.addEventListener('keydown', (e) => {
  const target = e.target;
  const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
  if (isInput && target.id !== 'manualBarcodeInput') return;

  const now = Date.now();
  if (now - hwBarcodeLastTime > 120) {
    hwBarcodeBuffer = '';
  }
  hwBarcodeLastTime = now;

  if (e.key === 'Enter') {
    if (hwBarcodeBuffer.length >= 3) {
      const code = hwBarcodeBuffer;
      hwBarcodeBuffer = '';
      openScannerModal('action');
      handleScannedBarcode(code);
    }
  } else if (e.key.length === 1) {
    hwBarcodeBuffer += e.key;
  }
});

// ============================================================
//  AUTO-SYNC BACKGROUND (Sync Multi-device Laptop & HP Real-Time)
// ============================================================
setInterval(async () => {
  if (document.visibilityState === 'visible') {
    const prevTxs = DB.getTransactions().length;
    const prevProds = JSON.stringify(DB.getProducts());
    const ok = await DB.fetchFromServer();
    if (ok) {
      const curTxs = DB.getTransactions().length;
      const curProds = JSON.stringify(DB.getProducts());
      if (prevTxs !== curTxs || prevProds !== curProds) {
        const activeTab = document.querySelector('.nav-item.active')?.dataset.tab || 'dashboard';
        renderByTab(activeTab);
      }
    }
  }
}, 3000);

window.addEventListener('focus', () => {
  DB.fetchFromServer().then(() => {
    const activeTab = document.querySelector('.nav-item.active')?.dataset.tab || 'dashboard';
    renderByTab(activeTab);
  });
});

// ============================================================
//  INIT APP
// ============================================================
window.openEditProduk = openEditProduk;
window.hapusProduk    = hapusProduk;
window.updateDiff     = updateDiff;
window.switchTab      = switchTab;
window.triggerDataRefresh = triggerDataRefresh;
window.openScannerModal   = openScannerModal;
window.closeScannerModal  = closeScannerModal;
window.filterKatalogByGroup = filterKatalogByGroup;

async function initApp() {
  await DB.init();
  switchTab('dashboard');
}
initApp();
