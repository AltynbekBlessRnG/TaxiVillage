import { apiClient } from './client';
import { reverseGeocodeWithGoogle } from '../utils/googleMaps';

export type PlaceKind = 'POI' | 'STREET' | 'AREA';

export interface NearestPlace {
  id: string;
  name: string;
  kind: PlaceKind;
  category: string | null;
  lat: number;
  lng: number;
  distanceM: number;
}

export interface NearestPlaceAnswer {
  label: string | null;
  place: NearestPlace | null;
  street: NearestPlace | null;
}

export interface PlaceSuggestion {
  id: string;
  name: string;
  kind: PlaceKind;
  lat: number;
  lng: number;
}

/** Nearest named landmark from our own village directory. */
export async function fetchNearestPlace(
  lat: number,
  lng: number,
): Promise<NearestPlaceAnswer | null> {
  try {
    const { data } = await apiClient.get<NearestPlaceAnswer>('/places/nearest', {
      params: { lat, lng },
    });
    return data;
  } catch {
    return null;
  }
}

export async function searchPlaces(query: string): Promise<PlaceSuggestion[]> {
  try {
    const { data } = await apiClient.get<PlaceSuggestion[]>('/places/search', {
      params: { q: query },
    });
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * What to write in the address field for a point the person picked on the map.
 *
 * Our own directory goes first: it is the only source that knows the village
 * by the names people use. Google is the fallback for anything outside it, and
 * it is allowed to say nothing at all - which is what it does around Usharal,
 * where its only answer is a Plus Code.
 */
export async function resolveAddressForPoint(lat: number, lng: number): Promise<string> {
  const nearest = await fetchNearestPlace(lat, lng);
  if (nearest?.label) {
    return nearest.label;
  }

  const geocoded = await reverseGeocodeWithGoogle(lat, lng).catch(() => '');
  if (geocoded) {
    return geocoded;
  }

  return 'Точка на карте';
}
