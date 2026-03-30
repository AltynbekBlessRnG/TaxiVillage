import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './AppNavigator';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigateRoot<RouteName extends keyof RootStackParamList>(
  name: RouteName,
  params: RootStackParamList[RouteName],
) {
  if (!navigationRef.isReady()) {
    return false;
  }

  (navigationRef as any).navigate(name, params);
  return true;
}

export function resetRoot<RouteName extends keyof RootStackParamList>(
  name: RouteName,
  params: RootStackParamList[RouteName],
) {
  if (!navigationRef.isReady()) {
    return false;
  }

  (navigationRef as any).reset({
    index: 0,
    routes: [{ name, params }],
  });
  return true;
}
