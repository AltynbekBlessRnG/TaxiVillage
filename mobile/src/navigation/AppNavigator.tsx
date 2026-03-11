import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '../screens/Auth/LoginScreen';
import { RegisterScreen } from '../screens/Auth/RegisterScreen';
import { PassengerHomeScreen } from '../screens/Passenger/PassengerHomeScreen';
import { RideStatusScreen } from '../screens/Passenger/RideStatusScreen';
import { DriverHomeScreen } from '../screens/Driver/DriverHomeScreen';
import { DriverProfileScreen } from '../screens/Driver/DriverProfileScreen';
import { DriverRideScreen } from '../screens/Driver/DriverRideScreen';
import { RideHistoryScreen } from '../screens/RideHistoryScreen';
import { loadAuth } from '../storage/authStorage';
import { setAuthToken } from '../api/client';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  PassengerHome: undefined;
  RideStatus: { rideId: string };
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
        setAuthToken(auth.token);
        setInitialRoute(auth.role === 'DRIVER' ? 'DriverHome' : 'PassengerHome');
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
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Вход' }} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Регистрация' }} />
      <Stack.Screen name="PassengerHome" component={PassengerHomeScreen} options={{ title: 'Поездка' }} />
      <Stack.Screen name="RideStatus" component={RideStatusScreen} options={{ title: 'Статус поездки' }} />
      <Stack.Screen name="DriverHome" component={DriverHomeScreen} options={{ title: 'Водитель' }} />
      <Stack.Screen name="DriverProfile" component={DriverProfileScreen} options={{ title: 'Профиль' }} />
      <Stack.Screen name="DriverRide" component={DriverRideScreen} options={{ title: 'Текущая поездка' }} />
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

