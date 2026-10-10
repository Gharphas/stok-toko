import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';

export default function BottomNav({ activeTab, onSelectTab, cartCount = 0 }) {
  const tabs = [
    { id: 'pos', label: 'Kasir POS', icon: 'cart-outline', iconActive: 'cart' },
    { id: 'inventory', label: 'Stok Barang', icon: 'cube-outline', iconActive: 'cube' },
    { id: 'mutations', label: 'Masuk/Keluar', icon: 'swap-horizontal-outline', iconActive: 'swap-horizontal' },
    { id: 'reports', label: 'Laporan', icon: 'stats-chart-outline', iconActive: 'stats-chart' },
  ];

  return (
    <View style={styles.navBar}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const isCart = tab.id === 'pos';

        return (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tabItem, isActive && styles.tabItemActive]}
            onPress={() => onSelectTab(tab.id)}
            activeOpacity={0.7}
          >
            <View style={styles.iconContainer}>
              <Ionicons
                name={isActive ? tab.iconActive : tab.icon}
                size={21}
                color={isActive ? Colors.primaryLight : Colors.textMuted}
              />
              {isCart && cartCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>
                    {cartCount > 99 ? '99+' : cartCount}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    elevation: 8,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  tabItemActive: {
    backgroundColor: Colors.primaryMuted,
  },
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textMuted,
    marginTop: 3,
  },
  tabLabelActive: {
    color: Colors.primaryLight,
    fontWeight: '700',
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: Colors.rose,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: Colors.surface,
  },
  cartBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
});
