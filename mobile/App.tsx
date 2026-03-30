import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppNavigator } from './src/navigation/AppNavigator';
import { navigationRef } from './src/navigation/rootNavigation';
import { initializeNotifications } from './src/utils/notifications';
import './src/location/backgroundTracking';

export default function App() {
  React.useEffect(() => {
    initializeNotifications().catch(() => null);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer ref={navigationRef}>
        <AppNavigator />
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

