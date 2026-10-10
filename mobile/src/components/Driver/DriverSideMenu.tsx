import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  BackHandler,
  Dimensions,
  Pressable,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { showAlert } from '../AppAlert';
import { resolveApiAssetUrl } from '../../utils/assets';
import { colors } from '../../theme/colors';

const { width } = Dimensions.get('window');

interface DriverSideMenuProps {
  isOpen: boolean;
  onClose: () => void;
  profile: { fullName?: string; phone?: string; balance?: number; rating?: number; user?: { avatarUrl?: string | null } } | null;
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
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-width)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReduceMotion();
  const avatarUri = useMemo(() => resolveApiAssetUrl(profile?.user?.avatarUrl), [profile?.user?.avatarUrl]);
  const initials = useMemo(
    () =>
      ((profile?.fullName || profile?.phone || 'В')
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join('') || 'В').toUpperCase(),
    [profile?.fullName, profile?.phone],
  );

  const menuEntries = useMemo(
    (): Array<{
      label: string;
      icon: keyof typeof Ionicons.glyphMap;
      onPress: () => void;
      badge?: number;
    }> => [
      {
        label: 'Уведомления',
        icon: 'notifications-outline',
        onPress: () => onNavigate('Notifications'),
        badge: unreadNotificationsCount,
      },
      {
        label: 'Сообщения',
        icon: 'chatbubble-ellipses-outline',
        onPress: () => onNavigate('Messages'),
        badge: unreadMessagesCount,
      },
      { label: 'Мой профиль', icon: 'person-outline', onPress: () => onNavigate('DriverProfile') },
      { label: 'Баланс', icon: 'wallet-outline', onPress: () => onNavigate('DriverBalance') },
      { label: 'История поездок', icon: 'time-outline', onPress: () => onNavigate('RideHistory') },
      {
        label: 'Настройки',
        icon: 'settings-outline',
        onPress: () => showAlert('Настройки', 'Раздел ещё в разработке.'),
      },
    ],
    [onNavigate, unreadMessagesCount, unreadNotificationsCount],
  );

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: isOpen ? 0 : -width,
        duration: reduceMotion ? 0 : 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: isOpen ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start();
  }, [fadeAnim, isOpen, reduceMotion, slideAnim]);

  // The menu is a plain overlay, not a Modal, so Android Back would leave the
  // screen instead of closing it.
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [isOpen, onClose]);

  return (
    <View
      style={StyleSheet.absoluteFillObject}
      pointerEvents={isOpen ? 'auto' : 'none'}
      // Closed, the menu sits off-screen; keep screen readers out of it, and
      // while open keep them out of the map behind it.
      accessibilityElementsHidden={!isOpen}
      importantForAccessibility={isOpen ? 'auto' : 'no-hide-descendants'}
      accessibilityViewIsModal={isOpen}
    >
      {/* Темный фон */}
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <Pressable
          style={{ flex: 1 }}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Закрыть меню"
        />
      </Animated.View>

      {/* Само меню */}
      <Animated.View style={[styles.drawer, { transform: [{ translateX: slideAnim }] }]}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 16 }]}>
          <View style={styles.avatarRow}>
            <View style={styles.avatarCircle}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{initials}</Text>
              )}
            </View>
            <View style={styles.headerTextWrap}>
              <Text style={styles.name}>{profile?.fullName || profile?.phone || 'Водитель'}</Text>
              {profile?.phone ? <Text style={styles.phone}>{profile.phone}</Text> : null}
            </View>
          </View>
          
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
          {menuEntries.map((entry) => (
            <TouchableOpacity
              key={entry.label}
              style={styles.menuItem}
              onPress={entry.onPress}
              accessibilityRole="button"
              accessibilityLabel={entry.label}
            >
              <View style={styles.menuItemRow}>
                <Ionicons name={entry.icon} size={20} color={colors.textSecondary} style={styles.menuItemIcon} />
                <Text style={styles.menuItemText}>{entry.label}</Text>
                {entry.badge ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{entry.badge > 99 ? '99+' : entry.badge}</Text>
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout} accessibilityRole="button">
          <Text style={styles.logoutText}>Выйти из аккаунта</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 900 },
  drawer: { position: 'absolute', top: 0, bottom: 0, left: 0, width: width * 0.8, backgroundColor: colors.bg, zIndex: 1000, borderRightWidth: 1, borderColor: colors.surface },
  header: { backgroundColor: colors.surface, padding: 24, borderBottomWidth: 1, borderBottomColor: colors.border },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: { color: colors.textMuted, fontSize: 20, fontWeight: '900' },
  headerTextWrap: { flex: 1 },
  name: { color: colors.white, fontSize: 22, fontWeight: '800' },
  phone: { color: colors.textSecondary, fontSize: 14, marginTop: 4 },
  statsRow: { flexDirection: 'row', marginTop: 20, gap: 15 },
  statBox: { flex: 1, backgroundColor: colors.surfaceSunken, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.borderStrong },
  statLabel: { color: colors.textTertiary, fontSize: 11, textTransform: 'uppercase', marginBottom: 4 },
  statValueGreen: { color: colors.success, fontSize: 18, fontWeight: '700' },
  statValueYellow: { color: colors.warning, fontSize: 18, fontWeight: '700' },
  menuItems: { padding: 20, flex: 1 },
  menuItem: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.surface },
  menuItemRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  menuItemIcon: { width: 22, textAlign: 'center' },
  menuItemText: { color: colors.textMuted, fontSize: 16, fontWeight: '500', flex: 1 },
  badge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    paddingHorizontal: 8,
    backgroundColor: colors.dangerStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  logoutBtn: { margin: 20, marginBottom: 40, padding: 16, backgroundColor: colors.dangerBorder, borderRadius: 12, alignItems: 'center' },
  logoutText: { color: colors.dangerText, fontSize: 16, fontWeight: '600' },
});
