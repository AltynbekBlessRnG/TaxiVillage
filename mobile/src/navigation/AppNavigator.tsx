import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '../screens/Auth/LoginScreen';
import { RegisterScreen } from '../screens/Auth/RegisterScreen';
import { PassengerHomeScreen } from '../screens/Passenger/PassengerHomeScreen';
import { RideStatusScreen } from '../screens/Passenger/RideStatusScreen';
import { FavoriteAddressesScreen } from '../screens/Passenger/FavoriteAddressesScreen';
import { CourierHomeScreen } from '../screens/Passenger/CourierHomeScreen';
import { CourierStatusScreen } from '../screens/Passenger/CourierStatusScreen';
import { FoodHomeScreen } from '../screens/Passenger/FoodHomeScreen';
import { RestaurantScreen } from '../screens/Passenger/RestaurantScreen';
import { CartScreen } from '../screens/Passenger/CartScreen';
import { FoodCheckoutScreen } from '../screens/Passenger/FoodCheckoutScreen';
import { FoodOrderStatusScreen } from '../screens/Passenger/FoodOrderStatusScreen';
import { IntercityHomeScreen } from '../screens/Passenger/IntercityHomeScreen';
import { IntercityOffersScreen } from '../screens/Passenger/IntercityOffersScreen';
import { IntercityBookingScreen } from '../screens/Passenger/IntercityBookingScreen';
import { IntercityTripStatusScreen } from '../screens/Passenger/IntercityTripStatusScreen';
import { DriverHomeScreen } from '../screens/Driver/DriverHomeScreen';
import { DriverProfileScreen } from '../screens/Driver/DriverProfileScreen';
import { DriverRideScreen } from '../screens/Driver/DriverRideScreen';
import { CourierWorkerHomeScreen } from '../screens/Courier/CourierWorkerHomeScreen';
import { CourierOrderScreen } from '../screens/Courier/CourierOrderScreen';
import { CourierProfileScreen } from '../screens/Courier/CourierProfileScreen';
import { MerchantDashboardScreen } from '../screens/Merchant/MerchantDashboardScreen';
import { MerchantOrdersScreen } from '../screens/Merchant/MerchantOrdersScreen';
import { MenuEditorScreen } from '../screens/Merchant/MenuEditorScreen';
import { IntercityDriverHomeScreen } from '../screens/IntercityDriver/IntercityDriverHomeScreen';
import { IntercityTripScreen } from '../screens/IntercityDriver/IntercityTripScreen';
import { IntercityDriverProfileScreen } from '../screens/IntercityDriver/IntercityDriverProfileScreen';
import { RideHistoryScreen } from '../screens/RideHistoryScreen';
import { ChatScreen } from '../screens/Passenger/ChatScreen';
import { loadAuth } from '../storage/authStorage';
import { setAuthToken } from '../api/client';
import { registerPushToken } from '../utils/notifications';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  PassengerHome: { selectedAddress?: { address: string; lat: number; lng: number } };
  CourierHome: undefined;
  CourierStatus: { orderId: string };
  FoodHome: undefined;
  Restaurant: { restaurantId: string; restaurantName: string };
  Cart: {
    restaurantId: string;
    restaurantName: string;
    items: Array<{ menuItemId: string; name: string; price: string; qty: number }>;
  };
  FoodCheckout: {
    restaurantId: string;
    restaurantName: string;
    total: string;
    items: Array<{ menuItemId: string; name: string; price: string; qty: number }>;
  };
  FoodOrderStatus: { orderId: string };
  IntercityHome: undefined;
  IntercityOffers: { fromCity: string; toCity: string; date: string; seats: string; baggage: string };
  IntercityBooking: {
    tripId: string;
    fromCity: string;
    toCity: string;
    departureAt: string;
    driverName: string;
    car: string;
    pricePerSeat: string;
    seatCapacity: number;
    seatsRemaining: number;
  };
  IntercityTripStatus: { bookingId: string };
  FavoriteAddresses: undefined;
  RideStatus: { rideId: string };
  ChatScreen: { rideId: string };
  DriverHome: undefined;
  DriverProfile: undefined;
  DriverRide: { rideId: string };
  CourierWorkerHome: undefined;
  CourierOrder: { orderId?: string } | undefined;
  CourierProfile: undefined;
  MerchantDashboard: undefined;
  MerchantOrders: undefined;
  MenuEditor: undefined;
  IntercityDriverHome: undefined;
  IntercityTrip: { tripId?: string } | undefined;
  IntercityDriverProfile: undefined;
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
        if (auth.role === 'DRIVER' || auth.role === 'DRIVER_TAXI') {
          setInitialRoute('DriverHome');
        } else if (auth.role === 'COURIER') {
          setInitialRoute('DriverHome');
        } else if (auth.role === 'MERCHANT') {
          setInitialRoute('MerchantDashboard');
        } else if (auth.role === 'DRIVER_INTERCITY') {
          setInitialRoute('DriverHome');
        } else {
          setInitialRoute('PassengerHome');
        }
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
      <Stack.Screen name="CourierHome" component={CourierHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CourierStatus" component={CourierStatusScreen} options={{ headerShown: false }} />
      <Stack.Screen name="FoodHome" component={FoodHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Restaurant" component={RestaurantScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Cart" component={CartScreen} options={{ headerShown: false }} />
      <Stack.Screen name="FoodCheckout" component={FoodCheckoutScreen} options={{ headerShown: false }} />
      <Stack.Screen name="FoodOrderStatus" component={FoodOrderStatusScreen} options={{ headerShown: false }} />
      <Stack.Screen name="IntercityHome" component={IntercityHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="IntercityOffers" component={IntercityOffersScreen} options={{ headerShown: false }} />
      <Stack.Screen name="IntercityBooking" component={IntercityBookingScreen} options={{ headerShown: false }} />
      <Stack.Screen name="IntercityTripStatus" component={IntercityTripStatusScreen} options={{ headerShown: false }} />
      <Stack.Screen name="FavoriteAddresses" component={FavoriteAddressesScreen} options={{ headerShown: false }} />
      <Stack.Screen name="RideStatus" component={RideStatusScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ChatScreen" component={ChatScreen} options={{ headerShown: false }} />
      <Stack.Screen name="DriverHome" component={DriverHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="DriverProfile" component={DriverProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="DriverRide" component={DriverRideScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CourierWorkerHome" component={CourierWorkerHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CourierOrder" component={CourierOrderScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CourierProfile" component={CourierProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="MerchantDashboard" component={MerchantDashboardScreen} options={{ headerShown: false }} />
      <Stack.Screen name="MerchantOrders" component={MerchantOrdersScreen} options={{ headerShown: false }} />
      <Stack.Screen name="MenuEditor" component={MenuEditorScreen} options={{ headerShown: false }} />
      <Stack.Screen name="IntercityDriverHome" component={IntercityDriverHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="IntercityTrip" component={IntercityTripScreen} options={{ headerShown: false }} />
      <Stack.Screen name="IntercityDriverProfile" component={IntercityDriverProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="RideHistory" component={RideHistoryScreen} options={{ headerShown: false }} />
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

