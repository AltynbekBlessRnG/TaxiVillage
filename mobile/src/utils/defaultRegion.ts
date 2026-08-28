/**
 * Where the map looks before it knows where the person is.
 *
 * The app serves Usharal and the Alakol district; a default of Almaty put the
 * first frame nine hundred kilometres from every user the app has, and that is
 * what a reviewer or a first-time user sees while the location fix arrives.
 */
export const DEFAULT_LOCATION = {
  lat: 46.1725,
  lng: 80.9333,
};
