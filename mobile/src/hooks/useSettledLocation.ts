import { useEffect, useState } from 'react';
import { distanceMeters } from '../utils/map';

type LatLng = { lat: number; lng: number };

/**
 * Follows `location`, but only moves once it has drifted `minMeters` from the
 * last value it reported. The map reports the driver's position every second
 * or so, and anything keyed on the raw value — a paid Directions request, a
 * route redraw — would rerun on every tick, GPS jitter included.
 */
export function useSettledLocation(location: LatLng | null, minMeters: number): LatLng | null {
  const [settled, setSettled] = useState<LatLng | null>(location);

  useEffect(() => {
    if (!location) {
      setSettled(null);
      return;
    }
    setSettled((previous) =>
      previous && distanceMeters(previous, location) < minMeters ? previous : location,
    );
  }, [location, minMeters]);

  return settled;
}
