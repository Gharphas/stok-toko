import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FormatCurrency } from '../theme/colors';

export default function PosProductCard({ product, inCartQty = 0, onAddToCart }) {
  const stock = Number(product.stok) || 0;
  const isOutOfStock = stock <= 0;
  const isLowStock = !isOutOfStock && stock <= (Number(product.minStok) || 5);

  const getCategoryColor = (cat) => {
    switch ((cat || '').toLowerCase()) {
      case 'voucher': return Colors.primaryLight;
      case 'rokok': return Colors.amberLight;
      case 'makanan': return Colors.emeraldLight;
      case 'atk': return Colors.cyan;
      default: return Colors.textMuted;
    }
  };

  return (
    <TouchableOpacity
      style={[styles.card, inCartQty > 0 && styles.cardActive]}
      onPress={() => onAddToCart(product)}
      activeOpacity={0.8}
    >
      {/* Category & Cart Badge */}
      <View style={styles.cardTop}>
        <View style={styles.catChip}>
          <Text style={[styles.catText, { color: getCategoryColor(product.kategori) }]}>
            {(product.kategori || 'umum').toUpperCase()}
          </Text>
        </View>

        {inCartQty > 0 && (
          <View style={styles.inCartBadge}>
            <Ionicons name="cart" size={10} color="#ffffff" />
            <Text style={styles.inCartText}>{inCartQty}</Text>
          </View>
        )}
      </View>

      {/* Product Title */}
      <Text style={styles.productName} numberOfLines={2}>
        {product.nama}
      </Text>

      {/* Barcode Snippet */}
      {Boolean(product.barcode) && (
        <View style={styles.barcodeRow}>
          <Ionicons name="barcode-outline" size={12} color={Colors.textSubtle} />
          <Text style={styles.barcodeText} numberOfLines={1}>{product.barcode}</Text>
        </View>
      )}

      {/* Footer: Price & Stock Status */}
      <View style={styles.cardFooter}>
        <View>
          <Text style={styles.priceText}>{FormatCurrency(product.hargaJual)}</Text>
          <View style={styles.stockRow}>
            <View style={[
              styles.stockDot,
              isOutOfStock ? styles.stockDotRed : isLowStock ? styles.stockDotAmber : styles.stockDotGreen
            ]} />
            <Text style={[
              styles.stockText,
              isOutOfStock ? styles.stockTextRed : isLowStock ? styles.stockTextAmber : styles.stockTextGreen
            ]}>
              {isOutOfStock ? 'Habis' : `Stok: ${stock} ${product.satuan || 'pcs'}`}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.addBtn, inCartQty > 0 ? styles.addBtnActive : {}]}
          onPress={() => onAddToCart(product)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={inCartQty > 0 ? "add-circle" : "add"}
            size={18}
            color={inCartQty > 0 ? "#ffffff" : Colors.primaryLight}
          />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 10,
    flex: 1,
    margin: 4,
    justifyContent: 'space-between',
    minHeight: 140,
  },
  cardActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  catChip: {
    backgroundColor: Colors.background,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  catText: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  inCartBadge: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  inCartText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '800',
  },
  productName: {
    color: Colors.textPrimary,
    fontSize: 12.5,
    fontWeight: '700',
    lineHeight: 16,
    marginBottom: 4,
    minHeight: 32,
  },
  barcodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  barcodeText: {
    color: Colors.textSubtle,
    fontSize: 9.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 6,
    marginTop: 4,
  },
  priceText: {
    color: Colors.primaryLight,
    fontSize: 12.5,
    fontWeight: '800',
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  stockDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  stockDotGreen: { backgroundColor: Colors.emerald },
  stockDotAmber: { backgroundColor: Colors.amber },
  stockDotRed: { backgroundColor: Colors.rose },
  stockText: {
    fontSize: 9.5,
    fontWeight: '600',
  },
  stockTextGreen: { color: Colors.emeraldLight },
  stockTextAmber: { color: Colors.amberLight },
  stockTextRed: { color: Colors.roseLight },
  addBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primaryLight,
  },
});
