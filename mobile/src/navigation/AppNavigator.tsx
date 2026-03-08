import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '../screens/Auth/LoginScreen';
import { RegisterScreen } from '../screens/Auth/RegisterScreen';
import { PassengerHomeScreen } from '../screens/Passenger/PassengerHomeScreen';
import { RideStatusScreen } from '../screens/Passenger/RideStatusScreen';
import { DriverHomeScreen } from '../screens/Driver/DriverHomeScreen';
import { DriverRideScreen } from '../screens/Driver/DriverRideScreen';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  PassengerHome: undefined;
  RideStatus: { rideId: string };
  DriverHome: undefined;
  DriverRide: { rideId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
  // MVP: без полноценного хранения токена и ролей.
  // В дальнейшем здесь можно будет проверять, авторизован ли пользователь
  // и какую роль (пассажир/водитель) он выбрал.

  return (
    <Stack.Navigator initialRouteName="Login">
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Вход' }} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Регистрация' }} />
      <Stack.Screen name="PassengerHome" component={PassengerHomeScreen} options={{ title: 'Поездка' }} />
      <Stack.Screen name="RideStatus" component={RideStatusScreen} options={{ title: 'Статус поездки' }} />
      <Stack.Screen name="DriverHome" component={DriverHomeScreen} options={{ title: 'Водитель' }} />
      <Stack.Screen name="DriverRide" component={DriverRideScreen} options={{ title: 'Текущая поездка' }} />
    </Stack.Navigator>
  );
};

