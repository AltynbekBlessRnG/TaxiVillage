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
  Modal,
  StatusBar,
} from 'react-native';
import { MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { createChatSocket, Message } from '../../api/chatSocket';
import { apiClient } from '../../api/client';

interface ChatScreenProps {
  visible: boolean;
  onClose: () => void;
  rideId: string;
  currentUserId: string;
  userType: 'PASSENGER' | 'DRIVER';
  receiverName: string;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({
  visible,
  onClose,
  rideId,
  currentUserId,
  userType,
  receiverName,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const chatSocketRef = useRef<any>(null);

  useEffect(() => {
    if (visible && rideId) {
      initializeChat();
    }
    return () => {
      if (chatSocketRef.current) {
        chatSocketRef.current.disconnect();
      }
    };
  }, [visible, rideId]);

  const initializeChat = async () => {
    try {
      setLoading(true);
      
      // Load existing messages
      const response = await apiClient.get(`/chat/messages/${rideId}`);
      setMessages(response.data || []);

      // Connect to chat socket
      const chatSocket = createChatSocket();
      await chatSocket.connect(rideId);
      
      chatSocket.onMessage((newMessage: Message) => {
        setMessages(prev => [...prev, newMessage]);
        scrollToBottom();
      });

      chatSocket.onError((error: any) => {
        console.error('Chat socket error:', error);
      });

      chatSocketRef.current = chatSocket;
    } catch (error) {
      console.error('Failed to initialize chat:', error);
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const sendMessage = () => {
    if (!inputText.trim() || !chatSocketRef.current) return;

    const receiverType = userType === 'PASSENGER' ? 'DRIVER' : 'PASSENGER';
    
    chatSocketRef.current.sendMessage(inputText.trim(), receiverType);
    setInputText('');
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMyMessage = item.senderId === currentUserId;
    
    return (
      <View style={[
        styles.messageContainer,
        isMyMessage ? styles.myMessage : styles.theirMessage
      ]}>
        <View style={[
          styles.messageBubble,
          isMyMessage ? styles.myBubble : styles.theirBubble
        ]}>
          <Text style={[
            styles.messageText,
            isMyMessage ? styles.myText : styles.theirText
          ]}>
            {item.content}
          </Text>
          <Text style={[
            styles.messageTime,
            isMyMessage ? styles.myTime : styles.theirTime
          ]}>
            {new Date(item.createdAt).toLocaleTimeString('ru-RU', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>Чат с {receiverName}</Text>
            <Text style={styles.headerSubtitle}>
              {userType === 'PASSENGER' ? 'Водитель' : 'Пассажир'}
            </Text>
          </View>
        </View>

        {/* Messages */}
        <KeyboardAvoidingView
          style={styles.messagesContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContent}
            onLayout={scrollToBottom}
          />
        </KeyboardAvoidingView>

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Введите сообщение..."
            placeholderTextColor="#94A3B8"
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              inputText.trim() ? styles.sendButtonActive : styles.sendButtonInactive
            ]}
            onPress={sendMessage}
            disabled={!inputText.trim()}
          >
            <FontAwesome
              name="send"
              size={18}
              color={inputText.trim() ? '#fff' : '#64748B'}
            />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
    backgroundColor: '#1E293B',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 50,
  },
  backButton: {
    marginRight: 16,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 2,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  messageContainer: {
    marginBottom: 12,
  },
  myMessage: {
    alignItems: 'flex-end',
  },
  theirMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  myBubble: {
    backgroundColor: '#3B82F6',
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    backgroundColor: '#334155',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  myText: {
    color: '#fff',
  },
  theirText: {
    color: '#E2E8F0',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  myTime: {
    color: '#93C5FD',
    textAlign: 'right',
  },
  theirTime: {
    color: '#94A3B8',
    textAlign: 'left',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#0F172A',
    color: '#fff',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 12,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonActive: {
    backgroundColor: '#3B82F6',
  },
  sendButtonInactive: {
    backgroundColor: '#374151',
  },
});
