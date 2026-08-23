// The map sits under panels painted #09090B with #18181B cards, so the ground
// has to be a step lighter than those or the sheet stops reading as something
// laid over a map. Roads then need a clear step above the ground: this is a
// village, POI and transit are off, and the road network is the whole picture.
export const darkMinimalMapStyle = [
  {
    elementType: 'geometry',
    stylers: [{ color: '#1B1C20' }],
  },
  {
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#111114' }],
  },
  {
    elementType: 'labels.text.fill',
    stylers: [{ color: '#A1A1AA' }],
  },
  {
    featureType: 'administrative',
    elementType: 'geometry',
    stylers: [{ color: '#3A3D45' }],
  },
  {
    featureType: 'administrative.land_parcel',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'administrative.neighborhood',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#1E2A21' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#33353C' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry',
    stylers: [{ color: '#41444C' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#4E525C' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#2A2C33' }],
  },
  {
    featureType: 'transit',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#12283C' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#7C8FA3' }],
  },
];
