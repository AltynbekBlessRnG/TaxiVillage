import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useMessagesSummary } from '../hooks/useMessagesSummary';

type Props = NativeStackScreenProps<RootStackParamList, 'Messages'>;

export const MessagesScreen: React.FC<Props> = ({ navigation }) => {
  const { rideThreads, intercityThreads, loading, refresh } = useMessagesSummary({ autoRefresh: false });

  useFocusEffect(
    useCallback(() => {
      refresh().catch(() => {});
    }, [refresh]),
  );

  const sections = [
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
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Сообщения</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading && sections.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#F4F4F5" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          {sections.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>Пока нет диалогов</Text>
              <Text style={styles.emptyText}>Как только появятся сообщения по поездкам или межгороду, они будут здесь.</Text>
            </View>
          ) : (
            sections.map((section) => (
              <View key={section.title}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                {section.data.map((item) => (
                  <TouchableOpacity
                    key={item.kind === 'ride' ? `ride:${item.rideId}` : `intercity:${item.threadType}:${item.threadId}`}
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
                ))}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090B' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 18,
  },
  backButton: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backButtonText: { color: '#A1A1AA', fontSize: 14, fontWeight: '600' },
  title: { color: '#F4F4F5', fontSize: 22, fontWeight: '800' },
  headerSpacer: { width: 72 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  sectionTitle: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 8,
    marginLeft: 4,
  },
  item: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  itemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 },
  itemTitle: { color: '#F4F4F5', fontSize: 16, fontWeight: '800', flex: 1 },
  itemSubtitle: { color: '#A1A1AA', fontSize: 13, marginBottom: 8 },
  itemMessage: { color: '#E4E4E7', fontSize: 14, lineHeight: 19, marginBottom: 8 },
  itemDate: { color: '#71717A', fontSize: 11, fontWeight: '500' },
  badge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 8,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  emptyBox: { marginTop: 48, alignItems: 'center', paddingHorizontal: 32 },
  emptyTitle: { color: '#F4F4F5', fontSize: 20, fontWeight: '800', marginBottom: 8 },
  emptyText: { color: '#71717A', fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
