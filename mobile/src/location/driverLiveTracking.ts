import { apiClient } from '../api/instance';
import { distanceMeters } from '../utils/map';

const MIN_UPDATE_INTERVAL_MS = 5000;
const MIN_DISTANCE_METERS = 30;

let lastSentAt = 0;
let lastSentLocation: { lat: number; lng: number } | null = null;

export async function sendDriverLocationUpdate(
  nextLocation: { lat: number; lng: number },
  options?: { force?: boolean },
) {
  const now = Date.now();
  const force = options?.force ?? false;
  const timeSinceLastUpdate = now - lastSentAt;
  const movedDistance = lastSentLocation ? distanceMeters(lastSentLocation, nextLocation) : Number.POSITIVE_INFINITY;

  if (!force) {
    if (timeSinceLastUpdate < MIN_UPDATE_INTERVAL_MS) {
      return;
    }

    if (movedDistance < MIN_DISTANCE_METERS) {
      return;
    }
  }

  await apiClient.patch('/drivers/location', nextLocation);
  lastSentAt = now;
  lastSentLocation = nextLocation;
}

export function resetDriverLocationTrackingState() {
  lastSentAt = 0;
  lastSentLocation = null;
}
