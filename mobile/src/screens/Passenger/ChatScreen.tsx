import React, { useEffect, useRef, useState } from 'react';
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
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { createChatSocket, Message as ChatSocketMessage } from '../../api/chatSocket';
import { loadAuth } from '../../storage/authStorage';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatScreen'>;

interface Message extends ChatSocketMessage {
  senderName?: string;
  receiverName?: string;
}

export const ChatScreen: React.FC<Props> = ({ route, navigation }) => {
  const { rideId } = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const socketRef = useRef<any>(null);
  const currentUserId = useRef<string>('');

  useEffect(() => {
    const initChat = async () => {
      try {
        const auth = await loadAuth();
        if (!auth?.accessToken) return;

        currentUserId.current = auth.userId || '';
        const socket = createChatSocket();
        socketRef.current = socket;
        await socket.connect(rideId);

        socket.onMessage((message: Message) => {
          setMessages((prev) => [...prev, message]);
        });

        socket.onError((error: any) => {
          Alert.alert('Ошибка', error.message || 'Произошла ошибка');
        });

        const response = await apiClient.get<Message[]>(`/chat/messages/${rideId}`);
        setMessages(response.data);
        await apiClient.post(`/chat/mark-read/${rideId}`);
      } catch {
        Alert.alert('Ошибка', 'Не удалось загрузить чат');
      }
    };

    initChat();
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [rideId]);

  const sendMessage = async () => {
    if (!newMessage.trim() || loading) return;

    setLoading(true);
    try {
      const auth = await loadAuth();
      if (!auth?.accessToken) return;

      const receiverType = auth.role === 'DRIVER' ? 'PASSENGER' : 'DRIVER';
      await apiClient.post(`/chat/send/${rideId}`, {
        content: newMessage.trim(),
        receiverType,
      });
      setNewMessage('');
    } catch {
      Alert.alert('Ошибка', 'Не удалось отправить сообщение');
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwnMessage = item.senderId === currentUserId.current;
    const senderName = item.senderName || 'Водитель';
    const receiverName = item.receiverName || 'Пассажир';

    return (
      <View style={[styles.messageContainer, isOwnMessage && styles.ownMessage]}>
        <View style={styles.messageHeader}>
          <Text style={styles.senderName}>{isOwnMessage ? `Вы → ${receiverName}` : `${senderName} → Вам`}</Text>
          <Text style={styles.timestamp}>
            {new Date(item.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        <View style={[styles.messageContent, isOwnMessage && styles.ownBubble]}>
          <Text style={styles.messageText}>{item.content}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Чат</Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContainer}
        inverted
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
        <TouchableOpacity style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]} onPress={sendMessage} disabled={!newMessage.trim() || loading}>
          <Text style={styles.sendButtonText}>{loading ? '...' : 'Отправить'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090B' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  backButton: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, backgroundColor: '#18181B', borderWidth: 1, borderColor: '#27272A' },
  backButtonText: { color: '#A1A1AA', fontSize: 14, fontWeight: '600' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#F4F4F5' },
  headerSpacer: { width: 72 },
  messagesList: { flex: 1 },
  messagesContainer: { paddingHorizontal: 20, paddingBottom: 20 },
  messageContainer: { marginVertical: 8, maxWidth: '84%', alignSelf: 'flex-start' },
  ownMessage: { alignSelf: 'flex-end' },
  messageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  senderName: { fontSize: 12, color: '#71717A', fontWeight: '500' },
  timestamp: { fontSize: 10, color: '#71717A' },
  messageContent: { backgroundColor: '#18181B', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#27272A', maxWidth: '100%' },
  ownBubble: { backgroundColor: '#27272A' },
  messageText: { fontSize: 14, color: '#F4F4F5', lineHeight: 18 },
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#09090B', borderTopWidth: 1, borderTopColor: '#18181B' },
  textInput: { flex: 1, backgroundColor: '#18181B', color: '#F4F4F5', borderRadius: 16, borderWidth: 1, borderColor: '#27272A', paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, maxHeight: 100 },
  sendButton: { backgroundColor: '#F4F4F5', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 18, marginLeft: 12 },
  sendButtonDisabled: { opacity: 0.55 },
  sendButtonText: { color: '#000000', fontSize: 15, fontWeight: '800' },
});
