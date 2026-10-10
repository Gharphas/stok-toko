import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FormatCurrency } from '../theme/colors';
import PosProductCard from '../components/PosProductCard';

export default function PosScreen({
  products,
  cart,
  onAddToCart,
  onOpenCart,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = [
    { id: 'all', label: 'Semua', icon: 'apps' },
    { id: 'voucher', label: 'Voucher', icon: 'phone-portrait' },
    { id: 'rokok', label: 'Rokok', icon: 'flame' },
    { id: 'makanan', label: 'Makanan & Minuman', icon: 'cafe' },
    { id: 'atk', label: 'ATK', icon: 'document-text' },
  ];

  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCategory === 'all' || (p.kategori || '').toLowerCase() === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      (p.nama || '').toLowerCase().includes(q) ||
      (p.barcode || '').toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  const cartTotalQty = cart.reduce((sum, it) => sum + (it.qty || 1), 0);
  const cartTotalAmount = cart.reduce(
    (sum, it) => sum + (Number(it.hargaJual) || 0) * (Number(it.qty) || 1),
    0
  );

  return (
    <View style={styles.container}>
      {/* Search & Barcode Input Bar */}
      <View style={styles.searchBarWrap}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={Colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari nama barang atau barcode..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Pills */}
      <View style={styles.categoryContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
          {categories.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.catChip, isActive && styles.catChipActive]}
                onPress={() => setSelectedCategory(cat.id)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={cat.icon}
                  size={12}
                  color={isActive ? '#ffffff' : Colors.textMuted}
                />
                <Text style={[styles.catChipText, isActive && styles.catChipTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 2-Column Product Grid */}
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        contentContainerStyle={styles.gridContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const inCartItem = cart.find((c) => c.id === item.id);
          const inCartQty = inCartItem ? inCartItem.qty : 0;
          return (
            <PosProductCard
              product={item}
              inCartQty={inCartQty}
              onAddToCart={onAddToCart}
            />
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="search-outline" size={44} color={Colors.borderLight} />
            <Text style={styles.emptyTitle}>Barang Tidak Ditemukan</Text>
            <Text style={styles.emptySubtitle}>
              Coba gunakan kata kunci pencarian lain atau pilih kategori yang sesuai.
            </Text>
          </View>
        }
      />

      {/* Floating Cart Pill (Shows when cart has items) */}
      {cartTotalQty > 0 && (
        <TouchableOpacity style={styles.floatingCart} onPress={onOpenCart} activeOpacity={0.85}>
          <View style={styles.floatLeft}>
            <View style={styles.floatIconCircle}>
              <Ionicons name="cart" size={18} color="#ffffff" />
              <View style={styles.floatBadge}>
                <Text style={styles.floatBadgeText}>{cartTotalQty}</Text>
              </View>
            </View>
            <View>
              <Text style={styles.floatTotal}>{FormatCurrency(cartTotalAmount)}</Text>
              <Text style={styles.floatSub}>{cartTotalQty} barang di keranjang</Text>
            </View>
          </View>

          <View style={styles.floatBtn}>
            <Text style={styles.floatBtnText}>Buka Kasir</Text>
            <Ionicons name="arrow-forward" size={14} color="#ffffff" />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchBarWrap: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    height: 40,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 12.5,
  },
  categoryContainer: {
    paddingBottom: 6,
  },
  categoryScroll: {
    paddingHorizontal: 12,
    gap: 6,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.surface,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  catChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primaryLight,
  },
  catChipText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  catChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  gridContent: {
    paddingHorizontal: 8,
    paddingBottom: 85,
  },
  emptyWrap: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
  },
  emptySubtitle: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  floatingCart: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  floatLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  floatIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  floatBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.rose,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  floatBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  floatTotal: {
    color: Colors.textPrimary,
    fontSize: 13.5,
    fontWeight: '800',
  },
  floatSub: {
    color: Colors.textMuted,
    fontSize: 10,
  },
  floatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.emerald,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  floatBtnText: {
    color: '#ffffff',
    fontSize: 11.5,
    fontWeight: '800',
  },
});
