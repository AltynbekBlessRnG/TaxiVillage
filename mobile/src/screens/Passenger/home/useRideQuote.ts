import { useEffect, useState } from 'react';
import { apiClient } from '../../../api/client';
import type { PassengerCoordinates, PassengerStop } from './usePassengerFlowStore';

export interface RideQuote {
  suggestedPrice: number;
  minPrice: number;
  distanceKm: number;
  estimatedMinutes: number;
  isRoughEstimate: boolean;
}

/**
 * Asks the backend what the ride is worth so the order screen can suggest a
 * price instead of showing an empty field. Returns null while unknown — the
 * backend still falls back to the same number if the passenger offers nothing.
 */
export function useRideQuote(
  enabled: boolean,
  fromCoord: PassengerCoordinates | null,
  toCoord: PassengerCoordinates | null,
  stops: PassengerStop[],
): RideQuote | null {
  const [quote, setQuote] = useState<RideQuote | null>(null);

  // Coordinates are objects, so depend on a stable primitive key instead.
  const routeKey = [
    fromCoord ? `${fromCoord.lat},${fromCoord.lng}` : '',
    toCoord ? `${toCoord.lat},${toCoord.lng}` : '',
    stops.map((stop) => `${stop.lat},${stop.lng}`).join('|'),
  ].join(';');

  useEffect(() => {
    if (!enabled || !fromCoord || !toCoord) {
      return;
    }

    let active = true;

    apiClient
      .post('/rides/estimate', {
        fromLat: fromCoord.lat,
        fromLng: fromCoord.lng,
        toLat: toCoord.lat,
        toLng: toCoord.lng,
        stops: stops.map((stop) => ({ lat: stop.lat, lng: stop.lng })),
      })
      .then((response) => {
        if (active) {
          setQuote(response.data ?? null);
        }
      })
      .catch(() => {
        // A missing suggestion is not worth an error message: the field still
        // works, and the backend prices the ride if it is left empty.
        if (active) {
          setQuote(null);
        }
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, routeKey]);

  return quote;
}
