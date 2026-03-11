import { gql } from '@apollo/client';

export const GET_RIDES = gql`
  query GetRides($userId: String!) {
    rides(userId: $userId) {
      id
      status
      fromAddress
      toAddress
      fromLat
      fromLng
      toLat
      toLng
      paymentMethod
      estimatedPrice
      finalPrice
      createdAt
      passenger {
        id
        fullName
      }
      driver {
        id
        fullName
        rating
        car {
          make
          model
          color
          plateNumber
        }
      }
      tariff {
        id
        name
        baseFare
        pricePerKm
        pricePerMinute
      }
      stops {
        id
        address
        lat
        lng
        createdAt
      }
    }
  }
`;

export const GET_RIDE = gql`
  query GetRide($id: String!) {
    ride(id: $id) {
      id
      status
      fromAddress
      toAddress
      fromLat
      fromLng
      toLat
      toLng
      paymentMethod
      estimatedPrice
      finalPrice
      createdAt
      startedAt
      finishedAt
      passenger {
        id
        fullName
      }
      driver {
        id
        fullName
        rating
        car {
          make
          model
          color
          plateNumber
        }
      }
      tariff {
        id
        name
        baseFare
        pricePerKm
        pricePerMinute
      }
      stops {
        id
        address
        lat
        lng
        createdAt
      }
    }
  }
`;

export const CREATE_RIDE = gql`
  mutation CreateRide(
    $passengerId: String!
    $fromAddress: String!
    $toAddress: String!
    $fromLat: Int
    $fromLng: Int
    $toLat: Int
    $toLng: Int
    $paymentMethod: String
    $stops: [StopInput]
  ) {
    createRide(
      passengerId: $passengerId
      fromAddress: $fromAddress
      toAddress: $toAddress
      fromLat: $fromLat
      fromLng: $fromLng
      toLat: $toLat
      toLng: $toLng
      paymentMethod: $paymentMethod
      stops: $stops
    ) {
      id
      status
      estimatedPrice
    }
  }
`;

export const GET_DRIVERS = gql`
  query GetDrivers {
    drivers {
      id
      fullName
      rating
      isOnline
      lat
      lng
      car {
        make
        model
        color
        plateNumber
      }
    }
  }
`;
