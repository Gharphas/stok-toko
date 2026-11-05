import React, { useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  StatusBar,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FormatCurrency, FormatNumber } from './src/theme/colors';
import { ApiService, ApiConfig, SEED_PRODUCTS } from './src/services/api';
import Header from './src/components/Header';
import BottomNav from './src/components/BottomNav';
import PosScreen from './src/screens/PosScreen';
import InventoryScreen from './src/screens/InventoryScreen';
import CartModal from './src/components/CartModal';
import ReceiptModal from './src/components/ReceiptModal';

export default function App() {
  const [activeTab, setActiveTab] = useState('pos');
  const [products, setProducts] = useState(SEED_PRODUCTS);
  const [transactions, setTransactions] = useState([]);
  const [sales, setSales] = useState([]);
  const [cart, setCart] = useState([]);

  const [isOnline, setIsOnline] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [cartModalVisible, setCartModalVisible] = useState(false);
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);

  // Server Config Modal
  const [serverModalVisible, setServerModalVisible] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState(ApiConfig.getBaseUrl());

  // Product Add / Edit Modal
  const [productModalVisible, setProductModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({
    nama: '',
    kategori: 'umum',
    satuan: 'pcs',
    stok: '0',
    minStok: '5',
    hargaBeli: '0',
    hargaJual: '0',
    barcode: '',
  });

  // Load database from API on mount
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await ApiService.getDatabase();
      setIsOnline(res.isOnline);
      if (res.data && Array.isArray(res.data.products) && res.data.products.length > 0) {
        setProducts(res.data.products);
      }
      if (res.data && Array.isArray(res.data.transactions)) {
        setTransactions(res.data.transactions);
      }
      if (res.data && Array.isArray(res.data.sales)) {
        setSales(res.data.sales);
      }
    } catch (err) {
      console.warn('Gagal memuat data:', err);
      setIsOnline(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Cart Management
  const handleAddToCart = (product, addQty = 1) => {
    setCart((prevCart) => {
      const existingIdx = prevCart.findIndex((item) => item.id === product.id);
      if (existingIdx > -1) {
        const next = [...prevCart];
        const newQty = (next[existingIdx].qty || 1) + addQty;
        const availableStock = Number(product.stok) || 0;
        if (newQty > availableStock && availableStock > 0) {
          Alert.alert(
            'Stok Terbatas',
            `Stok "${product.nama}" hanya tersedia ${availableStock} ${product.satuan || 'pcs'}.`
          );
          next[existingIdx].qty = availableStock;
        } else {
          next[existingIdx].qty = newQty;
        }
        return next;
      }
      return [...prevCart, { ...product, qty: Math.min(addQty, Math.max(1, Number(product.stok) || 1)) }];
    });
  };

  const handleUpdateCartQty = (productId, newQty) => {
    if (newQty <= 0) {
      setCart((prev) => prev.filter((it) => it.id !== productId));
      return;
    }
    setCart((prev) =>
      prev.map((it) => (it.id === productId ? { ...it, qty: newQty } : it))
    );
  };

  const handleClearCart = () => {
    setCart([]);
  };

  // Checkout Handler
  const handleCheckout = async (checkoutData) => {
    const invoiceNo = 'INV-' + Date.now().toString(36).toUpperCase();
    const payload = {
      invoiceNo,
      items: checkoutData.items.map((it) => ({
        id: it.id,
        nama: it.nama,
        barcode: it.barcode || it.kode || '',
        satuan: it.satuan || 'pcs',
        hargaJual: Number(it.hargaJual) || 0,
        hargaBeli: Number(it.hargaBeli) || 0,
        qty: Number(it.qty) || 1,
        subtotal: (Number(it.hargaJual) || 0) * (Number(it.qty) || 1),
      })),
      totalAmount: checkoutData.totalAmount,
      cashPaid: checkoutData.cashPaid,
      changeDue: checkoutData.changeDue,
      operator: 'Agung (Pemilik)',
      tgl: new Date().toISOString(),
    };

    const res = await ApiService.checkoutPOS(payload);

    // Update local stock immediately
    setProducts((prevProducts) =>
      prevProducts.map((p) => {
        const boughtItem = checkoutData.items.find((it) => it.id === p.id);
        if (boughtItem) {
          const currentStock = Number(p.stok) || 0;
          return { ...p, stok: Math.max(0, currentStock - (boughtItem.qty || 1)) };
        }
        return p;
      })
    );

    // Record local sale
    const completedSale = res.sale || payload;
    setSales((prev) => [completedSale, ...prev]);

    // Clear cart and show receipt
    setCart([]);
    setCartModalVisible(false);
    setLastReceipt(completedSale);
    setReceiptModalVisible(true);
  };

  // Product Add / Edit
  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setProductForm({
      nama: '',
      kategori: 'umum',
      satuan: 'pcs',
      stok: '0',
      minStok: '5',
      hargaBeli: '0',
      hargaJual: '0',
      barcode: '',
    });
    setProductModalVisible(true);
  };

  const handleSelectProductToEdit = (prod) => {
    setEditingProduct(prod);
    setProductForm({
      nama: prod.nama || '',
      kategori: prod.kategori || 'umum',
      satuan: prod.satuan || 'pcs',
      stok: String(prod.stok || 0),
      minStok: String(prod.minStok || 5),
      hargaBeli: String(prod.hargaBeli || 0),
      hargaJual: String(prod.hargaJual || 0),
      barcode: prod.barcode || prod.kode || '',
    });
    setProductModalVisible(true);
  };

  const handleSaveProductForm = async () => {
    if (!productForm.nama.trim()) {
      Alert.alert('Form Belum Lengkap', 'Nama barang wajib diisi!');
      return;
    }

    const payload = {
      ...(editingProduct ? { id: editingProduct.id } : {}),
      nama: productForm.nama.trim(),
      kategori: productForm.kategori.trim().toLowerCase(),
      satuan: productForm.satuan.trim(),
      stok: Number(productForm.stok) || 0,
      minStok: Number(productForm.minStok) || 0,
      hargaBeli: Number(productForm.hargaBeli) || 0,
      hargaJual: Number(productForm.hargaJual) || 0,
      barcode: productForm.barcode.trim(),
      updatedAt: new Date().toISOString(),
    };

    if (!editingProduct) {
      payload.createdAt = new Date().toISOString();
      payload.id = 'prod_' + Date.now().toString(36);
    }

    try {
      if (isOnline) {
        await ApiService.saveProduct(payload);
      }
      setProducts((prev) => {
        if (editingProduct) {
          return prev.map((p) => (p.id === editingProduct.id ? { ...p, ...payload } : p));
        }
        return [payload, ...prev];
      });
      setProductModalVisible(false);
      Alert.alert('Sukses', `Barang "${payload.nama}" berhasil disimpan!`);
    } catch (err) {
      Alert.alert('Gagal Simpan', err.message);
    }
  };

  const handleDeleteProduct = async (productId) => {
    try {
      if (isOnline) {
        await ApiService.deleteProduct(productId);
      }
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      setCart((prev) => prev.filter((it) => it.id !== productId));
      Alert.alert('Dihapus', 'Barang berhasil dihapus.');
    } catch (err) {
      Alert.alert('Gagal Hapus', err.message);
    }
  };

  // Server URL update
  const handleSaveServerUrl = () => {
    const url = serverUrlInput.trim();
    if (url) {
      ApiConfig.setBaseUrl(url);
      setServerModalVisible(false);
      loadData();
    }
  };

  const handleResetServerUrl = () => {
    ApiConfig.resetBaseUrl();
    setServerUrlInput(ApiConfig.getBaseUrl());
    setServerModalVisible(false);
    loadData();
  };

  // Render Mutations Tab
  const renderMutationsTab = () => {
    return (
      <View style={styles.tabContentContainer}>
        <View style={styles.tabHeaderBox}>
          <Text style={styles.tabHeaderTitle}>Riwayat Mutasi Barang</Text>
          <Text style={styles.tabHeaderSub}>Barang masuk restock & barang keluar</Text>
        </View>
        {transactions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="swap-horizontal" size={48} color={Colors.surfaceLighter} />
            <Text style={styles.emptyTitle}>Belum Ada Mutasi</Text>
            <Text style={styles.emptySub}>Semua riwayat restock dan barang keluar akan tampil di sini.</Text>
          </View>
        ) : (
          <FlatList
            data={transactions}
            keyExtractor={(item) => item.id || String(Math.random())}
            contentContainerStyle={styles.listPadding}
            renderItem={({ item }) => {
              const isMasuk = item.jenis === 'masuk';
              return (
                <View style={styles.mutationCard}>
                  <View style={[styles.mutationIconBox, isMasuk ? styles.bgEmerald : styles.bgRose]}>
                    <Ionicons
                      name={isMasuk ? 'arrow-down' : 'arrow-up'}
                      size={18}
                      color={isMasuk ? Colors.emeraldLight : Colors.roseLight}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mutationName}>{item.namaProduk || 'Barang'}</Text>
                    <Text style={styles.mutationDate}>
                      {new Date(item.tgl || Date.now()).toLocaleString('id-ID')} &bull; Oleh: {item.operator || 'Admin'}
                    </Text>
                    {item.keterangan ? (
                      <Text style={styles.mutationNote}>{item.keterangan}</Text>
                    ) : null}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.mutationQty, isMasuk ? styles.textEmerald : styles.textRose]}>
                      {isMasuk ? '+' : '-'}{item.jumlah} {item.satuan || 'pcs'}
                    </Text>
                    {item.total ? (
                      <Text style={styles.mutationTotal}>{FormatCurrency(item.total)}</Text>
                    ) : null}
                  </View>
                </View>
              );
            }}
          />
        )}
      </View>
    );
  };

  // Render Reports Tab
  const renderReportsTab = () => {
    const totalOmset = sales.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);
    const totalTrx = sales.length;

    return (
      <View style={styles.tabContentContainer}>
        <View style={styles.tabHeaderBox}>
          <Text style={styles.tabHeaderTitle}>Laporan Kasir & Penjualan</Text>
          <Text style={styles.tabHeaderSub}>Statistik omset toko dan transaksi</Text>
        </View>

        <View style={styles.reportSummaryRow}>
          <View style={[styles.reportCard, { borderLeftColor: Colors.primary }]}>
            <Text style={styles.reportCardLabel}>Total Omset</Text>
            <Text style={[styles.reportCardValue, { color: Colors.primaryLight }]}>
              {FormatCurrency(totalOmset)}
            </Text>
          </View>
          <View style={[styles.reportCard, { borderLeftColor: Colors.emerald }]}>
            <Text style={styles.reportCardLabel}>Total Transaksi</Text>
            <Text style={[styles.reportCardValue, { color: Colors.emeraldLight }]}>
              {totalTrx} Struk
            </Text>
          </View>
        </View>

        {sales.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={48} color={Colors.surfaceLighter} />
            <Text style={styles.emptyTitle}>Belum Ada Penjualan</Text>
            <Text style={styles.emptySub}>Transaksi kasir POS yang berhasil akan tercatat otomatis di sini.</Text>
          </View>
        ) : (
          <FlatList
            data={sales}
            keyExtractor={(item) => item.id || item.invoiceNo || String(Math.random())}
            contentContainerStyle={styles.listPadding}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.saleCard}
                onPress={() => {
                  setLastReceipt(item);
                  setReceiptModalVisible(true);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.saleCardLeft}>
                  <View style={styles.saleIconBox}>
                    <Ionicons name="receipt" size={16} color={Colors.primaryLight} />
                  </View>
                  <View>
                    <Text style={styles.saleInvoice}>{item.invoiceNo || 'INV-001'}</Text>
                    <Text style={styles.saleDate}>
                      {new Date(item.tgl || Date.now()).toLocaleString('id-ID')} &bull; {(item.items || []).length} Barang
                    </Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.saleAmount}>{FormatCurrency(item.totalAmount)}</Text>
                  <Text style={styles.saleOperator}>Kasir: {item.operator || 'Kasir'}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    );
  };

  const getActiveTabTitle = () => {
    switch (activeTab) {
      case 'pos':
        return 'Kasir POS';
      case 'inventory':
        return 'Katalog & Stok';
      case 'mutations':
        return 'Mutasi Barang';
      case 'reports':
        return 'Laporan Toko';
      default:
        return 'StockMaster';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />

      {/* Main Header */}
      <Header
        isOnline={isOnline}
        onRefresh={loadData}
        onOpenServerConfig={() => setServerModalVisible(true)}
        currentOperator="Agung (Pemilik)"
        activeTabTitle={getActiveTabTitle()}
      />

      {/* Main Body */}
      <View style={styles.mainContainer}>
        {isLoading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Menghubungkan ke database...</Text>
          </View>
        ) : (
          <>
            {activeTab === 'pos' && (
              <PosScreen
                products={products}
                cart={cart}
                onAddToCart={handleAddToCart}
                onOpenCart={() => setCartModalVisible(true)}
              />
            )}
            {activeTab === 'inventory' && (
              <InventoryScreen
                products={products}
                onOpenAddProduct={handleOpenAddProduct}
                onSelectProductToEdit={handleSelectProductToEdit}
                onDeleteProduct={handleDeleteProduct}
              />
            )}
            {activeTab === 'mutations' && renderMutationsTab()}
            {activeTab === 'reports' && renderReportsTab()}
          </>
        )}
      </View>

      {/* Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        cartCount={cart.reduce((s, it) => s + (it.qty || 1), 0)}
      />

      {/* Cart Modal */}
      <CartModal
        visible={cartModalVisible}
        onClose={() => setCartModalVisible(false)}
        cart={cart}
        onUpdateQty={handleUpdateCartQty}
        onClearCart={handleClearCart}
        onCheckout={handleCheckout}
      />

      {/* Receipt Modal */}
      <ReceiptModal
        visible={receiptModalVisible}
        transaction={lastReceipt}
        onClose={() => setReceiptModalVisible(false)}
        onNewTransaction={() => {
          setReceiptModalVisible(false);
          setActiveTab('pos');
        }}
      />

      {/* Server Config Modal */}
      <Modal
        visible={serverModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setServerModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHead}>
              <View style={styles.headIconBox}>
                <Ionicons name="server" size={18} color={Colors.primaryLight} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Konfigurasi Server API</Text>
                <Text style={styles.modalSub}>Sambungkan HP ke PC/Laptop server toko</Text>
              </View>
              <TouchableOpacity onPress={() => setServerModalVisible(false)}>
                <Ionicons name="close" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Alamat URL Server PC (Port 5500)</Text>
              <TextInput
                style={styles.textInput}
                value={serverUrlInput}
                onChangeText={setServerUrlInput}
                placeholder="http://192.168.1.xxx:5500"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
              />
              <Text style={styles.inputHint}>
                💡 Jalankan `jalankan_server.bat` di PC. Masukkan IP yang tertera di terminal PC Anda.
              </Text>

              <View style={styles.modalButtonRow}>
                <TouchableOpacity
                  style={[styles.btnAction, styles.btnGhost]}
                  onPress={handleResetServerUrl}
                >
                  <Text style={styles.btnGhostText}>Reset Default</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnAction, styles.btnPrimary]}
                  onPress={handleSaveServerUrl}
                >
                  <Text style={styles.btnPrimaryText}>Simpan &amp; Hubungkan</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add / Edit Product Modal */}
      <Modal
        visible={productModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setProductModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: '90%' }]}>
            <View style={styles.modalHead}>
              <View style={styles.headIconBox}>
                <Ionicons name="cube" size={18} color={Colors.primaryLight} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>
                  {editingProduct ? 'Edit Barang' : 'Tambah Barang Baru'}
                </Text>
                <Text style={styles.modalSub}>Isi data produk katalog toko</Text>
              </View>
              <TouchableOpacity onPress={() => setProductModalVisible(false)}>
                <Ionicons name="close" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Nama Barang *</Text>
              <TextInput
                style={styles.textInput}
                value={productForm.nama}
                onChangeText={(t) => setProductForm({ ...productForm, nama: t })}
                placeholder="Contoh: Voucher Tri 6GB 1 Hari"
                placeholderTextColor={Colors.textMuted}
              />

              <View style={styles.formRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.inputLabel}>Kategori</Text>
                  <TextInput
                    style={styles.textInput}
                    value={productForm.kategori}
                    onChangeText={(t) => setProductForm({ ...productForm, kategori: t })}
                    placeholder="voucher / sembako / atk"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Satuan</Text>
                  <TextInput
                    style={styles.textInput}
                    value={productForm.satuan}
                    onChangeText={(t) => setProductForm({ ...productForm, satuan: t })}
                    placeholder="pcs / bks / renceng"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.inputLabel}>Harga Beli (Rp)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={productForm.hargaBeli}
                    onChangeText={(t) => setProductForm({ ...productForm, hargaBeli: t })}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Harga Jual (Rp) *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={productForm.hargaJual}
                    onChangeText={(t) => setProductForm({ ...productForm, hargaJual: t })}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.inputLabel}>Stok Saat Ini</Text>
                  <TextInput
                    style={styles.textInput}
                    value={productForm.stok}
                    onChangeText={(t) => setProductForm({ ...productForm, stok: t })}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Batas Stok Menipis</Text>
                  <TextInput
                    style={styles.textInput}
                    value={productForm.minStok}
                    onChangeText={(t) => setProductForm({ ...productForm, minStok: t })}
                    keyboardType="numeric"
                    placeholder="5"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Kode Barcode / QR (Opsional)</Text>
              <TextInput
                style={styles.textInput}
                value={productForm.barcode}
                onChangeText={(t) => setProductForm({ ...productForm, barcode: t })}
                placeholder="Scan atau ketik barcode..."
                placeholderTextColor={Colors.textMuted}
              />

              <View style={[styles.modalButtonRow, { marginTop: 16, marginBottom: 20 }]}>
                <TouchableOpacity
                  style={[styles.btnAction, styles.btnGhost]}
                  onPress={() => setProductModalVisible(false)}
                >
                  <Text style={styles.btnGhostText}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnAction, styles.btnPrimary]}
                  onPress={handleSaveProductForm}
                >
                  <Text style={styles.btnPrimaryText}>Simpan Barang</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  mainContainer: {
    flex: 1,
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  tabContentContainer: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  tabHeaderBox: {
    marginBottom: 12,
  },
  tabHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  tabHeaderSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  listPadding: {
    paddingBottom: 24,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    marginTop: 40,
  },
  emptyTitle: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySub: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  // Mutation Card
  mutationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  mutationIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bgEmerald: {
    backgroundColor: Colors.emeraldMuted,
  },
  bgRose: {
    backgroundColor: Colors.roseMuted,
  },
  mutationName: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  mutationDate: {
    color: Colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  mutationNote: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontStyle: 'italic',
    marginTop: 2,
  },
  mutationQty: {
    fontSize: 14,
    fontWeight: '800',
  },
  textEmerald: {
    color: Colors.emeraldLight,
  },
  textRose: {
    color: Colors.roseLight,
  },
  mutationTotal: {
    color: Colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  // Reports
  reportSummaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  reportCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 4,
  },
  reportCardLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  reportCardValue: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  saleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  saleCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  saleIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saleInvoice: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  saleDate: {
    color: Colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  saleAmount: {
    color: Colors.emeraldLight,
    fontSize: 13,
    fontWeight: '800',
  },
  saleOperator: {
    color: Colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  // Modals Generic
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalBox: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 10,
  },
  headIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  modalSub: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  modalBody: {
    padding: 16,
  },
  inputLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 10,
  },
  textInput: {
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    color: Colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 13,
  },
  inputHint: {
    color: Colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 8,
  },
  formRow: {
    flexDirection: 'row',
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  btnAction: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhost: {
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  btnGhostText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  btnPrimary: {
    backgroundColor: Colors.primary,
  },
  btnPrimaryText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
});

