import { apiClient } from '../api/instance';

const MIN_UPDATE_INTERVAL_MS = 5000;
const MIN_DISTANCE_METERS = 30;

let lastSentAt = 0;
let lastSentLocation: { lat: number; lng: number } | null = null;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function distanceMeters(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const earthRadius = 6371000;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

export async function sendCourierLocationUpdate(
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

  await apiClient.patch('/couriers/location', nextLocation);
  lastSentAt = now;
  lastSentLocation = nextLocation;
}

export function resetCourierLocationTrackingState() {
  lastSentAt = 0;
  lastSentLocation = null;
}
