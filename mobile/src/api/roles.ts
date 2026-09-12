import { apiClient, setAuthToken } from './client';
import { loadAuth, saveAuth } from '../storage/authStorage';
import { resetRoot } from '../navigation/rootNavigation';

export type AppRole = 'PASSENGER' | 'DRIVER' | 'MERCHANT' | 'ADMIN';

export interface RolesInfo {
  activeRole: AppRole;
  availableRoles: AppRole[];
}

interface RoleSwitchResponse extends RolesInfo {
  accessToken: string;
  refreshToken: string;
  role: AppRole;
}

export const ROLE_LABELS: Record<AppRole, string> = {
  PASSENGER: 'Пассажир',
  DRIVER: 'Водитель',
  MERCHANT: 'Заведение',
  ADMIN: 'Администратор',
};

export async function fetchRoles(): Promise<RolesInfo> {
  const { data } = await apiClient.get<RolesInfo>('/auth/roles');
  return data;
}

/** Signs the current account up to drive, then switches it into driver mode. */
export async function becomeDriver(fullName?: string): Promise<AppRole> {
  const { data } = await apiClient.post<RoleSwitchResponse>('/auth/roles/driver', {
    fullName: fullName?.trim() || undefined,
  });
  await applyRoleSwitch(data);
  return data.role;
}

export async function switchRole(role: AppRole): Promise<AppRole> {
  const { data } = await apiClient.post<RoleSwitchResponse>('/auth/roles/switch', { role });
  await applyRoleSwitch(data);
  return data.role;
}

/**
 * The role is baked into the access token, so a switch is only real once the
 * new pair is stored - otherwise every guarded request keeps answering for the
 * old role. Storing first, navigating second, keeps those in step.
 */
async function applyRoleSwitch(data: RoleSwitchResponse) {
  const auth = await loadAuth();
  if (!auth) {
    throw new Error('Сессия не найдена');
  }

  await saveAuth({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    role: data.role,
    userId: auth.userId,
  });
  setAuthToken(data.accessToken);

  // Reset rather than navigate: the screens behind belong to the role the
  // person just left, and going back to them would show a passenger a
  // driver's stack or the other way round.
  if (data.role === 'DRIVER') {
    resetRoot('DriverHome', undefined);
    return;
  }
  if (data.role === 'MERCHANT') {
    resetRoot('MerchantDashboard', undefined);
    return;
  }
  resetRoot('PassengerHome', {});
}
