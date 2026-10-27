import React from 'react';
import { Animated, Dimensions, Image, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { resolveApiAssetUrl } from '../../../utils/assets';
import { colors } from '../../../theme/colors';

const { width } = Dimensions.get('window');
// Most of a phone, but not a wall of menu on a tablet or an unfolded phone.
const DRAWER_WIDTH = Math.min(width * 0.8, 360);

interface Props {
  visible: boolean;
  sideMenuAnim: Animated.Value;
  menuBackdropOpacity: Animated.Value;
  fullName?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  unreadNotificationsCount: number;
  unreadMessagesCount: number;
  onClose: () => void;
  onOpenProfile: () => void;
  onOpenNotifications: () => void;
  onOpenMessages: () => void;
  onOpenRideHistory: () => void;
  onOpenFavoriteAddresses: () => void;
  onLogout: () => Promise<void> | void;
}

export const PassengerSideDrawer: React.FC<Props> = ({
  visible,
  sideMenuAnim,
  menuBackdropOpacity,
  fullName,
  phone,
  avatarUrl,
  unreadNotificationsCount,
  unreadMessagesCount,
  onClose,
  onOpenProfile,
  onOpenNotifications,
  onOpenMessages,
  onOpenRideHistory,
  onOpenFavoriteAddresses,
  onLogout,
}) => {
  const insets = useSafeAreaInsets();
  const avatarUri = resolveApiAssetUrl(avatarUrl);

  return (
    <>
    {visible ? (
      <Animated.View style={[styles.menuBackdrop, { opacity: menuBackdropOpacity }]}>
        <Pressable
          style={styles.flexFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Закрыть меню"
        />
      </Animated.View>
    ) : null}

    <Animated.View
      style={[styles.sideDrawer, { transform: [{ translateX: sideMenuAnim }] }]}
      // Closed, the drawer is only slid off-screen; keep screen readers out.
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    >
      <View style={[styles.drawerHeader, { paddingTop: Math.max(insets.top, 12) + 16 }]}>
        <View style={styles.avatarRow}>
          <View style={styles.avatarCircle}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>
                {((fullName || phone || 'П')
                  .trim()
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join('') || 'П')
                  .toUpperCase()}
              </Text>
            )}
          </View>
          <View style={styles.headerTextWrap}>
            <Text style={styles.drName}>{fullName || phone || 'Профиль'}</Text>
            {phone ? <Text style={styles.drPhone}>{phone}</Text> : null}
          </View>
        </View>
      </View>

      <ScrollView style={styles.drawerScroll}>
        <TouchableOpacity style={styles.drawerItem} onPress={onOpenProfile}>
          <Text style={styles.drawerText}>Личный кабинет</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.drawerItem} onPress={onOpenNotifications}>
          <View style={styles.drawerItemRow}>
            <Text style={styles.drawerText}>Уведомления</Text>
            {unreadNotificationsCount > 0 ? (
              <View style={styles.drawerBadge}>
                <Text style={styles.drawerBadgeText}>
                  {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                </Text>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.drawerItem} onPress={onOpenMessages}>
          <View style={styles.drawerItemRow}>
            <Text style={styles.drawerText}>Сообщения</Text>
            {unreadMessagesCount > 0 ? (
              <View style={styles.drawerBadge}>
                <Text style={styles.drawerBadgeText}>
                  {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                </Text>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.drawerItem} onPress={onOpenRideHistory}>
          <Text style={styles.drawerText}>История заказов</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.drawerItem} onPress={onOpenFavoriteAddresses}>
          <Text style={styles.drawerText}>Мои адреса</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.drawerItem, styles.logoutItem]} onPress={() => void onLogout()}>
          <Text style={[styles.drawerText, styles.logoutText]}>Выйти</Text>
        </TouchableOpacity>
      </ScrollView>
    </Animated.View>
  </>
  );
};

const styles = StyleSheet.create({
  flexFill: { flex: 1 },
  menuBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 900 },
  sideDrawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: DRAWER_WIDTH,
    backgroundColor: colors.bg,
    zIndex: 1000,
    borderRightWidth: 1,
    borderColor: colors.surface,
  },
  drawerHeader: { backgroundColor: colors.surface, padding: 28 },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.textMuted,
    fontSize: 20,
    fontWeight: '900',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
  },
  headerTextWrap: {
    flex: 1,
  },
  drName: { color: colors.white, fontSize: 22, fontWeight: '800' },
  drPhone: { color: colors.textTertiary, fontSize: 15, marginTop: 6 },
  drawerScroll: { padding: 20 },
  drawerItem: { paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: colors.surface },
  drawerItemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  drawerText: { color: colors.textMuted, fontSize: 17, fontWeight: '500' },
  drawerBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 8,
    backgroundColor: colors.dangerStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerBadgeText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  logoutItem: { marginTop: 20 },
  logoutText: { color: colors.dangerTextStrong },
});
