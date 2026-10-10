import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { DarkAlertModal } from '../../components/DarkAlertModal';
import { colors } from '../../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'DriverBalance'>;

type TopUpInfo = {
  balance: number;
  canGoOnline: boolean;
  title: string;
  recipient: string;
  requisites: string;
  note: string;
};

export const DriverBalanceScreen: React.FC<Props> = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [topUpInfo, setTopUpInfo] = useState<TopUpInfo | null>(null);
  const [modal, setModal] = useState({ visible: false, title: '', message: '' });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/drivers/top-up-info');
      setTopUpInfo(response.data);
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Не удалось загрузить баланс';
      setModal({
        visible: true,
        title: 'Ошибка',
        message: Array.isArray(message) ? message.join(', ') : String(message),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData().catch(() => null);
  }, [loadData]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.text} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Назад</Text>
        </TouchableOpacity>

        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Баланс водителя</Text>
          <Text style={styles.heroValue}>{Math.round(Number(topUpInfo?.balance ?? 0))} ₸</Text>
          <View
            style={[
              styles.statusPill,
              topUpInfo?.canGoOnline ? styles.statusPillReady : styles.statusPillBlocked,
            ]}
          >
            <Text
              style={[
                styles.statusPillText,
                topUpInfo?.canGoOnline ? styles.statusPillTextReady : styles.statusPillTextBlocked,
              ]}
            >
              {topUpInfo?.canGoOnline ? 'Можно выйти на линию' : 'Пополните баланс'}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{topUpInfo?.title || 'Пополнение'}</Text>
          <Text style={styles.label}>Получатель</Text>
          <Text style={styles.value}>{topUpInfo?.recipient || '-'}</Text>

          <Text style={styles.label}>Реквизиты</Text>
          <Text style={styles.value}>{topUpInfo?.requisites || '-'}</Text>

          <Text style={styles.note}>{topUpInfo?.note || ''}</Text>
        </View>
      </ScrollView>

      <DarkAlertModal
        visible={modal.visible}
        title={modal.title}
        message={modal.message}
        onPrimary={() => setModal({ visible: false, title: '', message: '' })}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginTop: 12,
    marginBottom: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  heroCard: {
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 28,
    padding: 22,
    marginBottom: 16,
  },
  heroEyebrow: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  heroValue: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '900',
    marginBottom: 12,
  },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPillReady: {
    backgroundColor: colors.successSurface,
    borderColor: colors.successBorder,
  },
  statusPillBlocked: {
    backgroundColor: colors.dangerSurface,
    borderColor: colors.dangerBorder,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '900',
  },
  statusPillTextReady: {
    color: colors.successText,
  },
  statusPillTextBlocked: {
    color: colors.dangerText,
  },
  card: {
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    padding: 18,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 14,
  },
  label: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 4,
  },
  value: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
  },
  note: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 16,
  },
});
