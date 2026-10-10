import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FormatCurrency } from '../theme/colors';

export default function InventoryScreen({
  products,
  onOpenAddProduct,
  onDeleteProduct,
  onSelectProductToEdit,
}) {
  const [search, setSearch] = useState('');
  const [filterStock, setFilterStock] = useState('all'); // 'all' | 'low' | 'empty'

  const filtered = products.filter((p) => {
    const stock = Number(p.stok) || 0;
    const min = Number(p.minStok) || 5;

    let matchStock = true;
    if (filterStock === 'empty') matchStock = stock <= 0;
    if (filterStock === 'low') matchStock = stock > 0 && stock <= min;

    const q = search.toLowerCase().trim();
    const matchSearch =
      !q ||
      (p.nama || '').toLowerCase().includes(q) ||
      (p.barcode || '').toLowerCase().includes(q) ||
      (p.kategori || '').toLowerCase().includes(q);

    return matchStock && matchSearch;
  });

  const totalSKU = products.length;
  const emptySKU = products.filter((p) => (Number(p.stok) || 0) <= 0).length;
  const lowSKU = products.filter((p) => {
    const s = Number(p.stok) || 0;
    const m = Number(p.minStok) || 5;
    return s > 0 && s <= m;
  }).length;

  const handleDelete = (p) => {
    Alert.alert(
      'Hapus Barang',
      `Yakin ingin menghapus "${p.nama}" dari katalog toko?`,
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Hapus', style: 'destructive', onPress: () => onDeleteProduct(p.id) },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Stats Overview */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total SKU</Text>
          <Text style={styles.statValue}>{totalSKU}</Text>
        </View>

        <TouchableOpacity
          style={[styles.statCard, filterStock === 'low' && styles.statCardActive]}
          onPress={() => setFilterStock(filterStock === 'low' ? 'all' : 'low')}
        >
          <Text style={[styles.statLabel, { color: Colors.amberLight }]}>Menipis</Text>
          <Text style={[styles.statValue, { color: Colors.amberLight }]}>{lowSKU}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.statCard, filterStock === 'empty' && styles.statCardActive]}
          onPress={() => setFilterStock(filterStock === 'empty' ? 'all' : 'empty')}
        >
          <Text style={[styles.statLabel, { color: Colors.roseLight }]}>Habis</Text>
          <Text style={[styles.statValue, { color: Colors.roseLight }]}>{emptySKU}</Text>
        </TouchableOpacity>
      </View>

      {/* Search & Add Toolbar */}
      <View style={styles.toolbar}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={15} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari SKU, nama, kategori..."
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={15} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={styles.addBtn} onPress={onOpenAddProduct} activeOpacity={0.8}>
          <Ionicons name="add" size={18} color="#ffffff" />
          <Text style={styles.addBtnText}>+ Barang</Text>
        </TouchableOpacity>
      </View>

      {/* Product List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const stock = Number(item.stok) || 0;
          const min = Number(item.minStok) || 5;
          const isEmpty = stock <= 0;
          const isLow = !isEmpty && stock <= min;

          return (
            <View style={styles.productCard}>
              <View style={styles.cardMain}>
                <View style={styles.cardHeader}>
                  <View style={styles.catPill}>
                    <Text style={styles.catPillText}>{(item.kategori || 'umum').toUpperCase()}</Text>
                  </View>
                  {Boolean(item.barcode) && (
                    <Text style={styles.barcodeText}>{item.barcode}</Text>
                  )}
                </View>

                <Text style={styles.productName} numberOfLines={1}>
                  {item.nama}
                </Text>

                <View style={styles.pricesRow}>
                  <View>
                    <Text style={styles.priceLabel}>Harga Jual</Text>
                    <Text style={styles.priceJual}>{FormatCurrency(item.hargaJual)}</Text>
                  </View>
                  <View style={{ marginLeft: 16 }}>
                    <Text style={styles.priceLabel}>HPP Modal</Text>
                    <Text style={styles.priceBeli}>{FormatCurrency(item.hargaBeli)}</Text>
                  </View>
                </View>
              </View>

              {/* Stock Badge & Actions */}
              <View style={styles.cardRight}>
                <View
                  style={[
                    styles.stockBadge,
                    isEmpty ? styles.stockEmpty : isLow ? styles.stockLow : styles.stockSafe,
                  ]}
                >
                  <Text
                    style={[
                      styles.stockValText,
                      isEmpty ? styles.textRed : isLow ? styles.textAmber : styles.textGreen,
                    ]}
                  >
                    {stock} {item.satuan || 'pcs'}
                  </Text>
                  <Text
                    style={[
                      styles.stockStatusText,
                      isEmpty ? styles.textRed : isLow ? styles.textAmber : styles.textGreen,
                    ]}
                  >
                    {isEmpty ? 'Habis' : isLow ? 'Menipis' : 'Aman'}
                  </Text>
                </View>

                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.actionIconBtn}
                    onPress={() => onSelectProductToEdit && onSelectProductToEdit(item)}
                  >
                    <Ionicons name="pencil" size={14} color={Colors.primaryLight} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionIconBtn}
                    onPress={() => handleDelete(item)}
                  >
                    <Ionicons name="trash" size={14} color={Colors.roseLight} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyView}>
            <Ionicons name="cube-outline" size={44} color={Colors.borderLight} />
            <Text style={styles.emptyTitle}>Tidak ada barang dalam filter ini</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  statCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryMuted,
  },
  statLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  statValue: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  toolbar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    height: 38,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 12,
  },
  addBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 4,
    height: 38,
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  listContent: {
    padding: 12,
    gap: 8,
    paddingBottom: 40,
  },
  productCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardMain: {
    flex: 1,
    marginRight: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  catPill: {
    backgroundColor: Colors.background,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  catPillText: {
    color: Colors.primaryLight,
    fontSize: 8.5,
    fontWeight: '800',
  },
  barcodeText: {
    color: Colors.textSubtle,
    fontSize: 9.5,
  },
  productName: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  pricesRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceLabel: {
    color: Colors.textSubtle,
    fontSize: 8.5,
  },
  priceJual: {
    color: Colors.emeraldLight,
    fontSize: 12,
    fontWeight: '800',
  },
  priceBeli: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  stockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    minWidth: 70,
  },
  stockSafe: {
    backgroundColor: Colors.emeraldMuted,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  stockLow: {
    backgroundColor: Colors.amberMuted,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  stockEmpty: {
    backgroundColor: Colors.roseMuted,
    borderColor: 'rgba(244, 63, 94, 0.4)',
  },
  stockValText: {
    fontSize: 11,
    fontWeight: '800',
  },
  stockStatusText: {
    fontSize: 8.5,
    fontWeight: '700',
  },
  textGreen: { color: Colors.emeraldLight },
  textAmber: { color: Colors.amberLight },
  textRed: { color: Colors.roseLight },
  cardActions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyView: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    color: Colors.textMuted,
    fontSize: 13,
    marginTop: 8,
  },
});
