# Mobile Reconnect Checklist

Use this checklist on the dev build after the backend and Redis are running.

## Goal
- Verify that a driver in an active taxi ride can lose connectivity, reconnect, and recover the active ride state without a manual relogin.

## Setup
1. Start backend with Redis enabled.
2. Start the mobile dev build.
3. Log in as passenger on one device or session.
4. Log in as driver on another device or session.
5. Create and accept a taxi ride so the driver is already in an active ride.

## Test steps
1. Confirm the driver sees the active ride in `DriverHome`.
2. Confirm the passenger sees the active ride in `PassengerHome`.
3. On the driver device, disable internet completely.
4. Wait until the socket is effectively disconnected.
5. Keep the app open and idle for 10-15 seconds.
6. Re-enable internet.
7. Wait for the app socket to reconnect.
8. If the access token expired during the interruption, confirm the app refreshes the token and does not force a manual logout.
9. Confirm the driver returns to the active ride state in `DriverHome`.
10. Confirm the driver can still open chat and continue status transitions.
11. Confirm the passenger still receives ride status updates.

## Expected results
- The app socket reconnects automatically.
- The driver is not forced to log in again if refresh succeeds.
- `DriverHome` restores the active ride from Redis or DB recovery.
- The passenger and driver continue receiving realtime ride updates.
- After reconnect, `GET /api/drivers/current-ride` still matches the active ride until it is completed or canceled.

## Failure signals
- Driver lands on an empty home screen while a ride is still active.
- Socket reconnects but the active ride is missing.
- Token expiry during reconnect forces an unnecessary logout.
- Passenger stops receiving updates after the driver reconnects.
