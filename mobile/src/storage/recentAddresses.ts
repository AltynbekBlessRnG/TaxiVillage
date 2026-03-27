import AsyncStorage from '@react-native-async-storage/async-storage';

const RECENT_ADDRESSES_KEY = '@taxivillage_recent_addresses_v1';
const MAX_RECENT_ADDRESSES = 12;

export interface RecentAddress {
  address: string;
  lat: number;
  lng: number;
  savedAt: string;
}

const hasValidCoordinates = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);

export async function loadRecentAddresses(): Promise<RecentAddress[]> {
  const raw = await AsyncStorage.getItem(RECENT_ADDRESSES_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as RecentAddress[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item) => item?.address && hasValidCoordinates(item.lat, item.lng));
  } catch {
    return [];
  }
}

export async function saveRecentAddress(address: string, lat: number, lng: number): Promise<void> {
  if (!address.trim() || !hasValidCoordinates(lat, lng)) {
    return;
  }

  const nextItem: RecentAddress = {
    address: address.trim(),
    lat,
    lng,
    savedAt: new Date().toISOString(),
  };

  const current = await loadRecentAddresses();
  const deduped = current.filter(
    (item) =>
      item.address.toLowerCase() !== nextItem.address.toLowerCase() &&
      !(Math.abs(item.lat - nextItem.lat) < 0.000001 && Math.abs(item.lng - nextItem.lng) < 0.000001),
  );

  await AsyncStorage.setItem(
    RECENT_ADDRESSES_KEY,
    JSON.stringify([nextItem, ...deduped].slice(0, MAX_RECENT_ADDRESSES)),
  );
}
