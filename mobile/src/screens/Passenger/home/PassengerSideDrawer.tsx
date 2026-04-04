import React from 'react';
import { Animated, Dimensions, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { width } = Dimensions.get('window');

interface Props {
  visible: boolean;
  sideMenuAnim: Animated.Value;
  menuBackdropOpacity: Animated.Value;
  fullName?: string | null;
  phone?: string | null;
  unreadNotificationsCount: number;
  unreadMessagesCount: number;
  onClose: () => void;
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
  unreadNotificationsCount,
  unreadMessagesCount,
  onClose,
  onOpenNotifications,
  onOpenMessages,
  onOpenRideHistory,
  onOpenFavoriteAddresses,
  onLogout,
}) => (
  <>
    {visible ? (
      <Animated.View style={[styles.menuBackdrop, { opacity: menuBackdropOpacity }]}>
        <Pressable style={styles.flexFill} onPress={onClose} />
      </Animated.View>
    ) : null}

    <Animated.View style={[styles.sideDrawer, { transform: [{ translateX: sideMenuAnim }] }]}>
      <View style={styles.drawerHeader}>
        <Text style={styles.drName}>{fullName || 'Загрузка...'}</Text>
        <Text style={styles.drPhone}>{phone || ''}</Text>
      </View>

      <ScrollView style={styles.drawerScroll}>
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

const styles = StyleSheet.create({
  flexFill: { flex: 1 },
  menuBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 900 },
  sideDrawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: width * 0.8,
    backgroundColor: '#09090B',
    zIndex: 1000,
    borderRightWidth: 1,
    borderColor: '#18181B',
  },
  drawerHeader: { backgroundColor: '#18181B', padding: 28, paddingTop: 65 },
  drName: { color: '#fff', fontSize: 22, fontWeight: '800' },
  drPhone: { color: '#71717A', fontSize: 15, marginTop: 6 },
  drawerScroll: { padding: 20 },
  drawerItem: { paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#18181B' },
  drawerItemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  drawerText: { color: '#E4E4E7', fontSize: 17, fontWeight: '500' },
  drawerBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 8,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  logoutItem: { marginTop: 20 },
  logoutText: { color: '#EF4444' },
});
