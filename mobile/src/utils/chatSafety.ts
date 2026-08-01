import { Alert } from 'react-native';
import { apiClient } from '../api/client';

type ChatSafetyParams = {
  messageId: string;
  targetUserId: string;
  onBlocked: (userId: string) => void;
};

async function reportMessage(messageId: string) {
  await apiClient.post('/moderation/report', {
    messageId,
    reason: 'Нежелательное или оскорбительное сообщение',
    context: 'Жалоба отправлена пользователем из меню сообщения в мобильном приложении.',
  });
  Alert.alert('Жалоба отправлена', 'Мы сохранили сообщение и проверим обращение.');
}

async function blockUser(targetUserId: string, onBlocked: (userId: string) => void) {
  await apiClient.post('/moderation/block', { blockedUserId: targetUserId });
  onBlocked(targetUserId);
  Alert.alert(
    'Пользователь заблокирован',
    'Его сообщения скрыты. При необходимости напишите в поддержку из профиля.',
  );
}

export function showChatSafetyActions({ messageId, targetUserId, onBlocked }: ChatSafetyParams) {
  Alert.alert('Безопасность чата', 'Выберите действие для этого сообщения.', [
    { text: 'Отмена', style: 'cancel' },
    {
      text: 'Пожаловаться',
      onPress: () => {
        void reportMessage(messageId).catch(() => {
          Alert.alert('Ошибка', 'Не удалось отправить жалобу. Попробуйте ещё раз.');
        });
      },
    },
    {
      text: 'Заблокировать',
      style: 'destructive',
      onPress: () => {
        Alert.alert('Заблокировать пользователя?', 'Его сообщения будут скрыты в приложении.', [
          { text: 'Отмена', style: 'cancel' },
          {
            text: 'Заблокировать',
            style: 'destructive',
            onPress: () => {
              void blockUser(targetUserId, onBlocked).catch(() => {
                Alert.alert('Ошибка', 'Не удалось заблокировать пользователя.');
              });
            },
          },
        ]);
      },
    },
  ]);
}
