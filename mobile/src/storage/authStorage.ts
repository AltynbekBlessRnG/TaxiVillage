import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCESS_TOKEN_KEY = '@taxivillage_access_token';
const REFRESH_TOKEN_KEY = '@taxivillage_refresh_token';
const ROLE_KEY = '@taxivillage_role';
const USER_ID_KEY = '@taxivillage_user_id';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  role: string;
  userId: string;
}

export async function saveAuth(session: AuthSession): Promise<void> {
  await AsyncStorage.multiSet([
    [ACCESS_TOKEN_KEY, session.accessToken],
    [REFRESH_TOKEN_KEY, session.refreshToken],
    [ROLE_KEY, session.role],
    [USER_ID_KEY, session.userId],
  ]);
}

export async function loadAuth(): Promise<AuthSession | null> {
  const values = await AsyncStorage.multiGet([
    ACCESS_TOKEN_KEY,
    REFRESH_TOKEN_KEY,
    ROLE_KEY,
    USER_ID_KEY,
  ]);
  const accessToken = values[0][1];
  const refreshToken = values[1][1];
  const role = values[2][1];
  const userId = values[3][1];

  if (accessToken && refreshToken && role && userId) {
    return { accessToken, refreshToken, role, userId };
  }

  return null;
}

export async function updateAccessToken(accessToken: string): Promise<void> {
  await AsyncStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
}

export async function updateAuthTokens(tokens: {
  accessToken: string;
  refreshToken: string;
}): Promise<void> {
  await AsyncStorage.multiSet([
    [ACCESS_TOKEN_KEY, tokens.accessToken],
    [REFRESH_TOKEN_KEY, tokens.refreshToken],
  ]);
}

export async function clearAuth(): Promise<void> {
  await AsyncStorage.multiRemove([
    ACCESS_TOKEN_KEY,
    REFRESH_TOKEN_KEY,
    ROLE_KEY,
    USER_ID_KEY,
  ]);
}
