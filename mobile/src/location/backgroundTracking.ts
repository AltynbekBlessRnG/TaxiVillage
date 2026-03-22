import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { loadAuth } from '../storage/authStorage';
import { sendDriverLocationUpdate } from './driverLiveTracking';

export const LOCATION_TRACKING_TASK = 'LOCATION_TRACKING_TASK';

TaskManager.defineTask(LOCATION_TRACKING_TASK, async ({ data, error }) => {
  if (error) {
    console.log('Background location task error', error);
    return;
  }

  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
  const latestLocation = locations?.[locations.length - 1];

  if (!latestLocation) {
    return;
  }

  const auth = await loadAuth();
  if (!auth) {
    return;
  }

  try {
    await sendDriverLocationUpdate(
      {
        lat: latestLocation.coords.latitude,
        lng: latestLocation.coords.longitude,
      },
      { force: true },
    );
  } catch (error) {
    console.log('Background location update failed', error);
  }
});

export async function startDriverBackgroundTracking() {
  const isStarted = await Location.hasStartedLocationUpdatesAsync(
    LOCATION_TRACKING_TASK,
  );
  if (isStarted) {
    return;
  }

  await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 10000,
    distanceInterval: 25,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'TaxiVillage',
      notificationBody: 'Фоновое отслеживание местоположения включено',
    },
  });
}

export async function stopDriverBackgroundTracking() {
  const isStarted = await Location.hasStartedLocationUpdatesAsync(
    LOCATION_TRACKING_TASK,
  );
  if (!isStarted) {
    return;
  }

  await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK);
}
