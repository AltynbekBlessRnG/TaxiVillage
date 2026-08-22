import { apiClient } from '../api/client';
import { showAlert } from '../components/AppAlert';

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
  showAlert('Жалоба отправлена', 'Мы сохранили сообщение и проверим обращение.');
}

async function blockUser(targetUserId: string, onBlocked: (userId: string) => void) {
  await apiClient.post('/moderation/block', { blockedUserId: targetUserId });
  onBlocked(targetUserId);
  showAlert(
    'Пользователь заблокирован',
    'Его сообщения скрыты. При необходимости напишите в поддержку из профиля.',
  );
}

export function showChatSafetyActions({ messageId, targetUserId, onBlocked }: ChatSafetyParams) {
  showAlert('Безопасность чата', 'Выберите действие для этого сообщения.', [
    { text: 'Отмена', style: 'cancel' },
    {
      text: 'Пожаловаться',
      onPress: () => {
        void reportMessage(messageId).catch(() => {
          showAlert('Ошибка', 'Не удалось отправить жалобу. Попробуйте ещё раз.');
        });
      },
    },
    {
      text: 'Заблокировать',
      style: 'destructive',
      onPress: () => {
        showAlert('Заблокировать пользователя?', 'Его сообщения будут скрыты в приложении.', [
          { text: 'Отмена', style: 'cancel' },
          {
            text: 'Заблокировать',
            style: 'destructive',
            onPress: () => {
              void blockUser(targetUserId, onBlocked).catch(() => {
                showAlert('Ошибка', 'Не удалось заблокировать пользователя.');
              });
            },
          },
        ]);
      },
    },
  ]);
}
