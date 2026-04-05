import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';

type Props = NativeStackScreenProps<RootStackParamList, 'PassengerProfile'>;

type PassengerProfileData = {
  fullName: string;
  phone: string;
};

export const PassengerProfileScreen: React.FC<Props> = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PassengerProfileData>({
    fullName: 'Пользователь',
    phone: '',
  });

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await apiClient.get('/users/me');
        setProfile({
          fullName: res.data?.passenger?.fullName || res.data?.phone || 'Пользователь',
          phone: res.data?.phone || '',
        });
      } catch {
        setProfile({
          fullName: 'Пользователь',
          phone: '',
        });
      } finally {
        setLoading(false);
      }
    };

    loadProfile().catch(() => setLoading(false));
  }, []);

  const initials = useMemo(() => {
    return (
      (profile.fullName || profile.phone || 'П')
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase() || 'П'
    );
  }, [profile.fullName, profile.phone]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#F4F4F5" />
        </TouchableOpacity>
        <Text style={styles.title}>Личный кабинет</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#F4F4F5" />
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.heroCard}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <Text style={styles.fullName}>{profile.fullName}</Text>
            <Text style={styles.phone}>{profile.phone || 'Номер не указан'}</Text>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionEyebrow}>Контакты</Text>
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="call-outline" size={18} color="#F4F4F5" />
              </View>
              <View style={styles.infoBody}>
                <Text style={styles.infoLabel}>Номер телефона</Text>
                <Text style={styles.infoValue}>{profile.phone || 'Не указан'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionEyebrow}>Оплата</Text>
            <View style={styles.paymentRow}>
              <View style={styles.cashBadge}>
                <Ionicons name="cash-outline" size={18} color="#04131A" />
              </View>
              <View style={styles.infoBody}>
                <Text style={styles.infoLabel}>Способ оплаты</Text>
                <Text style={styles.infoValue}>Наличные</Text>
                <Text style={styles.infoHint}>Смена на карту появится позже.</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 8,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#F4F4F5',
    fontSize: 22,
    fontWeight: '900',
  },
  headerSpacer: {
    width: 44,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 12,
    gap: 14,
  },
  heroCard: {
    backgroundColor: '#111113',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingVertical: 26,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarText: {
    color: '#E2E8F0',
    fontSize: 28,
    fontWeight: '900',
  },
  fullName: {
    color: '#F4F4F5',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 6,
  },
  phone: {
    color: '#A1A1AA',
    fontSize: 15,
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: '#111113',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#27272A',
    padding: 18,
  },
  sectionEyebrow: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cashBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FACC15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoBody: {
    flex: 1,
  },
  infoLabel: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  infoValue: {
    color: '#F4F4F5',
    fontSize: 18,
    fontWeight: '800',
  },
  infoHint: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },
});
