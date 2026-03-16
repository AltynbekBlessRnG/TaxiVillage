// mobile/src/utils/notifications.ts
// Мы временно всё отключили, чтобы Expo Go не ругался
export async function initializeNotifications() {
  return; 
}
export async function sendLocalNotification(title: string, body: string, data?: any) {
  return;
}
export const NOTIFICATION_TYPES = {
  DRIVER_ASSIGNED: 'DRIVER_ASSIGNED',
  DRIVER_ARRIVED: 'DRIVER_ARRIVED',
  RIDE_STARTED: 'RIDE_STARTED',
  RIDE_COMPLETED: 'RIDE_COMPLETED',
};