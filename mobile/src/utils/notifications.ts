export async function registerPushToken(): Promise<null> {
  return null;
}

export async function initializeNotifications(): Promise<void> {
  return;
}

export async function sendLocalNotification(
  _title?: string,
  _body?: string,
  _data?: Record<string, unknown>,
): Promise<void> {
  return;
}

export const NOTIFICATION_TYPES = {
  DRIVER_ASSIGNED: 'DRIVER_ASSIGNED',
  DRIVER_ARRIVED: 'DRIVER_ARRIVED',
  RIDE_STARTED: 'RIDE_STARTED',
  RIDE_COMPLETED: 'RIDE_COMPLETED',
} as const;
