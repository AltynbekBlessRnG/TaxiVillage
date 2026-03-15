import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function schedulePushNotification(
  title: string,
  body: string,
  data?: any,
  trigger?: Notifications.NotificationTriggerInput
) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data || {},
      sound: 'default',
    },
    trigger: trigger || null, // null means show immediately
  });
}

export async function sendLocalNotification(title: string, body: string, data?: any) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data || {},
      sound: 'default',
    },
    trigger: null,
  });
}

export async function requestNotificationPermissions() {
  if (Platform.OS === 'ios') {
    await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowAnnouncements: true,
      },
    });
  } else {
    await Notifications.requestPermissionsAsync();
  }
}

export async function getNotificationPermissions() {
  return await Notifications.getPermissionsAsync();
}

// Initialize notifications
export async function initializeNotifications() {
  await requestNotificationPermissions();
  
  // Handle notification responses when user taps on notification
  Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data;
    
    // Handle navigation based on notification type
    if (data.type === 'DRIVER_ASSIGNED') {
      // Navigate to ride status screen
      // This would be handled by the app's navigation system
      console.log('Driver assigned notification tapped:', data);
    } else if (data.type === 'DRIVER_ARRIVED') {
      console.log('Driver arrived notification tapped:', data);
    }
  });
}

export const NOTIFICATION_TYPES = {
  DRIVER_ASSIGNED: 'DRIVER_ASSIGNED',
  DRIVER_ARRIVED: 'DRIVER_ARRIVED',
  RIDE_STARTED: 'RIDE_STARTED',
  RIDE_COMPLETED: 'RIDE_COMPLETED',
} as const;
