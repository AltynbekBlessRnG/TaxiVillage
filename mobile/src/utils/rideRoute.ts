import { getGoogleDirections } from './googleMaps';
import { buildRouteCoordinates, type MapPoint } from './map';

export type RideRouteStatus =
  | 'SEARCHING_DRIVER'
  | 'DRIVER_ASSIGNED'
  | 'ON_THE_WAY'
  | 'DRIVER_ARRIVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELED';

interface Coord {
  lat: number;
  lng: number;
}

interface Stop extends Coord {
  address?: string;
}

interface RouteSpec {
  origin: Coord | null;
  destination: Coord | null;
  waypoints: Coord[];
  fallbackCoordinates: MapPoint[];
  etaTarget: 'pickup' | null;
}

export interface RideRouteData {
  coordinates: MapPoint[];
  durationSeconds: number | null;
  distanceMeters: number | null;
  usedFallback: boolean;
}

function hasValidCoord(coord?: Coord | null) {
  return !!coord && Number.isFinite(coord.lat) && Number.isFinite(coord.lng) && !(coord.lat === 0 && coord.lng === 0);
}

function filterValidStops(stops: Stop[]) {
  return stops.filter((stop) => hasValidCoord(stop));
}

export function getRideRouteSpec(params: {
  status: string;
  fromCoord?: Coord | null;
  toCoord?: Coord | null;
  driverCoord?: Coord | null;
  stops?: Stop[];
}): RouteSpec {
  const status = params.status as RideRouteStatus;
  const fromCoord = hasValidCoord(params.fromCoord) ? params.fromCoord! : null;
  const toCoord = hasValidCoord(params.toCoord) ? params.toCoord! : null;
  const driverCoord = hasValidCoord(params.driverCoord) ? params.driverCoord! : null;
  const stops = filterValidStops(params.stops ?? []);

  if (status === 'ON_THE_WAY' || status === 'DRIVER_ASSIGNED' || status === 'DRIVER_ARRIVED') {
    return {
      origin: driverCoord,
      destination: fromCoord,
      waypoints: [],
      fallbackCoordinates: buildRouteCoordinates({
        fromLat: driverCoord?.lat,
        fromLng: driverCoord?.lng,
        toLat: fromCoord?.lat,
        toLng: fromCoord?.lng,
      }),
      etaTarget: fromCoord ? 'pickup' : null,
    };
  }

  if (status === 'IN_PROGRESS') {
    return {
      origin: driverCoord ?? fromCoord,
      destination: toCoord,
      waypoints: stops,
      fallbackCoordinates: buildRouteCoordinates({
        fromLat: (driverCoord ?? fromCoord)?.lat,
        fromLng: (driverCoord ?? fromCoord)?.lng,
        stops,
        toLat: toCoord?.lat,
        toLng: toCoord?.lng,
      }),
      etaTarget: null,
    };
  }

  return {
    origin: fromCoord,
    destination: toCoord,
    waypoints: stops,
    fallbackCoordinates: buildRouteCoordinates({
      fromLat: fromCoord?.lat,
      fromLng: fromCoord?.lng,
      stops,
      toLat: toCoord?.lat,
      toLng: toCoord?.lng,
    }),
    etaTarget: null,
  };
}

export async function resolveRideRoute(params: {
  status: string;
  fromCoord?: Coord | null;
  toCoord?: Coord | null;
  driverCoord?: Coord | null;
  stops?: Stop[];
}): Promise<RideRouteData> {
  const spec = getRideRouteSpec(params);

  if (!spec.origin || !spec.destination) {
    return {
      coordinates: spec.fallbackCoordinates,
      durationSeconds: null,
      distanceMeters: null,
      usedFallback: true,
    };
  }

  try {
    const directions = await getGoogleDirections({
      origin: spec.origin,
      destination: spec.destination,
      waypoints: spec.waypoints,
    });

    return {
      coordinates: directions.coordinates.length > 0 ? directions.coordinates : spec.fallbackCoordinates,
      durationSeconds: spec.etaTarget === 'pickup' ? directions.durationSeconds : null,
      distanceMeters: spec.etaTarget === 'pickup' ? directions.distanceMeters : null,
      usedFallback: directions.coordinates.length === 0,
    };
  } catch {
    return {
      coordinates: spec.fallbackCoordinates,
      durationSeconds: null,
      distanceMeters: null,
      usedFallback: true,
    };
  }
}
