// StockMaster REST API Client Service
// Menghubungkan front-end React Native ke backend serve.js (Node.js)

import { Platform } from 'react-native';

// Default host: di web localhost, di android emulator 10.0.2.2, atau IP Wi-Fi
const DEFAULT_API_BASE = Platform.OS === 'android' 
  ? 'http://10.0.2.2:5500' 
  : 'http://localhost:5500';

let currentApiBase = DEFAULT_API_BASE;

export const ApiConfig = {
  getBaseUrl: () => currentApiBase,
  setBaseUrl: (url) => {
    if (url) {
      currentApiBase = url.replace(/\/+$/, '');
    }
  },
  resetBaseUrl: () => {
    currentApiBase = DEFAULT_API_BASE;
  }
};

// Fallback seed data jika API server belum dijalankan
export const SEED_PRODUCTS = [
  {
    id: "prod_001",
    nama: "Voucher Telkomsel 10GB 30 Hari",
    kategori: "voucher",
    satuan: "pcs",
    stok: 24,
    minStok: 5,
    hargaBeli: 48000,
    hargaJual: 55000,
    barcode: "8991001001",
    createdAt: new Date().toISOString()
  },
  {
    id: "prod_002",
    nama: "Voucher Indosat Freedom 7GB",
    kategori: "voucher",
    satuan: "pcs",
    stok: 18,
    minStok: 5,
    hargaBeli: 32000,
    hargaJual: 38000,
    barcode: "8991001002",
    createdAt: new Date().toISOString()
  },
  {
    id: "prod_003",
    nama: "Rokok Sampoerna Mild 16",
    kategori: "rokok",
    satuan: "bks",
    stok: 35,
    minStok: 10,
    hargaBeli: 31500,
    hargaJual: 35000,
    barcode: "8992759112",
    createdAt: new Date().toISOString()
  },
  {
    id: "prod_004",
    nama: "Rokok Djarum Super 12",
    kategori: "rokok",
    satuan: "bks",
    stok: 28,
    minStok: 10,
    hargaBeli: 22000,
    hargaJual: 25000,
    barcode: "8992759113",
    createdAt: new Date().toISOString()
  },
  {
    id: "prod_005",
    nama: "Kopi Kapal Api Special Mix 10s",
    kategori: "makanan",
    satuan: "renceng",
    stok: 15,
    minStok: 4,
    hargaBeli: 13500,
    hargaJual: 16000,
    barcode: "8992759114",
    createdAt: new Date().toISOString()
  },
  {
    id: "prod_006",
    nama: "Indomie Goreng Original 85g",
    kategori: "makanan",
    satuan: "bks",
    stok: 80,
    minStok: 20,
    hargaBeli: 2850,
    hargaJual: 3500,
    barcode: "8998866200",
    createdAt: new Date().toISOString()
  },
  {
    id: "prod_007",
    nama: "Buku Tulis Sinar Dunia 38 Lembar",
    kategori: "atk",
    satuan: "buku",
    stok: 42,
    minStok: 10,
    hargaBeli: 3200,
    hargaJual: 4500,
    barcode: "8993456701",
    createdAt: new Date().toISOString()
  },
  {
    id: "prod_008",
    nama: "Bolpoin Standard AE7 0.5 Hitam",
    kategori: "atk",
    satuan: "pcs",
    stok: 65,
    minStok: 12,
    hargaBeli: 2200,
    hargaJual: 3000,
    barcode: "8993456702",
    createdAt: new Date().toISOString()
  }
];

// Helper Fetch dengan Timeout
async function apiRequest(endpoint, options = {}, timeoutMs = 4500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const url = `${currentApiBase}${endpoint}`;
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    clearTimeout(timer);
    
    if (!res.ok) {
      const errText = await res.text();
      let errData = {};
      try { errData = JSON.parse(errText); } catch(e) {}
      throw new Error(errData.message || `HTTP ${res.status}: ${res.statusText}`);
    }

    return await res.json();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

export const ApiService = {
  // 1. GET /api/data - Ambil seluruh database toko
  async getDatabase() {
    try {
      const result = await apiRequest('/api/data', { method: 'GET' });
      return { success: true, data: result.data, isOnline: true };
    } catch (err) {
      console.warn('API getDatabase offline, using fallback:', err.message);
      return {
        success: false,
        isOnline: false,
        error: err.message,
        data: {
          products: SEED_PRODUCTS,
          transactions: [],
          sales: [],
          opnames: [],
          users: []
        }
      };
    }
  },

  // 2. POST /api/pos/checkout - Checkout kasir multi-barang
  async checkoutPOS(payload) {
    try {
      const result = await apiRequest('/api/pos/checkout', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return { success: true, ...result, isOnline: true };
    } catch (err) {
      console.warn('API checkoutPOS error, fallback local processing:', err.message);
      return {
        success: true,
        isOnline: false,
        message: 'Transaksi disimpan di memori lokal (Mode Offline)',
        sale: {
          id: Date.now().toString(36),
          invoiceNo: payload.invoiceNo,
          items: payload.items,
          totalAmount: payload.totalAmount,
          cashPaid: payload.cashPaid,
          changeDue: payload.changeDue,
          operator: payload.operator || 'Kasir',
          tgl: new Date().toISOString()
        }
      };
    }
  },

  // 3. POST /api/masuk - Catat barang masuk / restock supplier
  async addStockIn(payload) {
    return await apiRequest('/api/masuk', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  // 4. POST /api/keluar - Catat barang keluar manual
  async addStockOut(payload) {
    return await apiRequest('/api/keluar', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  // 5. POST /api/products - Tambah atau edit barang
  async saveProduct(product) {
    return await apiRequest('/api/products', {
      method: 'POST',
      body: JSON.stringify(product)
    });
  },

  // 6. DELETE /api/products/:id - Hapus barang
  async deleteProduct(productId) {
    return await apiRequest(`/api/products/${productId}`, {
      method: 'DELETE'
    });
  },

  // 7. POST /api/login - Verifikasi pengguna
  async login(username, password) {
    return await apiRequest('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  }
};
