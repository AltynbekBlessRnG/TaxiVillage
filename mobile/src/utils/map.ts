export interface MapPoint {
  latitude: number;
  longitude: number;
}

export function toMapPoint(lat?: number | null, lng?: number | null): MapPoint | null {
  if (lat === undefined || lat === null || lng === undefined || lng === null) {
    return null;
  }

  if (lat === 0 && lng === 0) {
    return null;
  }

  return {
    latitude: lat,
    longitude: lng,
  };
}

export function buildRouteCoordinates(params: {
  fromLat?: number | null;
  fromLng?: number | null;
  stops?: Array<{ lat: number; lng: number }>;
  toLat?: number | null;
  toLng?: number | null;
}) {
  const points: MapPoint[] = [];
  const from = toMapPoint(params.fromLat, params.fromLng);
  const to = toMapPoint(params.toLat, params.toLng);

  if (from) {
    points.push(from);
  }

  for (const stop of params.stops ?? []) {
    const stopPoint = toMapPoint(stop.lat, stop.lng);
    if (stopPoint) {
      points.push(stopPoint);
    }
  }

  if (to) {
    points.push(to);
  }

  return points;
}

export function buildRegion(points: MapPoint[], fallback: MapPoint) {
  if (points.length === 0) {
    return {
      ...fallback,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };
  }

  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.02),
    longitudeDelta: Math.max((maxLng - minLng) * 1.5, 0.02),
  };
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

/** Great-circle distance between two points, in metres. */
export function distanceMeters(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
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
