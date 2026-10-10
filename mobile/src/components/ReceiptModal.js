import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Share,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FormatCurrency } from '../theme/colors';

export default function ReceiptModal({ visible, transaction, onClose, onNewTransaction }) {
  if (!transaction) return null;

  const handleShareWhatsApp = async () => {
    const itemsText = (transaction.items || [])
      .map(
        (it) =>
          `• ${it.nama}\n  ${it.qty}x @${FormatCurrency(it.hargaJual)} = ${FormatCurrency(
            (it.qty || 1) * (it.hargaJual || 0)
          )}`
      )
      .join('\n');

    const message =
      `*STOCKMASTER POS — STRUK PEMBAYARAN*\n` +
      `No. Nota: ${transaction.invoiceNo || 'INV-001'}\n` +
      `Waktu: ${new Date(transaction.tgl || Date.now()).toLocaleString('id-ID')}\n` +
      `Kasir: ${transaction.operator || 'Kasir'}\n` +
      `--------------------------------\n` +
      `${itemsText}\n` +
      `--------------------------------\n` +
      `*Total: ${FormatCurrency(transaction.totalAmount)}*\n` +
      `Bayar Tunai: ${FormatCurrency(transaction.cashPaid)}\n` +
      `Kembalian: ${FormatCurrency(transaction.changeDue)}\n\n` +
      `Terima kasih telah berbelanja di StockMaster!`;

    try {
      await Share.share({ message });
    } catch (e) {
      console.log('Share error:', e);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalBox}>
          {/* Header */}
          <View style={styles.head}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark-sharp" size={24} color="#ffffff" />
            </View>
            <Text style={styles.successTitle}>Transaksi Berhasil!</Text>
            <Text style={styles.successSub}>Struk belanja telah dibuat.</Text>
          </View>

          {/* Thermal Receipt Paper */}
          <ScrollView style={styles.receiptPaper} contentContainerStyle={styles.receiptContent}>
            <Text style={styles.storeName}>STOCKMASTER POS</Text>
            <Text style={styles.storeSub}>Toko Pulsa, Sembako & ATK</Text>
            <Text style={styles.storeAddress}>Jl. Toko Sejahtera No. 12</Text>

            <View style={styles.dashLine} />

            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>No. Nota:</Text>
              <Text style={styles.metaValue}>{transaction.invoiceNo || 'INV-001'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Tanggal:</Text>
              <Text style={styles.metaValue}>
                {new Date(transaction.tgl || Date.now()).toLocaleDateString('id-ID')}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Kasir:</Text>
              <Text style={styles.metaValue}>{transaction.operator || 'Kasir Toko'}</Text>
            </View>

            <View style={styles.dashLine} />

            {/* Items */}
            {(transaction.items || []).map((it, idx) => (
              <View key={idx} style={styles.receiptItem}>
                <Text style={styles.receiptItemName}>{it.nama}</Text>
                <View style={styles.receiptItemSubRow}>
                  <Text style={styles.receiptItemCalc}>
                    {it.qty} x {FormatCurrency(it.hargaJual)}
                  </Text>
                  <Text style={styles.receiptItemSubtotal}>
                    {FormatCurrency((it.qty || 1) * (it.hargaJual || 0))}
                  </Text>
                </View>
              </View>
            ))}

            <View style={styles.dashLine} />

            {/* Totals */}
            <View style={styles.totalLine}>
              <Text style={styles.totalLineLabel}>TOTAL:</Text>
              <Text style={styles.totalLineVal}>{FormatCurrency(transaction.totalAmount)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Bayar Tunai:</Text>
              <Text style={styles.metaValue}>{FormatCurrency(transaction.cashPaid)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Kembalian:</Text>
              <Text style={styles.metaValue}>{FormatCurrency(transaction.changeDue)}</Text>
            </View>

            <View style={styles.dashLine} />
            <Text style={styles.receiptFooter}>-- Terima Kasih --</Text>
            <Text style={styles.receiptFooterSub}>Barang yang dibeli tidak dapat ditukar</Text>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.waBtn} onPress={handleShareWhatsApp}>
              <Ionicons name="logo-whatsapp" size={18} color="#ffffff" />
              <Text style={styles.waBtnText}>Kirim WA</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.doneBtn} onPress={onNewTransaction}>
              <Ionicons name="cart-outline" size={18} color="#ffffff" />
              <Text style={styles.doneBtnText}>Transaksi Baru</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalBox: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    maxHeight: '92%',
  },
  head: {
    alignItems: 'center',
    marginBottom: 12,
  },
  successIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.emerald,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    shadowColor: Colors.emerald,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  successTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  successSub: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  receiptPaper: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    maxHeight: 280,
  },
  receiptContent: {
    paddingBottom: 8,
  },
  storeName: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  storeSub: {
    color: '#475569',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 1,
  },
  storeAddress: {
    color: '#64748b',
    fontSize: 9,
    textAlign: 'center',
  },
  dashLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    borderStyle: 'dashed',
    marginVertical: 8,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  metaLabel: {
    color: '#64748b',
    fontSize: 10.5,
  },
  metaValue: {
    color: '#0f172a',
    fontSize: 10.5,
    fontWeight: '700',
  },
  receiptItem: {
    marginBottom: 6,
  },
  receiptItemName: {
    color: '#0f172a',
    fontSize: 11,
    fontWeight: '700',
  },
  receiptItemSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 1,
  },
  receiptItemCalc: {
    color: '#64748b',
    fontSize: 10,
  },
  receiptItemSubtotal: {
    color: '#0f172a',
    fontSize: 10.5,
    fontWeight: '800',
  },
  totalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  totalLineLabel: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '900',
  },
  totalLineVal: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '900',
  },
  receiptFooter: {
    color: '#475569',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
  receiptFooterSub: {
    color: '#94a3b8',
    fontSize: 8.5,
    textAlign: 'center',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  waBtn: {
    flex: 1,
    height: 42,
    backgroundColor: '#25D366',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  waBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  doneBtn: {
    flex: 1.2,
    height: 42,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  doneBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
});
