import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = '@taxivillage_token';
const ROLE_KEY = '@taxivillage_role';

export async function saveAuth(token: string, role: string): Promise<void> {
  await AsyncStorage.multiSet([
    [TOKEN_KEY, token],
    [ROLE_KEY, role],
  ]);
}

export async function loadAuth(): Promise<{ token: string; role: string } | null> {
  const values = await AsyncStorage.multiGet([TOKEN_KEY, ROLE_KEY]);
  const token = values[0][1];
  const role = values[1][1];
  if (token && role) {
    return { token, role };
  }
  return null;
}

export async function clearAuth(): Promise<void> {
  await AsyncStorage.multiRemove([TOKEN_KEY, ROLE_KEY]);
}
