import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FormatCurrency } from '../theme/colors';

export default function CartModal({
  visible,
  onClose,
  cart,
  onUpdateQty,
  onClearCart,
  onCheckout,
}) {
  const [cashInput, setCashInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const totalAmount = cart.reduce(
    (sum, it) => sum + (Number(it.hargaJual) || 0) * (Number(it.qty) || 1),
    0
  );
  const totalItems = cart.reduce((sum, it) => sum + (Number(it.qty) || 1), 0);

  const paidAmount = Number(cashInput) || 0;
  const changeDue = Math.max(0, paidAmount - totalAmount);
  const isPaidValid = paidAmount >= totalAmount && totalAmount > 0;

  const setExactAmount = () => {
    setCashInput(String(totalAmount));
  };

  const handleQuickAddCash = (amount) => {
    const current = Number(cashInput) || 0;
    setCashInput(String(current + amount));
  };

  const handleProcessCheckout = async () => {
    if (cart.length === 0) {
      Alert.alert('Keranjang Kosong', 'Tambahkan barang terlebih dahulu.');
      return;
    }

    if (paidAmount < totalAmount) {
      Alert.alert(
        'Uang Kurang',
        `Pembayaran kurang ${FormatCurrency(totalAmount - paidAmount)}. Masukkan uang pas atau lebih.`
      );
      return;
    }

    setIsProcessing(true);
    try {
      await onCheckout({
        items: cart,
        totalAmount,
        cashPaid: paidAmount,
        changeDue,
      });
      setCashInput('');
    } catch (err) {
      Alert.alert('Gagal Checkout', err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetBox}>
          {/* Sheet Header */}
          <View style={styles.header}>
            <View style={styles.dragPill} />
            <View style={styles.headerRow}>
              <View style={styles.titleWithIcon}>
                <Ionicons name="cart" size={20} color={Colors.primaryLight} />
                <Text style={styles.title}>Keranjang Kasir</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{totalItems} barang</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Ionicons name="close" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Cart Item List */}
          <ScrollView style={styles.itemsScroll} contentContainerStyle={styles.itemsContent}>
            {cart.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="basket-outline" size={48} color={Colors.borderLight} />
                <Text style={styles.emptyTitle}>Keranjang Masih Kosong</Text>
                <Text style={styles.emptyDesc}>Pilih barang di katalog untuk melakukan transaksi.</Text>
              </View>
            ) : (
              cart.map((item) => {
                const itemTotal = (Number(item.hargaJual) || 0) * (Number(item.qty) || 1);
                return (
                  <View key={item.id} style={styles.itemCard}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName} numberOfLines={1}>
                        {item.nama}
                      </Text>
                      <Text style={styles.itemUnitPrice}>
                        {FormatCurrency(item.hargaJual)} / {item.satuan || 'pcs'}
                      </Text>
                    </View>

                    {/* Stepper */}
                    <View style={styles.stepperRow}>
                      <TouchableOpacity
                        style={styles.stepBtn}
                        onPress={() => onUpdateQty(item.id, (item.qty || 1) - 1)}
                      >
                        <Ionicons
                          name={(item.qty || 1) <= 1 ? "trash-outline" : "remove"}
                          size={14}
                          color={(item.qty || 1) <= 1 ? Colors.roseLight : Colors.textPrimary}
                        />
                      </TouchableOpacity>

                      <Text style={styles.stepValue}>{item.qty || 1}</Text>

                      <TouchableOpacity
                        style={styles.stepBtn}
                        onPress={() => onUpdateQty(item.id, (item.qty || 1) + 1)}
                      >
                        <Ionicons name="add" size={14} color={Colors.textPrimary} />
                      </TouchableOpacity>
                    </View>

                    {/* Subtotal */}
                    <Text style={styles.itemSubtotal}>{FormatCurrency(itemTotal)}</Text>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Payment & Action Footer */}
          {cart.length > 0 && (
            <View style={styles.footer}>
              {/* Total Row */}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Tagihan:</Text>
                <Text style={styles.totalValue}>{FormatCurrency(totalAmount)}</Text>
              </View>

              {/* Cash Input */}
              <View style={styles.cashInputBox}>
                <Text style={styles.cashLabel}>Uang Diterima (Rp):</Text>
                <View style={styles.cashInputWrap}>
                  <Text style={styles.rpPrefix}>Rp</Text>
                  <TextInput
                    style={styles.cashInput}
                    placeholder="0"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="number-pad"
                    value={cashInput}
                    onChangeText={setCashInput}
                  />
                  <TouchableOpacity style={styles.exactBtn} onPress={setExactAmount}>
                    <Text style={styles.exactText}>Uang Pas</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Quick Cash Pills */}
              <View style={styles.quickCashRow}>
                {[10000, 20000, 50000, 100000].map((nominal) => (
                  <TouchableOpacity
                    key={nominal}
                    style={styles.quickCashChip}
                    onPress={() => handleQuickAddCash(nominal)}
                  >
                    <Text style={styles.quickCashText}>+{nominal / 1000}k</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Change Due Row */}
              <View style={styles.changeRow}>
                <Text style={styles.changeLabel}>Kembalian:</Text>
                <Text style={[styles.changeValue, isPaidValid ? styles.changeGreen : styles.changeMuted]}>
                  {FormatCurrency(changeDue)}
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionBtnRow}>
                <TouchableOpacity style={styles.clearBtn} onPress={onClearCart}>
                  <Ionicons name="trash-outline" size={16} color={Colors.roseLight} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.checkoutBtn, !isPaidValid && styles.checkoutBtnDisabled]}
                  onPress={handleProcessCheckout}
                  disabled={isProcessing}
                >
                  <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
                  <Text style={styles.checkoutBtnText}>
                    {isProcessing ? 'Memproses...' : 'Proses & Cetak Struk'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetBox: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '90%',
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  dragPill: {
    width: 36,
    height: 4,
    backgroundColor: Colors.borderLight,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 6,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  countBadge: {
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  countText: {
    color: Colors.primaryLight,
    fontSize: 11,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: Colors.surfaceLight,
  },
  itemsScroll: {
    maxHeight: 220,
  },
  itemsContent: {
    padding: 14,
    gap: 8,
  },
  emptyBox: {
    paddingVertical: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
  },
  emptyDesc: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  itemInfo: {
    flex: 1,
    marginRight: 8,
  },
  itemName: {
    color: Colors.textPrimary,
    fontSize: 12.5,
    fontWeight: '700',
  },
  itemUnitPrice: {
    color: Colors.textMuted,
    fontSize: 10.5,
    marginTop: 2,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 2,
    gap: 6,
  },
  stepBtn: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: Colors.surfaceLight,
  },
  stepValue: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    minWidth: 16,
    textAlign: 'center',
  },
  itemSubtotal: {
    color: Colors.primaryLight,
    fontSize: 12.5,
    fontWeight: '800',
    marginLeft: 10,
    minWidth: 65,
    textAlign: 'right',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  totalLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  totalValue: {
    color: Colors.primaryLight,
    fontSize: 18,
    fontWeight: '900',
  },
  cashInputBox: {
    marginBottom: 8,
  },
  cashLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    marginBottom: 4,
    fontWeight: '600',
  },
  cashInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    height: 42,
  },
  rpPrefix: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    marginRight: 6,
  },
  cashInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  exactBtn: {
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  exactText: {
    color: Colors.primaryLight,
    fontSize: 11,
    fontWeight: '700',
  },
  quickCashRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  quickCashChip: {
    flex: 1,
    backgroundColor: Colors.surfaceLight,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickCashText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  changeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  changeLabel: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  changeValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  changeGreen: { color: Colors.emeraldLight },
  changeMuted: { color: Colors.textMuted },
  actionBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  clearBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.roseMuted,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkoutBtn: {
    flex: 1,
    backgroundColor: Colors.emerald,
    borderRadius: 12,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: Colors.emerald,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  checkoutBtnDisabled: {
    backgroundColor: Colors.surfaceLighter,
    shadowOpacity: 0,
  },
  checkoutBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
});
