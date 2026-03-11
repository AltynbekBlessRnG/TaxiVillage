import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { apiClient } from '../../api/client';
import { createChatSocket } from '../../api/socket';
import { loadAuth } from '../../storage/authStorage';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatScreen'>;

interface Message {
  id: string;
  content: string;
  senderId: string;
  senderType: 'PASSENGER' | 'DRIVER';
  receiverId: string;
  receiverType: 'PASSENGER' | 'DRIVER';
  createdAt: string;
  sender?: {
    user?: {
      fullName?: string;
    };
  };
  receiver?: {
    user?: {
      fullName?: string;
    };
  };
}

export const ChatScreen: React.FC<Props> = ({ route, navigation }) => {
  const { rideId } = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [ride, setRide] = useState<any>(null);
  const flatListRef = useRef<FlatList>(null);
  const socketRef = useRef<any>(null);

  const currentUserId = useRef<string>('');

  useEffect(() => {
    const initChat = async () => {
      try {
        const auth = await loadAuth();
        if (!auth?.token) return;

        currentUserId.current = auth.userId;

        // Load ride data to get driver ID
        const rideResponse = await apiClient.get(`/rides/${rideId}`);
        setRide(rideResponse.data);
        
        const socket = createChatSocket(auth.token);
        socketRef.current = socket;

        // Join ride room
        socket.emit('join:ride', { rideId });

        // Listen for messages
        socket.on('message:sent', (message: Message) => {
          setMessages(prev => [...prev, message]);
        });

        socket.on('error', (error: any) => {
          console.error('Chat error:', error);
          Alert.alert('Ошибка', error.message || 'Произошла ошибка');
        });

        // Load initial messages
        const response = await apiClient.get(`/chat/messages/${rideId}`);
        setMessages(response.data);

        // Mark messages as read
        await apiClient.post(`/chat/mark-read/${rideId}`);

      } catch (error) {
        console.error('Failed to initialize chat:', error);
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
      if (!auth?.token) return;

      // Get driver ID from ride data
      const driverId = ride?.driver?.id;
      if (!driverId) {
        Alert.alert('Ошибка', 'Водитель не найден');
        return;
      }

      const response = await apiClient.post(`/chat/send/${rideId}`, {
        content: newMessage.trim(),
        receiverId: driverId,
        receiverType: 'DRIVER',
      });

      setNewMessage('');
      
      // Message will be received via WebSocket
      if (response.data) {
        console.log('Message sent:', response.data);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      Alert.alert('Ошибка', 'Не удалось отправить сообщение');
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwnMessage = item.senderId === currentUserId.current;
    const senderName = item.sender?.user?.fullName || 'Водитель';
    const receiverName = item.receiver?.user?.fullName || 'Пассажир';

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
        <View style={styles.messageContent}>
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
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Чат с водителем</Text>
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
          multiline
          maxLength={500}
          editable={!loading}
        />
        <TouchableOpacity
          style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={!newMessage.trim() || loading}
        >
          <Text style={styles.sendButtonText}>
            {loading ? 'Отправка...' : 'Отправить'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#334155',
  },
  backButtonText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    textAlign: 'center',
  },
  messagesList: {
    flex: 1,
  },
  messagesContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  messageContainer: {
    marginVertical: 8,
    maxWidth: '80%',
    alignSelf: 'flex-start',
  },
  ownMessage: {
    alignItems: 'flex-end',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  senderName: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  timestamp: {
    fontSize: 10,
    color: '#64748B',
  },
  messageContent: {
    backgroundColor: '#1E293B',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    maxWidth: '100%',
  },
  messageText: {
    fontSize: 14,
    color: '#F8FAFC',
    lineHeight: 18,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#1E293B',
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#0F172A',
    color: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginLeft: 12,
  },
  sendButtonDisabled: {
    backgroundColor: '#475569',
  },
  sendButtonText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '600',
  },
});
