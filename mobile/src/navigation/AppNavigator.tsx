import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '../screens/Auth/LoginScreen';
import { RegisterScreen } from '../screens/Auth/RegisterScreen';
import { PassengerHomeScreen } from '../screens/Passenger/PassengerHomeScreen';
import { RideStatusScreen } from '../screens/Passenger/RideStatusScreen';
import { FavoriteAddressesScreen } from '../screens/Passenger/FavoriteAddressesScreen';
import { DriverHomeScreen } from '../screens/Driver/DriverHomeScreen';
import { DriverProfileScreen } from '../screens/Driver/DriverProfileScreen';
import { DriverRideScreen } from '../screens/Driver/DriverRideScreen';
import { RideHistoryScreen } from '../screens/RideHistoryScreen';
import { ChatScreen } from '../screens/Passenger/ChatScreen';
import { loadAuth } from '../storage/authStorage';
import { setAuthToken } from '../api/client';
import { registerPushToken } from '../utils/notifications';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  PassengerHome: { selectedAddress?: { address: string; lat: number; lng: number } };
  FavoriteAddresses: undefined;
  RideStatus: { rideId: string };
  ChatScreen: { rideId: string };
  DriverHome: undefined;
  DriverProfile: undefined;
  DriverRide: { rideId: string };
  RideHistory: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList>('Login');

  useEffect(() => {
    let mounted = true;
    loadAuth().then((auth) => {
      if (!mounted) return;
      if (auth) {
        setAuthToken(auth.accessToken);
        setInitialRoute(auth.role === 'DRIVER' ? 'DriverHome' : 'PassengerHome');
        registerPushToken().catch(() => null);
      }
      setIsLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Загрузка...</Text>
      </View>
    );
  }

  return (
    <Stack.Navigator initialRouteName={initialRoute}>
      <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
      <Stack.Screen 
  name="PassengerHome" 
  component={PassengerHomeScreen} 
  options={{ headerShown: false }} 
/>
      <Stack.Screen name="FavoriteAddresses" component={FavoriteAddressesScreen} options={{ title: 'Избранные адреса' }} />
      <Stack.Screen name="RideStatus" component={RideStatusScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ChatScreen" component={ChatScreen} options={{ title: 'Чат' }} />
      <Stack.Screen name="DriverHome" component={DriverHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="DriverProfile" component={DriverProfileScreen} options={{ title: 'Профиль' }} />
      <Stack.Screen name="DriverRide" component={DriverRideScreen} options={{ headerShown: false }} />
      <Stack.Screen name="RideHistory" component={RideHistoryScreen} options={{ title: 'История поездок' }} />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
});

