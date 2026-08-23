import 'react-native-gesture-handler';
import React from 'react';
import { DarkTheme, LinkingOptions, NavigationContainer, Theme } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AlertHost } from './src/components/AppAlert';
import { AppNavigator } from './src/navigation/AppNavigator';
import { RootStackParamList } from './src/navigation/AppNavigator';
import { navigationRef } from './src/navigation/rootNavigation';
import { initializeNotifications } from './src/utils/notifications';
import './src/location/backgroundTracking';

// Without a theme the container falls back to DefaultTheme, whose background is
// rgb(242, 242, 242) — and that near-white shows through for a frame on every
// push and pop, which is the flicker between screens.
const appTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#09090B',
    card: '#09090B',
  },
};

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['zhetysu://'],
  config: {
    screens: {
      FoodOrderStatus: 'food-order/:orderId',
      FoodOrderHistory: 'food-orders',
      FoodDeliveries: 'driver/food-deliveries',
      MerchantOrders: 'merchant-orders/:orderId',
    },
  },
};

export default function App() {
  React.useEffect(() => {
    initializeNotifications().catch(() => null);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#09090B' }}>
      <SafeAreaProvider>
        <NavigationContainer ref={navigationRef} linking={linking} theme={appTheme}>
          <AppNavigator />
        </NavigationContainer>
        <AlertHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
