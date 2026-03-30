import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { apiClient } from '../../api/client';
import {
  createIntercityChatSocket,
  IntercityMessage,
} from '../../api/intercityChatSocket';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { loadAuth } from '../../storage/authStorage';

type Props = NativeStackScreenProps<RootStackParamList, 'IntercityChat'>;

const mergeMessages = (current: IntercityMessage[], incoming: IntercityMessage[]) => {
  const merged = [...current];

  for (const message of incoming) {
    if (!merged.some((existing) => existing.id === message.id)) {
      merged.push(message);
    }
  }

  return merged.sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );
};

export const IntercityChatScreen: React.FC<Props> = ({ navigation, route }) => {
  const { threadType, threadId, title } = route.params;
  const [messages, setMessages] = useState<IntercityMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const socketRef = useRef<any>(null);
  const currentUserId = useRef<string>('');

  const markRead = useCallback(async () => {
    try {
      await apiClient.post('/intercity-chat/mark-read', { threadType, threadId });
    } catch {
      return;
    }
  }, [threadId, threadType]);

  const loadMessages = useCallback(
    async (cursor?: string | null) => {
      const response = await apiClient.get<{
        items: IntercityMessage[];
        nextCursor: string | null;
        hasMore: boolean;
      }>('/intercity-chat/messages', {
        params: {
          threadType,
          threadId,
          cursor: cursor || undefined,
          limit: 30,
        },
      });

      setMessages((prev) =>
        cursor ? mergeMessages(response.data.items, prev) : mergeMessages([], response.data.items),
      );
      setNextCursor(response.data.nextCursor);
      setHasMore(response.data.hasMore);
    },
    [threadId, threadType],
  );

  const scrollToBottom = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated });
    });
  }, []);

  useEffect(() => {
    const initChat = async () => {
      try {
        const auth = await loadAuth();
        if (!auth?.accessToken) {
          return;
        }

        currentUserId.current = auth.userId || '';
        const socket = createIntercityChatSocket();
        socketRef.current = socket;
        await socket.connect(threadType, threadId);

        socket.onMessage((message: IntercityMessage) => {
          setMessages((prev) => mergeMessages(prev, [message]));
          scrollToBottom();
          void markRead();
        });

        socket.onError((error: any) => {
          Alert.alert('Ошибка', error.message || 'Произошла ошибка');
        });

        await loadMessages();
        scrollToBottom(false);
        await markRead();
      } catch {
        Alert.alert('Ошибка', 'Не удалось загрузить чат межгорода');
      }
    };

    initChat();
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [loadMessages, markRead, scrollToBottom, threadId, threadType]);

  const loadOlderMessages = useCallback(async () => {
    if (!hasMore || !nextCursor || loadingMore) {
      return;
    }

    setLoadingMore(true);
    try {
      await loadMessages(nextCursor);
    } catch {
      Alert.alert('Ошибка', 'Не удалось загрузить предыдущие сообщения');
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadMessages, loadingMore, nextCursor]);

  const sendMessage = async () => {
    if (!newMessage.trim() || loading) {
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post<IntercityMessage>('/intercity-chat/send', {
        threadType,
        threadId,
        content: newMessage.trim(),
      });
      if (response.data) {
        setMessages((prev) => mergeMessages(prev, [response.data]));
      }
      setNewMessage('');
      scrollToBottom();
      await markRead();
    } catch {
      Alert.alert('Ошибка', 'Не удалось отправить сообщение');
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: IntercityMessage }) => {
    const isOwnMessage = item.senderId === currentUserId.current;
    const senderName = item.senderName || 'Водитель';
    const receiverName = item.receiverName || 'Пассажир';

    return (
      <View style={[styles.messageContainer, isOwnMessage && styles.ownMessage]}>
        <View style={styles.messageHeader}>
          <Text style={styles.senderName}>
            {isOwnMessage ? `Вы → ${receiverName}` : `${senderName} → Вам`}
          </Text>
          <Text style={styles.timestamp}>
            {new Date(item.createdAt).toLocaleTimeString('ru-RU', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
        <View style={[styles.messageContent, isOwnMessage && styles.ownBubble]}>
          <Text style={styles.messageText}>{item.content}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title || 'Чат межгорода'}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContainer}
        onContentSizeChange={() => scrollToBottom(false)}
        ListHeaderComponent={
          hasMore ? (
            <TouchableOpacity
              style={[styles.loadMoreButton, loadingMore && styles.loadMoreButtonDisabled]}
              onPress={loadOlderMessages}
              disabled={loadingMore}
            >
              <Text style={styles.loadMoreButtonText}>
                {loadingMore ? 'Загружаем...' : 'Показать предыдущие'}
              </Text>
            </TouchableOpacity>
          ) : null
        }
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Введите сообщение..."
          placeholderTextColor="#71717A"
          multiline
          maxLength={500}
          editable={!loading}
        />
        <TouchableOpacity
          style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={!newMessage.trim() || loading}
        >
          <Text style={styles.sendButtonText}>{loading ? '...' : 'Отправить'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
    paddingBottom: 16,
  },
  backButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  backButtonText: { color: '#A1A1AA', fontSize: 14, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#F4F4F5', flex: 1, textAlign: 'center' },
  headerSpacer: { width: 72 },
  messagesList: { flex: 1 },
  messagesContainer: { paddingHorizontal: 20, paddingBottom: 20 },
  loadMoreButton: {
    alignSelf: 'center',
    backgroundColor: '#18181B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    marginTop: 4,
  },
  loadMoreButtonDisabled: { opacity: 0.6 },
  loadMoreButtonText: { color: '#A1A1AA', fontSize: 13, fontWeight: '700' },
  messageContainer: { marginVertical: 8, maxWidth: '84%', alignSelf: 'flex-start' },
  ownMessage: { alignSelf: 'flex-end' },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  senderName: { fontSize: 12, color: '#71717A', fontWeight: '500' },
  timestamp: { fontSize: 10, color: '#71717A' },
  messageContent: {
    backgroundColor: '#18181B',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    maxWidth: '100%',
  },
  ownBubble: { backgroundColor: '#0C4A6E', borderColor: '#0369A1' },
  messageText: { fontSize: 14, color: '#F4F4F5', lineHeight: 18 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#09090B',
    borderTopWidth: 1,
    borderTopColor: '#18181B',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#18181B',
    color: '#F4F4F5',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#38BDF8',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginLeft: 12,
  },
  sendButtonDisabled: { opacity: 0.55 },
  sendButtonText: { color: '#082F49', fontSize: 15, fontWeight: '800' },
});
