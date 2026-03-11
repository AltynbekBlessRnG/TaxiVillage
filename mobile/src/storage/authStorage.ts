import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = '@taxivillage_token';
const ROLE_KEY = '@taxivillage_role';
const USER_ID_KEY = '@taxivillage_user_id';

export async function saveAuth(token: string, role: string, userId?: string): Promise<void> {
  const pairs: [string, string][] = [
    [TOKEN_KEY, token],
    [ROLE_KEY, role],
  ];
  if (userId) {
    pairs.push([USER_ID_KEY, userId]);
  }
  await AsyncStorage.multiSet(pairs);
}

export async function loadAuth(): Promise<{ token: string; role: string; userId?: string } | null> {
  const values = await AsyncStorage.multiGet([TOKEN_KEY, ROLE_KEY, USER_ID_KEY]);
  const token = values[0][1];
  const role = values[1][1];
  const userId = values[2][1];
  if (token && role) {
    return { token, role, userId: userId || undefined };
  }
  return null;
}

export async function clearAuth(): Promise<void> {
  await AsyncStorage.multiRemove([TOKEN_KEY, ROLE_KEY, USER_ID_KEY]);
}
