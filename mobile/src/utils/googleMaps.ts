import Constants from 'expo-constants';

const ALMATY_FALLBACK = {
  lat: 43.238949,
  lng: 76.889709,
};

interface GoogleAutocompletePrediction {
  description: string;
  place_id: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
}

interface GoogleAutocompleteResponse {
  predictions?: GoogleAutocompletePrediction[];
  status: string;
  error_message?: string;
}

interface GooglePlaceDetailsResponse {
  result?: {
    geometry?: {
      location?: {
        lat: number;
        lng: number;
      };
    };
  };
  status: string;
  error_message?: string;
}

interface GoogleGeocodeResponse {
  results?: Array<{
    formatted_address?: string;
    types?: string[];
    geometry?: {
      location?: {
        lat: number;
        lng: number;
      };
    };
  }>;
  status: string;
  error_message?: string;
}

interface GoogleDirectionsResponse {
  routes?: Array<{
    overview_polyline?: {
      points?: string;
    };
    legs?: Array<{
      duration?: {
        value?: number;
      };
      distance?: {
        value?: number;
      };
    }>;
  }>;
  status: string;
  error_message?: string;
}

function cleanAddressPart(value?: string) {
  if (!value) {
    return '';
  }

  return value
    .replace(/\b\d{6}\b/g, '')
    .replace(/,\s*Казахстан\b/gi, '')
    .replace(/\bКазахстан\b/gi, '')
    .replace(/,\s*Алматы\b/gi, '')
    .replace(/\bАлматы\b/gi, '')
    .replace(/,\s*Almaty\b/gi, '')
    .replace(/\bAlmaty\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+,/g, ',')
    .trim()
    .replace(/,$/, '');
}

function isAlmatyText(value?: string) {
  return /алмат|almaty/i.test(value ?? '');
}

function shortenAddress(value?: string) {
  const cleaned = cleanAddressPart(value);
  if (!cleaned) {
    return '';
  }

  const [firstPart, secondPart] = cleaned
    .split(',')
    .map((part) => cleanAddressPart(part))
    .filter(Boolean);

  if (!firstPart) {
    return cleaned;
  }

  if (/\d/.test(firstPart) || !secondPart) {
    return firstPart;
  }

  return `${firstPart}, ${secondPart}`;
}

export function formatGooglePredictionAddress(prediction: GoogleAutocompletePrediction) {
  return shortenAddress(prediction.structured_formatting?.main_text || prediction.description);
}

function getGoogleMapsApiKey() {
  const apiKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    Constants.expoConfig?.extra?.googleMapsApiKey ||
    (Constants.manifest as { extra?: { googleMapsApiKey?: string } } | null | undefined)?.extra
      ?.googleMapsApiKey ||
    (
      Constants.manifest2 as {
        extra?: {
          expoClient?: {
            extra?: {
              googleMapsApiKey?: string;
            };
          };
        };
      } | null | undefined
    )?.extra?.expoClient?.extra?.googleMapsApiKey;
  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('GOOGLE_MAPS_API_KEY is not configured');
  }

  return apiKey;
}

async function fetchGoogleJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Google Maps request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function searchGooglePlaces(
  query: string,
  userLocation?: { lat: number; lng: number } | null,
) {
  const apiKey = getGoogleMapsApiKey();
  const anchor = userLocation ?? ALMATY_FALLBACK;
  const url =
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?` +
    `input=${encodeURIComponent(query)}` +
    `&key=${encodeURIComponent(apiKey)}` +
    `&language=ru` +
    `&components=country:kz` +
    `&location=${anchor.lat},${anchor.lng}` +
    `&radius=50000` +
    `&types=geocode`;

  const data = await fetchGoogleJson<GoogleAutocompleteResponse>(url);
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(data.error_message || `Google autocomplete status: ${data.status}`);
  }

  return data.predictions ?? [];
}

export async function getGooglePlaceDetails(placeId: string) {
  const apiKey = getGoogleMapsApiKey();
  const url =
    `https://maps.googleapis.com/maps/api/place/details/json?` +
    `place_id=${encodeURIComponent(placeId)}` +
    `&key=${encodeURIComponent(apiKey)}` +
    `&language=ru` +
    `&fields=geometry/location`;

  const data = await fetchGoogleJson<GooglePlaceDetailsResponse>(url);
  if (data.status !== 'OK' || !data.result?.geometry?.location) {
    throw new Error(data.error_message || `Google place details status: ${data.status}`);
  }

  return data.result.geometry.location;
}

export async function reverseGeocodeWithGoogle(lat: number, lng: number) {
  const apiKey = getGoogleMapsApiKey();
  const url =
    `https://maps.googleapis.com/maps/api/geocode/json?` +
    `latlng=${lat},${lng}` +
    `&key=${encodeURIComponent(apiKey)}` +
    `&language=ru`;

  const data = await fetchGoogleJson<GoogleGeocodeResponse>(url);
  if (data.status !== 'OK' || !data.results?.length) {
    throw new Error(data.error_message || `Google geocode status: ${data.status}`);
  }

  const preferredResult =
    data.results.find((result) =>
      result.types?.some((type) =>
        ['street_address', 'premise', 'subpremise', 'route', 'intersection'].includes(type),
      ),
    ) ??
    data.results.find(
      (result) =>
        result.formatted_address &&
        !result.formatted_address.includes('+') &&
        !result.types?.includes('plus_code'),
    ) ??
    data.results[0];

  return shortenAddress(preferredResult.formatted_address) || 'Точка на карте';
}

export async function geocodeAddressWithGoogle(
  address: string,
  userLocation?: { lat: number; lng: number } | null,
) {
  const apiKey = getGoogleMapsApiKey();
  const anchor = userLocation ?? ALMATY_FALLBACK;
  const url =
    `https://maps.googleapis.com/maps/api/geocode/json?` +
    `address=${encodeURIComponent(address)}` +
    `&key=${encodeURIComponent(apiKey)}` +
    `&language=ru` +
    `&region=kz` +
    `&components=country:KZ`;

  const data = await fetchGoogleJson<GoogleGeocodeResponse>(url);
  if (data.status !== 'OK' || !data.results?.length) {
    throw new Error(data.error_message || `Google geocode status: ${data.status}`);
  }

  const preferredResult =
    data.results.find((result) =>
      result.types?.some((type) =>
        ['street_address', 'premise', 'subpremise', 'route', 'intersection'].includes(type),
      ),
    ) ??
    data.results[0];

  const location = preferredResult.geometry?.location;
  if (!location) {
    throw new Error('Google geocode result has no location');
  }

  return {
    address: shortenAddress(preferredResult.formatted_address) || shortenAddress(address),
    lat: location.lat,
    lng: location.lng,
    distanceFromUserKm:
      userLocation
        ? haversineDistanceKm(userLocation.lat, userLocation.lng, location.lat, location.lng)
        : haversineDistanceKm(anchor.lat, anchor.lng, location.lat, location.lng),
  };
}

function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const earthRadiusKm = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function decodePolyline(encoded: string) {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates: Array<{ latitude: number; longitude: number }> = [];

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    result = 0;
    shift = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    coordinates.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return coordinates;
}

export async function getGoogleDirections(params: {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  waypoints?: Array<{ lat: number; lng: number }>;
}) {
  const apiKey = getGoogleMapsApiKey();
  const waypointString =
    params.waypoints && params.waypoints.length > 0
      ? `&waypoints=${encodeURIComponent(
          params.waypoints.map((point) => `${point.lat},${point.lng}`).join('|'),
        )}`
      : '';

  const url =
    `https://maps.googleapis.com/maps/api/directions/json?` +
    `origin=${params.origin.lat},${params.origin.lng}` +
    `&destination=${params.destination.lat},${params.destination.lng}` +
    `${waypointString}` +
    `&mode=driving` +
    `&language=ru` +
    `&key=${encodeURIComponent(apiKey)}`;

  const data = await fetchGoogleJson<GoogleDirectionsResponse>(url);
  if (data.status !== 'OK' || !data.routes?.length) {
    throw new Error(data.error_message || `Google directions status: ${data.status}`);
  }

  const route = data.routes[0];
  const polyline = route.overview_polyline?.points ?? '';
  const coordinates = polyline ? decodePolyline(polyline) : [];
  const durationSeconds = (route.legs ?? []).reduce(
    (sum, leg) => sum + (leg.duration?.value ?? 0),
    0,
  );
  const distanceMeters = (route.legs ?? []).reduce(
    (sum, leg) => sum + (leg.distance?.value ?? 0),
    0,
  );

  return {
    coordinates,
    durationSeconds,
    distanceMeters,
  };
}
