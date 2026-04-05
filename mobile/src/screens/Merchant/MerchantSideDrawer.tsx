import React from 'react';
import { Animated, Dimensions, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { width } = Dimensions.get('window');

type Props = {
  visible: boolean;
  sideMenuAnim: Animated.Value;
  menuBackdropOpacity: Animated.Value;
  name?: string | null;
  phone?: string | null;
  isOpen?: boolean;
  onClose: () => void;
  onOpenMenuEditor: () => void;
  onOpenOrders: () => void;
  onOpenPreview: () => void;
  onLogout: () => void;
};

export const MerchantSideDrawer: React.FC<Props> = ({
  visible,
  sideMenuAnim,
  menuBackdropOpacity,
  name,
  phone,
  isOpen,
  onClose,
  onOpenMenuEditor,
  onOpenOrders,
  onOpenPreview,
  onLogout,
}) => (
  <>
    {visible ? (
      <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose}>
        <Animated.View style={[styles.menuBackdrop, { opacity: menuBackdropOpacity }]} />
      </Pressable>
    ) : null}

    <Animated.View style={[styles.sideDrawer, { transform: [{ translateX: sideMenuAnim }] }]}>
      <View style={styles.drawerHeader}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>
            {((name || phone || 'R')
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part[0])
              .join('') || 'R')
              .toUpperCase()}
          </Text>
        </View>
        <Text style={styles.drName}>{name || 'Ресторан'}</Text>
        {phone ? <Text style={styles.drPhone}>{phone}</Text> : null}
        <View style={[styles.statusPill, isOpen ? styles.statusPillOpen : styles.statusPillClosed]}>
          <Text style={[styles.statusPillText, isOpen ? styles.statusPillTextOpen : styles.statusPillTextClosed]}>
            {isOpen ? 'Открыто' : 'Закрыто'}
          </Text>
        </View>
      </View>

      <View style={styles.drawerBody}>
        <TouchableOpacity style={styles.drawerItem} onPress={onClose}>
          <Text style={styles.drawerText}>Главная</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.drawerItem} onPress={onOpenMenuEditor}>
          <Text style={styles.drawerText}>Меню</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.drawerItem} onPress={onOpenOrders}>
          <Text style={styles.drawerText}>Заказы</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.drawerItem} onPress={onOpenPreview}>
          <Text style={styles.drawerText}>Как видит клиент</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.drawerItem, styles.logoutItem]} onPress={onLogout}>
          <Text style={[styles.drawerText, styles.logoutText]}>Выйти</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  </>
);

const styles = StyleSheet.create({
  menuBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.62)', zIndex: 900 },
  sideDrawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: width * 0.8,
    backgroundColor: '#09090B',
    zIndex: 1000,
    borderRightWidth: 1,
    borderColor: '#1F1F24',
  },
  drawerHeader: {
    backgroundColor: '#131316',
    padding: 28,
    paddingTop: 68,
    borderBottomWidth: 1,
    borderBottomColor: '#27272A',
  },
  avatarCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2D160B',
    borderWidth: 1,
    borderColor: '#7C2D12',
    marginBottom: 14,
  },
  avatarText: {
    color: '#FED7AA',
    fontSize: 22,
    fontWeight: '900',
  },
  drName: { color: '#F4F4F5', fontSize: 22, fontWeight: '900' },
  drPhone: { color: '#A1A1AA', fontSize: 14, marginTop: 6 },
  statusPill: {
    alignSelf: 'flex-start',
    marginTop: 14,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  statusPillOpen: {
    backgroundColor: '#143124',
    borderColor: '#166534',
  },
  statusPillClosed: {
    backgroundColor: '#2A1515',
    borderColor: '#7F1D1D',
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  statusPillTextOpen: { color: '#86EFAC' },
  statusPillTextClosed: { color: '#FCA5A5' },
  drawerBody: { padding: 20 },
  drawerItem: {
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#18181B',
  },
  drawerText: { color: '#E4E4E7', fontSize: 17, fontWeight: '600' },
  logoutItem: { marginTop: 16 },
  logoutText: { color: '#FCA5A5' },
});
