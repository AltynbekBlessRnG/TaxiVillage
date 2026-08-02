# TaxiVillage — App Store release checklist

## 1. Build configuration

- Build with the current EAS production image and verify the build log uses Xcode 26 / iOS 26 SDK or newer.
- Expo SDK 55 / React Native 0.83 targets Android API 36; verify `targetSdkVersion=36` in the EAS build log.
- Configure `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_LEGAL_BASE_URL` in the EAS production environment.
- Configure APNs credentials with `eas credentials`.
- Keep `mobile/android` excluded by `.easignore`; EAS then uses Prebuild/CNG and applies `app.config.js` to the generated iOS project. Generate and commit `ios/` only if the team later moves to a manually maintained native iOS project on macOS.
- Run `npx expo config --type public` and verify the bundle ID is `com.taxivillage.app`.
- Upload the build to TestFlight and resolve every privacy-manifest email from Apple before review.

## 2. App Review accounts

Create three dedicated phone numbers that are never assigned to real customers. On Render set:

```env
APP_REVIEW_LOGIN_ENABLED=true
APP_REVIEW_PHONES=+77000000001,+77000000002,+77000000003
APP_REVIEW_PASSWORD=<unique 12+ character password>
APP_REVIEW_PASSENGER_PHONE=+77000000001
APP_REVIEW_DRIVER_PHONE=+77000000002
APP_REVIEW_MERCHANT_PHONE=+77000000003
```

Provision or reset those accounts from the backend service shell:

```powershell
npm run app-review:provision
```

Configure the same phone list in the EAS production build:

```env
EXPO_PUBLIC_APP_REVIEW_PHONES=+77000000001,+77000000002,+77000000003
```

The password is deliberately not embedded in the app. The review endpoint accepts only the allowlisted phones, requires their password, is rate-limited, and can be disabled after approval without releasing a new build.

## 3. Suggested App Review notes

TaxiVillage is a local marketplace for physical services: taxi rides, courier delivery, intercity rides, and orders from local venues. No digital content is sold.

Normal customer login uses Telegram phone verification. The dedicated review accounts listed below skip Telegram verification so App Review can inspect all roles.

- Passenger: `<phone>` / `<password>`
- Driver/Courier: `<phone>` / `<password>`
- Merchant: `<phone>` / `<password>`

Test paths:

1. Passenger: open the map, enter an address manually or allow foreground location, inspect Food and Intercity, open Profile.
2. Driver: open Profile, switch Taxi/Courier/Intercity capabilities, inspect Documents and Balance. Background location is requested only after the driver explicitly goes online.
3. Merchant: edit venue information, inspect menu management and incoming orders.
4. Passenger food: place a cash/Kaspi order without opening WhatsApp.
5. Merchant: accept, start preparation, then start driver search.
6. Driver: open Food Delivery, claim the order, arrive, pick it up and deliver it.
7. Account deletion is available at the bottom of every role profile.
8. Hold another user's chat message to report it or block the sender.

Backend services remain online during review. Support: `support@taxivillage.app`.

## 4. App Privacy answers

Confirm against the production build and every integrated SDK. Expected declarations:

| Data type | Linked to user | Tracking | Purpose |
| --- | --- | --- | --- |
| Name, phone, user ID | Yes | No | App Functionality, Account Management |
| Precise location | Yes | No | App Functionality |
| Photos and driver documents | Yes | No | App Functionality |
| Messages | Yes | No | App Functionality, Safety |
| Orders and ride history | Yes | No | App Functionality |
| Push token / device identifier | Yes | No | App Functionality |
| Server diagnostics, if retained | Usually no | No | Analytics / App Functionality |

Privacy policy URL: `https://taxivillage-docs-xp2f.onrender.com/privacy-policy.html`

Support URL: `https://taxivillage-docs-xp2f.onrender.com/support.html`

## 5. TestFlight acceptance pass

- Fresh install and registration.
- Login and token refresh for every role.
- Deny location and enter an address manually.
- Driver online flow with foreground/background transitions.
- Kill and reopen during an active ride/order.
- Offline/reconnect behavior.
- Push while foregrounded, backgrounded, and terminated.
- Photo/document picker denial and approval.
- Report and block a chat message.
- Delete each account type and verify the deleted credentials cannot log in.
- Test on a small supported iPhone and a current large iPhone.

## 6. App Store metadata

- Name and subtitle in Russian and Kazakh if both audiences are supported.
- At least one real in-app screenshot; recommended: map/order, local venues, intercity, driver mode, merchant dashboard.
- Do not use only login or splash screens.
- Complete age rating, content rights, export compliance, DSA trader status, and regional availability.
- Use manual release after approval for version 1.0.

## 7. Google Play production access

- Create and verify the Play Console account immediately.
- For a new personal account, keep at least 12 testers opted into the closed test
  continuously for 14 days.
- Upload an AAB built with Android API 36.
- Complete Data Safety using `google-play-data-safety.md`.
- Complete the background-location declaration and attach the disclosure demo video.
- Use `store-metadata-ru.md` for the first Russian listing.
