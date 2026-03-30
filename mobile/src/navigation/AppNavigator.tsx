import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '../screens/Auth/LoginScreen';
import { RegisterScreen } from '../screens/Auth/RegisterScreen';
import { PassengerHomeScreen } from '../screens/Passenger/PassengerHomeScreen';
import { RideStatusScreen } from '../screens/Passenger/RideStatusScreen';
import { FavoriteAddressesScreen } from '../screens/Passenger/FavoriteAddressesScreen';
import { FoodHomeScreen } from '../screens/Passenger/FoodHomeScreen';
import { RestaurantScreen } from '../screens/Passenger/RestaurantScreen';
import { CartScreen } from '../screens/Passenger/CartScreen';
import { FoodCheckoutScreen } from '../screens/Passenger/FoodCheckoutScreen';
import { FoodOrderStatusScreen } from '../screens/Passenger/FoodOrderStatusScreen';
import { IntercityHomeScreen } from '../screens/Passenger/IntercityHomeScreen';
import { IntercityOffersScreen } from '../screens/Passenger/IntercityOffersScreen';
import { IntercityBookingScreen } from '../screens/Passenger/IntercityBookingScreen';
import { IntercityTripStatusScreen } from '../screens/Passenger/IntercityTripStatusScreen';
import { IntercityOrderStatusScreen } from '../screens/Passenger/IntercityOrderStatusScreen';
import { IntercityChatScreen } from '../screens/Passenger/IntercityChatScreen';
import { DriverHomeScreen } from '../screens/Driver/DriverHomeScreen';
import { DriverProfileScreen } from '../screens/Driver/DriverProfileScreen';
import { DriverRideScreen } from '../screens/Driver/DriverRideScreen';
import { CourierOrderScreen } from '../screens/Courier/CourierOrderScreen';
import { MerchantDashboardScreen } from '../screens/Merchant/MerchantDashboardScreen';
import { MerchantOrdersScreen } from '../screens/Merchant/MerchantOrdersScreen';
import { MenuEditorScreen } from '../screens/Merchant/MenuEditorScreen';
import { IntercityTripScreen } from '../screens/IntercityDriver/IntercityTripScreen';
import { IntercityRequestsScreen } from '../screens/IntercityDriver/IntercityRequestsScreen';
import { RideHistoryScreen } from '../screens/RideHistoryScreen';
import { ChatScreen } from '../screens/Passenger/ChatScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { MessagesScreen } from '../screens/MessagesScreen';
import { loadAuth } from '../storage/authStorage';
import { setAuthToken } from '../api/client';
import { registerPushToken } from '../utils/notifications';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  PassengerHome: { selectedAddress?: { address: string; lat: number; lng: number } };
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
  IntercityOffers: {
    fromCity: string;
    toCity: string;
    date: string;
    seats: string;
    baggage: string;
    minPrice: string;
    maxPrice: string;
    womenOnly: boolean;
    baggageRequired: boolean;
    noAnimals: boolean;
  };
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
    stops: string[];
    womenOnly: boolean;
    baggageSpace: boolean;
    allowAnimals: boolean;
  };
  IntercityTripStatus: { bookingId: string };
  IntercityOrderStatus: { orderId: string };
  IntercityChat: { threadType: 'ORDER' | 'BOOKING'; threadId: string; title?: string };
  FavoriteAddresses: undefined;
  RideDetails: { rideId: string };
  ChatScreen: { rideId: string };
  DriverHome: undefined;
  DriverProfile: undefined;
  DriverRide: { rideId: string };
  CourierOrder: { orderId?: string } | undefined;
  MerchantDashboard: undefined;
  MerchantOrders: undefined;
  MenuEditor: undefined;
  IntercityTrip: { tripId?: string } | undefined;
  IntercityRequests: undefined;
  RideHistory: undefined;
  Notifications: undefined;
  Messages: undefined;
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
        if (['DRIVER', 'DRIVER_TAXI', 'COURIER', 'DRIVER_INTERCITY'].includes(auth.role)) {
          setInitialRoute('DriverHome');
        } else if (auth.role === 'MERCHANT') {
          setInitialRoute('MerchantDashboard');
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
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: {
          backgroundColor: '#09090B',
        },
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="PassengerHome" component={PassengerHomeScreen} />
      <Stack.Screen
        name="FoodHome"
        component={FoodHomeScreen}
        options={{ animation: 'fade_from_bottom' }}
      />
      <Stack.Screen name="Restaurant" component={RestaurantScreen} />
      <Stack.Screen name="Cart" component={CartScreen} />
      <Stack.Screen name="FoodCheckout" component={FoodCheckoutScreen} />
      <Stack.Screen name="FoodOrderStatus" component={FoodOrderStatusScreen} />
      <Stack.Screen
        name="IntercityHome"
        component={IntercityHomeScreen}
        options={{ animation: 'fade_from_bottom' }}
      />
      <Stack.Screen name="IntercityOffers" component={IntercityOffersScreen} />
      <Stack.Screen name="IntercityBooking" component={IntercityBookingScreen} />
      <Stack.Screen name="IntercityTripStatus" component={IntercityTripStatusScreen} />
      <Stack.Screen name="IntercityOrderStatus" component={IntercityOrderStatusScreen} />
      <Stack.Screen name="IntercityChat" component={IntercityChatScreen} />
      <Stack.Screen
        name="FavoriteAddresses"
        component={FavoriteAddressesScreen}
        options={{ presentation: 'modal', animation: 'fade_from_bottom' }}
      />
      <Stack.Screen name="RideDetails" component={RideStatusScreen} />
      <Stack.Screen name="ChatScreen" component={ChatScreen} />
      <Stack.Screen name="DriverHome" component={DriverHomeScreen} />
      <Stack.Screen name="DriverProfile" component={DriverProfileScreen} />
      <Stack.Screen name="DriverRide" component={DriverRideScreen} />
      <Stack.Screen name="CourierOrder" component={CourierOrderScreen} />
      <Stack.Screen name="MerchantDashboard" component={MerchantDashboardScreen} />
      <Stack.Screen name="MerchantOrders" component={MerchantOrdersScreen} />
      <Stack.Screen name="MenuEditor" component={MenuEditorScreen} />
      <Stack.Screen name="IntercityTrip" component={IntercityTripScreen} />
      <Stack.Screen name="IntercityRequests" component={IntercityRequestsScreen} />
      <Stack.Screen
        name="RideHistory"
        component={RideHistoryScreen}
        options={{ presentation: 'modal', animation: 'fade_from_bottom' }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ presentation: 'modal', animation: 'fade_from_bottom' }}
      />
      <Stack.Screen
        name="Messages"
        component={MessagesScreen}
        options={{ presentation: 'modal', animation: 'fade_from_bottom' }}
      />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#09090B',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#F4F4F5',
  },
});

