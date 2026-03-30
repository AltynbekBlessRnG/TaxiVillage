import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, Pressable } from 'react-native';

const { width } = Dimensions.get('window');

interface DriverSideMenuProps {
  isOpen: boolean;
  onClose: () => void;
  profile: { fullName?: string; phone?: string; balance?: number; rating?: number } | null;
  unreadNotificationsCount?: number;
  unreadMessagesCount?: number;
  onNavigate: (screen: string) => void;
  onLogout: () => void;
}

export const DriverSideMenu: React.FC<DriverSideMenuProps> = ({
  isOpen,
  onClose,
  profile,
  unreadNotificationsCount = 0,
  unreadMessagesCount = 0,
  onNavigate,
  onLogout,
}) => {
  const slideAnim = useRef(new Animated.Value(-width)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: isOpen ? 0 : -width,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: isOpen ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start();
  }, [isOpen]);

  if (!isOpen && slideAnim.interpolate({ inputRange: [-width, 0], outputRange: [0, 1] }) as any === 0) {
    return null;
  }

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents={isOpen ? 'auto' : 'none'}>
      {/* Темный фон */}
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      {/* Само меню */}
      <Animated.View style={[styles.drawer, { transform: [{ translateX: slideAnim }] }]}>
        <View style={styles.header}>
          <Text style={styles.name}>{profile?.fullName || 'Водитель'}</Text>
          <Text style={styles.phone}>{profile?.phone || 'Загрузка...'}</Text>
          
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Баланс</Text>
              <Text style={styles.statValueGreen}>{profile?.balance ?? 0} ₸</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>Рейтинг</Text>
              <Text style={styles.statValueYellow}>{(profile?.rating ?? 5).toFixed(1)} ⭐</Text>
            </View>
          </View>
        </View>

        <View style={styles.menuItems}>
          <TouchableOpacity style={styles.menuItem} onPress={() => onNavigate('Notifications')}>
            <View style={styles.menuItemRow}>
              <Text style={styles.menuItemText}>🔔 Уведомления</Text>
              {unreadNotificationsCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                  </Text>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => onNavigate('Messages')}>
            <View style={styles.menuItemRow}>
              <Text style={styles.menuItemText}>💬 Сообщения</Text>
              {unreadMessagesCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                  </Text>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => onNavigate('DriverProfile')}>
            <Text style={styles.menuItemText}>👤 Мой профиль</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => onNavigate('RideHistory')}>
            <Text style={styles.menuItemText}>🕒 История поездок</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => alert('Настройки в разработке')}>
            <Text style={styles.menuItemText}>⚙️ Настройки</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutText}>Выйти из аккаунта</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 900 },
  drawer: { position: 'absolute', top: 0, bottom: 0, left: 0, width: width * 0.8, backgroundColor: '#09090B', zIndex: 1000, borderRightWidth: 1, borderColor: '#18181B' },
  header: { backgroundColor: '#18181B', padding: 24, paddingTop: 60, borderBottomWidth: 1, borderBottomColor: '#27272A' },
  name: { color: '#fff', fontSize: 22, fontWeight: '800' },
  phone: { color: '#94A3B8', fontSize: 14, marginTop: 4 },
  statsRow: { flexDirection: 'row', marginTop: 20, gap: 15 },
  statBox: { flex: 1, backgroundColor: '#0F172A', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#334155' },
  statLabel: { color: '#64748B', fontSize: 11, textTransform: 'uppercase', marginBottom: 4 },
  statValueGreen: { color: '#10B981', fontSize: 18, fontWeight: '700' },
  statValueYellow: { color: '#F59E0B', fontSize: 18, fontWeight: '700' },
  menuItems: { padding: 20, flex: 1 },
  menuItem: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#18181B' },
  menuItemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  menuItemText: { color: '#E2E8F0', fontSize: 16, fontWeight: '500' },
  badge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    paddingHorizontal: 8,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  logoutBtn: { margin: 20, marginBottom: 40, padding: 16, backgroundColor: '#7F1D1D', borderRadius: 12, alignItems: 'center' },
  logoutText: { color: '#FCA5A5', fontSize: 16, fontWeight: '600' },
});
