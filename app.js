/**
 * StockMaster — Application Logic (app.js)
 * Features: Katalog Barang, Barang Masuk, Barang Keluar, Hitung Barang (Stock Opname)
 * Storage: localStorage
 */

// ============================================================
//  DATA STORE (localStorage-backed)
// ============================================================
const DB = {
  PRODUCTS: 'sm_products',
  TRANSACTIONS: 'sm_transactions',
  OPNAMES: 'sm_opnames',

  get(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch { return []; }
  },
  set(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  },
  getProducts()     { return this.get(this.PRODUCTS); },
  getTransactions() { return this.get(this.TRANSACTIONS); },
  getOpnames()      { return this.get(this.OPNAMES); },
  saveProducts(d)     { this.set(this.PRODUCTS, d); },
  saveTransactions(d) { this.set(this.TRANSACTIONS, d); },
  saveOpnames(d)      { this.set(this.OPNAMES, d); },
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
  if (product.stok <= 0) return 'habis';
  if (product.stok <= product.minStok) return 'menipis';
  return 'aman';
}

function statusBadge(status) {
  const labels = { aman: 'Stok Aman', menipis: 'Stok Menipis', habis: 'Stok Habis' };
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
  // Update nav
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navEl = document.getElementById(`nav-${name}`);
  if (navEl) navEl.classList.add('active');

  // Update views
  document.querySelectorAll('.tab-view').forEach(el => el.classList.remove('active'));
  const view = document.getElementById(`tab-${name}`);
  if (view) view.classList.add('active');

  // Update topbar title
  document.getElementById('topbarTitle').textContent = tabTitles[name] || name;

  // Refresh content
  renderByTab(name);

  // Close mobile sidebar
  document.getElementById('sidebar').classList.remove('mobile-open');
}

function renderByTab(name) {
  if (name === 'dashboard') renderDashboard();
  if (name === 'produk')   renderTableProduk();
  if (name === 'masuk')    { populateProdukSelects(); renderListMasuk(); }
  if (name === 'keluar')   { populateProdukSelects(); renderListKeluar(); }
  if (name === 'opname')   renderOpname();
  if (name === 'riwayat')  renderRiwayat();
}

// Nav click events
document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
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
  document.getElementById('themeIcon').className = dark ? 'ri-sun-line' : 'ri-moon-line';
  document.getElementById('themeLabel').textContent = dark ? 'Mode Terang' : 'Mode Gelap';
  localStorage.setItem('sm_theme', dark ? 'dark' : 'light');
}
document.getElementById('themeToggle').addEventListener('click', () => {
  applyTheme(!document.body.classList.contains('dark'));
});
// Load saved theme
applyTheme(localStorage.getItem('sm_theme') === 'dark');

// ============================================================
//  TOPBAR DATE
// ============================================================
function updateDate() {
  const el = document.getElementById('topbarDate');
  el.textContent = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}
updateDate();
setInterval(updateDate, 60000);

// ============================================================
//  MOBILE MENU
// ============================================================
document.getElementById('menuBtn').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('mobile-open');
});
document.addEventListener('click', (e) => {
  const sidebar = document.getElementById('sidebar');
  const menuBtn = document.getElementById('menuBtn');
  if (sidebar.classList.contains('mobile-open') &&
      !sidebar.contains(e.target) && e.target !== menuBtn && !menuBtn.contains(e.target)) {
    sidebar.classList.remove('mobile-open');
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
      return `<div class="alert-item ${st}">
        <div>
          <div class="ai-name">${p.nama}</div>
          <div class="ai-info">${p.stok} ${p.satuan} &bull; Min: ${p.minStok} ${p.satuan}</div>
        </div>
        <span class="ai-badge badge badge-${st}">${st === 'habis' ? 'Habis' : 'Menipis'}</span>
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
      <td class="fw-bold ${st === 'habis' ? 'text-red' : st === 'menipis' ? 'text-yellow' : ''}">${Number(p.stok).toLocaleString('id-ID')}</td>
      <td>${p.minStok}</td>
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
  document.getElementById('produkStokAwal').value = '0';
  document.getElementById('produkMinStok').value = '5';
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
document.getElementById('formProduk').addEventListener('submit', (e) => {
  e.preventDefault();
  const products = DB.getProducts();
  const id = document.getElementById('produkId').value;
  const data = {
    id: id || genId(),
    nama:       document.getElementById('produkNama').value.trim(),
    kategori:   document.getElementById('produkKategori').value.trim(),
    satuan:     document.getElementById('produkSatuan').value,
    stok:       Number(document.getElementById('produkStokAwal').value) || 0,
    minStok:    Number(document.getElementById('produkMinStok').value) || 5,
    hargaBeli:  Number(document.getElementById('produkHargaBeli').value) || 0,
    hargaJual:  Number(document.getElementById('produkHargaJual').value) || 0,
    deskripsi:  document.getElementById('produkDeskripsi').value.trim(),
    updatedAt:  new Date().toISOString(),
  };
  if (!id) data.createdAt = new Date().toISOString();

  if (id) {
    const idx = products.findIndex(p => p.id === id);
    if (idx > -1) {
      data.stok = products[idx].stok; // preserve stock
      products[idx] = { ...products[idx], ...data };
    }
  } else {
    products.push(data);
  }
  DB.saveProducts(products);
  document.getElementById('modalProduk').classList.remove('open');
  renderTableProduk();
  showToast(id ? 'Barang berhasil diperbarui!' : 'Barang baru berhasil ditambahkan!', 'success');
});

function openEditProduk(id) {
  const p = DB.getProducts().find(x => x.id === id);
  if (!p) return;
  editingProdukId = id;
  document.getElementById('produkId').value = p.id;
  document.getElementById('produkNama').value = p.nama;
  document.getElementById('produkKategori').value = p.kategori || '';
  document.getElementById('produkSatuan').value = p.satuan;
  document.getElementById('produkStokAwal').value = p.stok;
  document.getElementById('produkMinStok').value = p.minStok;
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
  showConfirm('Hapus Barang', `Hapus "${p.nama}" dari katalog? Data stok akan hilang permanen.`, () => {
    DB.saveProducts(DB.getProducts().filter(x => x.id !== id));
    renderTableProduk();
    showToast('Barang berhasil dihapus.', 'warning');
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

document.getElementById('formMasuk').addEventListener('submit', (e) => {
  e.preventDefault();
  const produkId  = document.getElementById('masukProduk').value;
  const jumlah    = Number(document.getElementById('masukJumlah').value);
  const hargaBeli = Number(document.getElementById('masukHarga').value);
  const supplier  = document.getElementById('masukSupplier').value.trim();
  const nota      = document.getElementById('masukNota').value.trim();
  const ket       = document.getElementById('masukKet').value.trim();

  if (!produkId) { showToast('Pilih barang terlebih dahulu.', 'error'); return; }
  if (!jumlah || jumlah < 1) { showToast('Jumlah harus lebih dari 0.', 'error'); return; }

  const products = DB.getProducts();
  const idx = products.findIndex(p => p.id === produkId);
  if (idx === -1) { showToast('Barang tidak ditemukan.', 'error'); return; }

  const p = products[idx];
  products[idx].stok = (Number(p.stok) || 0) + jumlah;
  if (hargaBeli) products[idx].hargaBeli = hargaBeli;
  products[idx].updatedAt = new Date().toISOString();
  DB.saveProducts(products);

  // Log transaction
  const txs = DB.getTransactions();
  txs.unshift({
    id: genId(),
    jenis: 'masuk',
    produkId,
    namaProduk: p.nama,
    satuan: p.satuan,
    jumlah,
    hargaSatuan: hargaBeli,
    total: jumlah * hargaBeli,
    supplier, nota, keterangan: ket,
    tgl: new Date().toISOString(),
  });
  DB.saveTransactions(txs);

  document.getElementById('formMasuk').reset();
  document.getElementById('masukPreview').style.display = 'none';
  populateProdukSelects();
  renderListMasuk();
  showToast(`+${jumlah} ${p.satuan} "${p.nama}" berhasil dicatat sebagai barang masuk!`, 'success');
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
    el.textContent = `${Number(p.stok).toLocaleString('id-ID')} ${p.satuan}`;
    el.style.color = p.stok <= 0 ? 'var(--red)' : p.stok <= p.minStok ? 'var(--yellow)' : 'var(--green)';
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

document.getElementById('formKeluar').addEventListener('submit', (e) => {
  e.preventDefault();
  const produkId = document.getElementById('keluarProduk').value;
  const jumlah   = Number(document.getElementById('keluarJumlah').value);
  const jenis    = document.getElementById('keluarJenis').value;
  const ket      = document.getElementById('keluarKet').value.trim();

  if (!produkId) { showToast('Pilih barang terlebih dahulu.', 'error'); return; }
  if (!jumlah || jumlah < 1) { showToast('Jumlah harus lebih dari 0.', 'error'); return; }

  const products = DB.getProducts();
  const idx = products.findIndex(p => p.id === produkId);
  if (idx === -1) { showToast('Barang tidak ditemukan.', 'error'); return; }

  const p = products[idx];
  if (jumlah > Number(p.stok)) {
    showToast(`Stok tidak cukup! Stok tersedia: ${p.stok} ${p.satuan}.`, 'error');
    return;
  }

  products[idx].stok = Number(p.stok) - jumlah;
  products[idx].updatedAt = new Date().toISOString();
  DB.saveProducts(products);

  const txs = DB.getTransactions();
  txs.unshift({
    id: genId(),
    jenis: 'keluar',
    jenisKeluar: jenis,
    produkId,
    namaProduk: p.nama,
    satuan: p.satuan,
    jumlah,
    hargaSatuan: p.hargaJual,
    total: jumlah * p.hargaJual,
    keterangan: ket,
    tgl: new Date().toISOString(),
  });
  DB.saveTransactions(txs);

  document.getElementById('formKeluar').reset();
  document.getElementById('keluarStokInfo').textContent = 'Pilih barang terlebih dahulu';
  document.getElementById('keluarStokInfo').style.color = '';
  document.getElementById('keluarPreview').style.display = 'none';
  populateProdukSelects();
  renderListKeluar();
  showToast(`-${jumlah} ${p.satuan} "${p.nama}" berhasil dicatat sebagai barang keluar!`, 'success');
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
               min="0" placeholder="Masukkan jumlah fisik"
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
    () => {
      // Update stocks
      changes.forEach(c => {
        const idx = products.findIndex(p => p.id === c.id);
        if (idx > -1) { products[idx].stok = c.stokFisik; products[idx].updatedAt = new Date().toISOString(); }
      });
      DB.saveProducts(products);

      // Log opname
      const opnames = DB.getOpnames();
      opnames.unshift({ id: genId(), tgl: new Date().toISOString(), items: changes });
      DB.saveOpnames(opnames);

      // Log each change as transaction
      const txs = DB.getTransactions();
      changes.forEach(c => {
        txs.unshift({
          id: genId(), jenis: 'opname', produkId: c.id,
          namaProduk: c.nama, satuan: c.satuan,
          jumlah: Math.abs(c.selisih),
          keterangan: `Opname: sistem ${c.stokSistem} → fisik ${c.stokFisik} (${c.selisih >= 0 ? '+' : ''}${c.selisih}) ${c.keterangan}`,
          tgl: new Date().toISOString(),
        });
      });
      DB.saveTransactions(txs);

      renderOpname();
      showToast(`Stok ${changes.length} barang berhasil disesuaikan!`, 'success');
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
  showConfirm('Hapus Semua Riwayat', 'Ini akan menghapus seluruh riwayat mutasi. Data stok tidak berubah.', () => {
    DB.saveTransactions([]);
    DB.saveOpnames([]);
    renderRiwayat();
    showToast('Riwayat mutasi berhasil dihapus.', 'warning');
  });
});

// ============================================================
//  SEED DATA (first run)
// ============================================================
function seedDefaultData() {
  if (DB.getProducts().length) return;
  const seeds = [
    { id: genId(), nama: 'Beras Premium 5Kg', kategori: 'Sembako', satuan: 'Karung', stok: 50, minStok: 10, hargaBeli: 62000, hargaJual: 70000 },
    { id: genId(), nama: 'Minyak Goreng 1L', kategori: 'Sembako', satuan: 'Botol', stok: 80, minStok: 20, hargaBeli: 14000, hargaJual: 16000 },
    { id: genId(), nama: 'Gula Pasir 1Kg', kategori: 'Sembako', satuan: 'Pcs', stok: 60, minStok: 15, hargaBeli: 13000, hargaJual: 15000 },
    { id: genId(), nama: 'Kopi Kapal Api 165gr', kategori: 'Minuman', satuan: 'Pack', stok: 40, minStok: 10, hargaBeli: 10000, hargaJual: 12500 },
    { id: genId(), nama: 'Sabun Mandi Lifebuoy', kategori: 'Kebersihan', satuan: 'Pcs', stok: 5, minStok: 10, hargaBeli: 3500, hargaJual: 5000 },
    { id: genId(), nama: 'Indomie Goreng', kategori: 'Makanan', satuan: 'Pcs', stok: 0, minStok: 20, hargaBeli: 2800, hargaJual: 3500 },
    { id: genId(), nama: 'Aqua Galon 19L', kategori: 'Minuman', satuan: 'Galon', stok: 20, minStok: 5, hargaBeli: 18000, hargaJual: 22000 },
    { id: genId(), nama: 'Detergen Rinso 900gr', kategori: 'Kebersihan', satuan: 'Pack', stok: 25, minStok: 8, hargaBeli: 21000, hargaJual: 25000 },
  ].map(p => ({ ...p, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), deskripsi: '' }));
  DB.saveProducts(seeds);
}

// ============================================================
//  INIT APP
// ============================================================
window.openEditProduk = openEditProduk;
window.hapusProduk    = hapusProduk;
window.updateDiff     = updateDiff;
window.switchTab      = switchTab;

seedDefaultData();
switchTab('dashboard');
