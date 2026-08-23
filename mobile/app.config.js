import 'dotenv/config';

export default {
  "expo": {
    "name": "Zhetysu Go",
    "slug": "taxivillage",
    "version": "1.0.0",
    "icon": "./assets/icon.png",
    "orientation": "portrait",
    "userInterfaceStyle": "dark",
    "backgroundColor": "#09090B",
    "androidStatusBar": {
      "barStyle": "light-content",
      "translucent": true
    },
    "androidNavigationBar": {
      "barStyle": "light-content"
    },
    "scheme": "zhetysu",
    "extra": {
      "googleMapsApiKey": process.env.GOOGLE_MAPS_API_KEY,
      "eas": {
  "projectId": "e0a60c8b-e165-49d7-9b26-4c97c40f3644"
}
    },
    "ios": {
      "bundleIdentifier": "com.zhetysu.go",
      "config": {
        "usesNonExemptEncryption": false
      },
      "infoPlist": {
        "NSLocationWhenInUseUsageDescription": "Zhetysu Go uses your location to show your position on the map, choose pickup and delivery addresses, and find nearby drivers.",
        "NSLocationAlwaysAndWhenInUseUsageDescription": "When you go online as a driver or courier, Zhetysu Go uses your location to send nearby orders and update the customer with your position, including while the app is in the background.",
        "NSLocationAlwaysUsageDescription": "When you go online as a driver or courier, Zhetysu Go uses your location to send nearby orders and update the customer with your position, including while the app is in the background.",
        "NSPhotoLibraryUsageDescription": "Zhetysu Go lets you choose a profile photo or a driver document from your photo library."
      },
      "privacyManifests": {
        "NSPrivacyTracking": false,
        "NSPrivacyTrackingDomains": [],
        "NSPrivacyAccessedAPITypes": [
          {
            "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryUserDefaults",
            "NSPrivacyAccessedAPITypeReasons": ["CA92.1"]
          }
        ]
      }
    },
    "android": {
      "package": "com.zhetysu.go",
      "softwareKeyboardLayoutMode": "resize",
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
      "usesCleartextTraffic": false
    },
    "plugins": [
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "Allow Zhetysu Go to use your location while you are online as a driver or courier, including in the background.",
          "locationAlwaysPermission": "Allow Zhetysu Go to use your location while you are online as a driver or courier, including in the background.",
          "locationWhenInUsePermission": "Allow Zhetysu Go to use your location to show the map and choose pickup or delivery addresses.",
          "isIosBackgroundLocationEnabled": true,
          "isAndroidBackgroundLocationEnabled": true
        }
      ],
      [
        "expo-image-picker",
        {
          "photosPermission": "Zhetysu Go lets you choose a profile photo or a driver document from your photo library.",
          "cameraPermission": "Zhetysu Go lets you take a profile photo or a driver document photo.",
          "microphonePermission": false
        }
      ],
      "expo-font",
      "expo-notifications"
    ]
  }
};
