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
    switchTab(el.dataset.tab);
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

// ============================================================
//  KATALOG PRODUK
// ============================================================
let editingProdukId = null;

function renderTableProduk(filterKat = '', filterSt = '', q = '') {
  let products = DB.getProducts();

  // Populate kategori datalist & filter select
  const kats = [...new Set(products.map(p => p.kategori).filter(Boolean))];
  const datalist = document.getElementById('kategoriList');
  datalist.innerHTML = kats.map(k => `<option value="${k}">`).join('');
  const sel = document.getElementById('filterKategori');
  const cur = sel.value;
  sel.innerHTML = `<option value="">Semua Kategori</option>` + kats.map(k => `<option value="${k}" ${k===cur?'selected':''}>${k}</option>`).join('');

  if (filterKat || document.getElementById('filterKategori').value) {
    const f = filterKat || document.getElementById('filterKategori').value;
    if (f) products = products.filter(p => p.kategori === f);
  }
  if (filterSt || document.getElementById('filterStatus').value) {
    const f = filterSt || document.getElementById('filterStatus').value;
    if (f) products = products.filter(p => getStockStatus(p) === f);
  }
  if (q) products = products.filter(p => p.nama.toLowerCase().includes(q) || p.kategori.toLowerCase().includes(q));

  const tbody = document.getElementById('bodyProduk');
  if (!products.length) {
    tbody.innerHTML = `<tr><td colspan="10" class="empty-row"><i class="ri-inbox-2-line"></i> Tidak ada barang ditemukan</td></tr>`;
    return;
  }
  tbody.innerHTML = products.map((p, i) => {
    const st = getStockStatus(p);
    return `<tr>
      <td>${i+1}</td>
      <td class="fw-bold">${p.nama}</td>
      <td>${p.kategori || '-'}</td>
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
  renderTableProduk('', '', q);
}

document.getElementById('filterKategori').addEventListener('change', () => renderTableProduk());
document.getElementById('filterStatus').addEventListener('change', () => renderTableProduk());

// Add product button
document.getElementById('btnAddProduk').addEventListener('click', () => {
  editingProdukId = null;
  document.getElementById('formProduk').reset();
  document.getElementById('produkId').value = '';
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
  document.getElementById('produkNama').value = p.nama;
  document.getElementById('produkKategori').value = p.kategori || '';
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
//  POPULATE PRODUCT SELECTS (for masuk & keluar forms)
// ============================================================
function populateProdukSelects() {
  const products = DB.getProducts();
  const opt = products.length
    ? products.map(p => `<option value="${p.id}">${p.nama} (Stok: ${p.stok} ${p.satuan})</option>`).join('')
    : '<option value="" disabled>Belum ada barang — tambahkan di Katalog</option>';

  ['masukProduk', 'keluarProduk'].forEach(id => {
    const el = document.getElementById(id);
    const prev = el.value;
    el.innerHTML = `<option value="">-- Pilih Barang --</option>` + opt;
    if (prev) el.value = prev;
  });
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
//  HITUNG BARANG / STOCK OPNAME
// ============================================================
function renderOpname() {
  const products = DB.getProducts();
  const tbody = document.getElementById('bodyOpname');
  if (!products.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-row"><i class="ri-inbox-2-line"></i> Tambahkan barang di Katalog terlebih dahulu</td></tr>`;
    renderOpnameHistory();
    return;
  }
  tbody.innerHTML = products.map(p => `
    <tr data-id="${p.id}" data-sistem="${p.stok}" data-satuan="${p.satuan}" data-nama="${p.nama}">
      <td class="fw-bold">${p.nama}</td>
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
  `).join('');
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
  showConfirm('Muat Data Contoh', 'Tambahkan 8 produk sembako dan retail contoh ke database Anda?', async () => {
    const seeds = [
      { id: genId(), nama: 'Beras Premium 5Kg', kategori: 'Sembako', satuan: 'Karung', stok: 50, minStok: 10, hargaBeli: 62000, hargaJual: 70000, deskripsi: '' },
      { id: genId(), nama: 'Minyak Goreng 1L', kategori: 'Sembako', satuan: 'Botol', stok: 80, minStok: 20, hargaBeli: 14000, hargaJual: 16000, deskripsi: '' },
      { id: genId(), nama: 'Gula Pasir 1Kg', kategori: 'Sembako', satuan: 'Pcs', stok: 60, minStok: 15, hargaBeli: 13000, hargaJual: 15000, deskripsi: '' },
      { id: genId(), nama: 'Kopi Kapal Api 165gr', kategori: 'Minuman', satuan: 'Pack', stok: 40, minStok: 10, hargaBeli: 10000, hargaJual: 12500, deskripsi: '' },
      { id: genId(), nama: 'Sabun Mandi Lifebuoy', kategori: 'Kebersihan', satuan: 'Pcs', stok: 12, minStok: 10, hargaBeli: 3500, hargaJual: 5000, deskripsi: '' },
      { id: genId(), nama: 'Indomie Goreng', kategori: 'Makanan', satuan: 'Pcs', stok: 48, minStok: 20, hargaBeli: 2800, hargaJual: 3500, deskripsi: '' },
      { id: genId(), nama: 'Aqua Galon 19L', kategori: 'Minuman', satuan: 'Galon', stok: 20, minStok: 5, hargaBeli: 18000, hargaJual: 22000, deskripsi: '' },
      { id: genId(), nama: 'Detergen Rinso 900gr', kategori: 'Kebersihan', satuan: 'Pack', stok: 25, minStok: 8, hargaBeli: 21000, hargaJual: 25000, deskripsi: '' },
    ];
    for (const p of seeds) {
      await DB.saveProduct(p);
    }
    hideDbModal();
    renderDashboard();
    renderTableProduk();
    populateProdukSelects();
    showToast('8 data contoh berhasil dimasukkan ke database!', 'success');
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
        // Terjadi update dari HP atau perangkat lain!
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

async function initApp() {
  await DB.init();
  switchTab('dashboard');
}
initApp();
