import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useMessagesSummary } from '../hooks/useMessagesSummary';
import { colors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Messages'>;
type MessagesSummary = ReturnType<typeof useMessagesSummary>;
type Thread =
  | (MessagesSummary['rideThreads'][number] & { kind: 'ride' })
  | (MessagesSummary['intercityThreads'][number] & { kind: 'intercity' });

export const MessagesScreen: React.FC<Props> = ({ navigation }) => {
  const { rideThreads, intercityThreads, loading, refresh } = useMessagesSummary({ autoRefresh: false });

  useFocusEffect(
    useCallback(() => {
      refresh().catch(() => {});
    }, [refresh]),
  );

  const sections: Array<{ title: string; data: Thread[] }> = [
    {
      title: 'Такси',
      data: rideThreads.map((item) => ({ ...item, kind: 'ride' as const })),
    },
    {
      title: 'Межгород',
      data: intercityThreads.map((item) => ({ ...item, kind: 'intercity' as const })),
    },
  ].filter((section) => section.data.length > 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Сообщения</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading && sections.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.text} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) =>
            item.kind === 'ride' ? `ride:${item.rideId}` : `intercity:${item.threadType}:${item.threadId}`
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.item}
              activeOpacity={0.85}
              onPress={() => {
                if (item.kind === 'ride') {
                  navigation.navigate('ChatScreen', { rideId: item.rideId });
                  return;
                }

                navigation.navigate('IntercityChat', {
                  threadType: item.threadType,
                  threadId: item.threadId,
                  title: item.title,
                });
              }}
            >
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                {item.unreadCount > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
              <Text style={styles.itemMessage} numberOfLines={2}>
                {item.lastMessage}
              </Text>
              <Text style={styles.itemDate}>
                {new Date(item.lastMessageAt).toLocaleString('ru-RU', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </TouchableOpacity>
          )}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionTitle}>{section.title}</Text>
          )}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>Пока нет диалогов</Text>
              <Text style={styles.emptyText}>Как только появятся сообщения по поездкам или межгороду, они будут здесь.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 18,
  },
  backButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backButtonText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  headerSpacer: { width: 72 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 8,
    marginLeft: 4,
  },
  item: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  itemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 },
  itemTitle: { color: colors.text, fontSize: 16, fontWeight: '800', flex: 1 },
  itemSubtitle: { color: colors.textSecondary, fontSize: 13, marginBottom: 8 },
  itemMessage: { color: colors.textMuted, fontSize: 14, lineHeight: 19, marginBottom: 8 },
  itemDate: { color: colors.textTertiary, fontSize: 11, fontWeight: '500' },
  badge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 8,
    backgroundColor: colors.dangerStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  emptyBox: { marginTop: 48, alignItems: 'center', paddingHorizontal: 32 },
  emptyTitle: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: 8 },
  emptyText: { color: colors.textTertiary, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
