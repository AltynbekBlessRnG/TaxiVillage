import axios from 'axios';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { loadAuth, updateAuthTokens } from '../storage/authStorage';
import { apiClient, BASE_URL } from '../api/instance';

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
    await apiClient.patch(
      '/drivers/location',
      {
        lat: latestLocation.coords.latitude,
        lng: latestLocation.coords.longitude,
      },
      {
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
        },
      },
    );
  } catch (error: any) {
    if (error?.response?.status !== 401) {
      return;
    }

    try {
      const refreshResponse = await axios.post(`${BASE_URL}/auth/refresh`, {
        refreshToken: auth.refreshToken,
      });
      const { accessToken, refreshToken } = refreshResponse.data as {
        accessToken: string;
        refreshToken: string;
      };
      await updateAuthTokens({ accessToken, refreshToken });
      apiClient.defaults.headers.common.Authorization = `Bearer ${accessToken}`;

      await apiClient.patch(
        '/drivers/location',
        {
          lat: latestLocation.coords.latitude,
          lng: latestLocation.coords.longitude,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );
    } catch (refreshError) {
      console.log('Background location refresh failed', refreshError);
    }
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
