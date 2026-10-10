import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';

export default function Header({
  isOnline,
  onRefresh,
  onOpenServerConfig,
  currentOperator = 'Agung (Pemilik)',
  activeTabTitle = 'Kasir POS'
}) {
  return (
    <View style={styles.header}>
      {/* Top Branding Row */}
      <View style={styles.brandRow}>
        <View style={styles.brandLeft}>
          <View style={styles.brandIconBox}>
            <Ionicons name="cube" size={18} color="#ffffff" />
          </View>
          <View>
            <View style={styles.titleBadgeRow}>
              <Text style={styles.brandTitle}>StockMaster</Text>
              <View style={styles.mobileBadge}>
                <Text style={styles.mobileBadgeText}>POS</Text>
              </View>
            </View>
            <Text style={styles.brandSubtitle}>Toko Pulsa, Sembako & ATK</Text>
          </View>
        </View>

        {/* Status & Sync Badge */}
        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={[styles.syncStatusBadge, isOnline ? styles.syncOnline : styles.syncOffline]}
            onPress={onOpenServerConfig}
            activeOpacity={0.7}
          >
            <View style={[styles.statusDot, isOnline ? styles.statusDotGreen : styles.statusDotRed]} />
            <Text style={[styles.syncText, isOnline ? styles.syncTextGreen : styles.syncTextRed]}>
              {isOnline ? 'API Terhubung' : 'Offline'}
            </Text>
            <Ionicons name="settings-sharp" size={11} color={isOnline ? Colors.emeraldLight : Colors.roseLight} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh} activeOpacity={0.7}>
            <Ionicons name="sync" size={15} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Operator & Section Subbar */}
      <View style={styles.subbarRow}>
        <View style={styles.operatorPill}>
          <Ionicons name="person-circle" size={14} color={Colors.primaryLight} />
          <Text style={styles.operatorText} numberOfLines={1}>{currentOperator}</Text>
        </View>
        <View style={styles.activeScreenIndicator}>
          <Ionicons name="radio-button-on" size={10} color={Colors.primaryLight} />
          <Text style={styles.activeScreenText}>{activeTabTitle}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.surface,
    paddingTop: Platform.OS === 'ios' ? 44 : 12,
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  titleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  mobileBadge: {
    backgroundColor: Colors.primaryMuted,
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 5,
  },
  mobileBadgeText: {
    color: Colors.primaryLight,
    fontSize: 9,
    fontWeight: '800',
  },
  brandSubtitle: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  syncStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  syncOnline: {
    backgroundColor: Colors.emeraldMuted,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  syncOffline: {
    backgroundColor: Colors.roseMuted,
    borderColor: 'rgba(244, 63, 94, 0.4)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotGreen: {
    backgroundColor: Colors.emeraldLight,
  },
  statusDotRed: {
    backgroundColor: Colors.roseLight,
  },
  syncText: {
    fontSize: 10,
    fontWeight: '700',
  },
  syncTextGreen: {
    color: Colors.emeraldLight,
  },
  syncTextRed: {
    color: Colors.roseLight,
  },
  refreshBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  operatorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '65%',
  },
  operatorText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  activeScreenIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activeScreenText: {
    color: Colors.primaryLight,
    fontSize: 11,
    fontWeight: '700',
  },
});
