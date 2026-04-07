import 'react-native-gesture-handler';
import React from 'react';
import { LinkingOptions, NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppNavigator } from './src/navigation/AppNavigator';
import { RootStackParamList } from './src/navigation/AppNavigator';
import { navigationRef } from './src/navigation/rootNavigation';
import { initializeNotifications } from './src/utils/notifications';
import './src/location/backgroundTracking';

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['taxivillage://'],
  config: {
    screens: {
      FoodOrderStatus: 'food-order/:orderId',
      MerchantOrders: 'merchant-orders/:orderId',
    },
  },
};

export default function App() {
  React.useEffect(() => {
    initializeNotifications().catch(() => null);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer ref={navigationRef} linking={linking}>
        <AppNavigator />
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

