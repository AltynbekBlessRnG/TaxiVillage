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
        "NSLocationWhenInUseUsageDescription": "Zhetysu Go использует геопозицию, чтобы показать вас на карте, подставить адрес подачи и доставки и найти ближайших водителей.",
        "NSLocationAlwaysAndWhenInUseUsageDescription": "Когда вы на смене как водитель или курьер, Zhetysu Go использует геопозицию, чтобы присылать заказы рядом и показывать клиенту, где вы едете, — в том числе когда приложение свёрнуто.",
        "NSLocationAlwaysUsageDescription": "Когда вы на смене как водитель или курьер, Zhetysu Go использует геопозицию, чтобы присылать заказы рядом и показывать клиенту, где вы едете, — в том числе когда приложение свёрнуто.",
        "NSPhotoLibraryUsageDescription": "Zhetysu Go открывает галерею, чтобы вы выбрали фото профиля или снимок документа водителя."
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
          "locationAlwaysAndWhenInUsePermission": "Разрешите Zhetysu Go доступ к геопозиции, пока вы на смене как водитель или курьер, — в том числе когда приложение свёрнуто.",
          "locationAlwaysPermission": "Разрешите Zhetysu Go доступ к геопозиции, пока вы на смене как водитель или курьер, — в том числе когда приложение свёрнуто.",
          "locationWhenInUsePermission": "Разрешите Zhetysu Go доступ к геопозиции, чтобы показать карту и подставить адрес подачи или доставки.",
          "isIosBackgroundLocationEnabled": true,
          "isAndroidBackgroundLocationEnabled": true
        }
      ],
      [
        "expo-image-picker",
        {
          "photosPermission": "Zhetysu Go открывает галерею, чтобы вы выбрали фото профиля или снимок документа водителя.",
          "cameraPermission": "Zhetysu Go включает камеру, чтобы вы сняли фото профиля или документ водителя.",
          "microphonePermission": false
        }
      ],
      "expo-font",
      "expo-notifications"
    ]
  }
};
