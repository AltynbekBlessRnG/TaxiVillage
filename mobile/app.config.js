import 'dotenv/config';

export default {
  "expo": {
    "name": "TaxiVillage",
    "slug": "taxivillage",
    "version": "1.0.0",
    "orientation": "portrait",
    "userInterfaceStyle": "dark",
    "scheme": "taxivillage",
    "extra": {
      "googleMapsApiKey": process.env.GOOGLE_MAPS_API_KEY,
      "eas": {
  "projectId": "e0a60c8b-e165-49d7-9b26-4c97c40f3644"
}
    },
    "ios": {
      "bundleIdentifier": "com.taxivillage.app",
      "infoPlist": {
        "NSLocationWhenInUseUsageDescription": "This app needs access to location to show your position on the map and find nearby drivers.",
        "NSLocationAlwaysUsageDescription": "This app needs access to location to show your position on the map and find nearby drivers."
      }
    },
    "android": {
      "package": "com.taxivillage.app",
      "config": {
        "googleMaps": {
          "apiKey": process.env.GOOGLE_MAPS_API_KEY
        }
      },
      "permissions": [
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_BACKGROUND_LOCATION",
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.FOREGROUND_SERVICE_LOCATION",
        "android.permission.INTERNET"
      ],
      "usesCleartextTraffic": true
    },
    "plugins": [
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "Allow $(PRODUCT_NAME) to use your location.",
          "locationAlwaysPermission": "Allow $(PRODUCT_NAME) to use your location.",
          "locationWhenInUsePermission": "Allow $(PRODUCT_NAME) to use your location.",
          "isIosBackgroundLocationEnabled": true,
          "isAndroidBackgroundLocationEnabled": true
        }
      ],
      "expo-notifications"
    ]
  }
};
