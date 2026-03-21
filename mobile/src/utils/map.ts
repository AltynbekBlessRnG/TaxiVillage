export interface MapPoint {
  latitude: number;
  longitude: number;
}

export function toMapPoint(lat?: number | null, lng?: number | null): MapPoint | null {
  if (lat === undefined || lat === null || lng === undefined || lng === null) {
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
