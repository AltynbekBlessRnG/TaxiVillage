import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { apiClient } from '../api/client';
import { loadAuth } from '../storage/authStorage';
import { saveNotificationToInbox } from '../storage/notificationsInbox';
import { navigateRoot } from '../navigation/rootNavigation';

const DEFAULT_CHANNEL_ID = 'taxivillage-default';

let initialized = false;
let responseSubscription: Notifications.EventSubscription | null = null;
let receivedSubscription: Notifications.EventSubscription | null = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function getProjectId() {
  return (
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
    (Constants.expoConfig?.extra as any)?.eas?.projectId ||
    (Constants as any).easConfig?.projectId ||
    null
  );
}

async function persistNotificationEvent(
  notification:
    | Notifications.Notification
    | Notifications.NotificationResponse['notification'],
  source: 'push' | 'local',
) {
  const id = notification.request.identifier;
  const title = notification.request.content.title || 'TaxiVillage';
  const body = notification.request.content.body || '';
  const data = (notification.request.content.data || {}) as Record<string, unknown>;

  await saveNotificationToInbox({
    id,
    title,
    body,
    data,
    source,
  });
}

function openNotificationTarget(data: Record<string, unknown>) {
  const type = typeof data.type === 'string' ? data.type : null;
  const rideId = typeof data.rideId === 'string' ? data.rideId : null;
  const courierOrderId = typeof data.courierOrderId === 'string' ? data.courierOrderId : null;
  const orderId = typeof data.orderId === 'string' ? data.orderId : null;
  const threadType =
    data.threadType === 'ORDER' || data.threadType === 'BOOKING' || data.threadType === 'TRIP'
      ? data.threadType
      : null;
  const threadId = typeof data.threadId === 'string' ? data.threadId : null;

  if (type === 'CHAT_MESSAGE' && rideId) {
    return navigateRoot('ChatScreen', { rideId });
  }

  if (type === 'INTERCITY_CHAT_MESSAGE' && threadType && threadId) {
    return navigateRoot('IntercityChat', { threadType, threadId });
  }

  if (type === 'INTERCITY_TRIP_INVITE' && orderId) {
    return navigateRoot('IntercityOrderStatus', { orderId });
  }

  if (type === 'FOOD_ORDER_STATUS' && orderId) {
    return navigateRoot('FoodOrderStatus', { orderId });
  }

  if (type === 'FOOD_ORDER_CREATED') {
    return navigateRoot('MerchantOrders', undefined);
  }

  if (courierOrderId || rideId) {
    return navigateRoot('PassengerHome', {});
  }

  return false;
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
    name: 'TaxiVillage',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#38BDF8',
  });
}

export async function registerPushToken(): Promise<string | null> {
  const auth = await loadAuth();
  if (!auth?.accessToken) {
    return null;
  }

  await ensureAndroidChannel();

  const currentPermissions = await Notifications.getPermissionsAsync();
  let finalStatus = currentPermissions.status;

  if (finalStatus !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  const projectId = getProjectId();
  if (!projectId) {
    console.warn('Push notifications skipped: missing Expo projectId');
    return null;
  }

  const expoPushToken = await Notifications.getExpoPushTokenAsync({ projectId });
  const token = expoPushToken.data;

  if (!token) {
    return null;
  }

  await apiClient.post('/users/push-token', {
    pushToken: token,
  });

  return token;
}

export async function initializeNotifications(): Promise<void> {
  if (initialized) {
    return;
  }
  initialized = true;

  await ensureAndroidChannel();

  receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
    void persistNotificationEvent(notification, 'push');
  });

  responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    void persistNotificationEvent(response.notification, 'push');
    const data = (response.notification.request.content.data || {}) as Record<string, unknown>;
    openNotificationTarget(data);
  });
}

export async function sendLocalNotification(
  title = 'TaxiVillage',
  body = '',
  data: Record<string, unknown> = {},
): Promise<void> {
  await ensureAndroidChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger: null,
  });
}

export const NOTIFICATION_TYPES = {
  DRIVER_ASSIGNED: 'DRIVER_ASSIGNED',
  DRIVER_ARRIVED: 'DRIVER_ARRIVED',
  RIDE_STARTED: 'RIDE_STARTED',
  RIDE_COMPLETED: 'RIDE_COMPLETED',
} as const;
