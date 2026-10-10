import React from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';

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
}) => {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
    <View style={styles.modalRoot}>
      <View style={styles.overlayRoot} pointerEvents="box-none">
        <Animated.View style={[styles.menuBackdrop, { opacity: menuBackdropOpacity }]} />
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
      </View>

      <Animated.View
        style={[
          styles.sideDrawer,
          { width: Math.min(width * 0.84, 320), transform: [{ translateX: sideMenuAnim }] },
        ]}
      >
        <View style={[styles.drawerHeader, { paddingTop: insets.top + 52 }]}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Закрыть меню"
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
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
          <Text style={styles.drName}>{name || 'Заведение'}</Text>
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
    </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    elevation: 999,
  },
  menuBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.62)', zIndex: 900 },
  sideDrawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.bg,
    zIndex: 1000,
    elevation: 1000,
    borderRightWidth: 1,
    borderColor: colors.border,
  },
  drawerHeader: {
    backgroundColor: colors.surfaceSunken,
    padding: 28,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    position: 'absolute',
    top: 22,
    right: 22,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.border,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    zIndex: 2,
  },
  closeButtonText: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '900',
  },
  avatarCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.foodSurface,
    borderWidth: 1,
    borderColor: colors.foodBorder,
    marginBottom: 14,
  },
  avatarText: {
    color: colors.foodTextSoft,
    fontSize: 22,
    fontWeight: '900',
  },
  drName: { color: colors.text, fontSize: 22, fontWeight: '900' },
  drPhone: { color: colors.textSecondary, fontSize: 14, marginTop: 6 },
  statusPill: {
    alignSelf: 'flex-start',
    marginTop: 14,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  statusPillOpen: {
    backgroundColor: colors.successSurface,
    borderColor: colors.successBorder,
  },
  statusPillClosed: {
    backgroundColor: colors.dangerSurface,
    borderColor: colors.dangerBorder,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  statusPillTextOpen: { color: colors.successText },
  statusPillTextClosed: { color: colors.dangerText },
  drawerBody: { padding: 20 },
  drawerItem: {
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
  },
  drawerText: { color: colors.textMuted, fontSize: 17, fontWeight: '600' },
  logoutItem: { marginTop: 16 },
  logoutText: { color: colors.dangerText },
});
