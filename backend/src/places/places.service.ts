import { Injectable } from '@nestjs/common';
import { PlaceKind, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** How close a POI has to be before we name it instead of the street. */
const POI_NAMING_RADIUS_M = 150;
/** Past this, a street name is guesswork rather than an address. */
const STREET_NAMING_RADIUS_M = 400;
/** Widest ring we bother searching at all. */
const MAX_SEARCH_RADIUS_M = 1000;

export interface NearestPlace {
  id: string;
  name: string;
  kind: PlaceKind;
  category: string | null;
  lat: number;
  lng: number;
  distanceM: number;
}

export interface NearestPlaceAnswer {
  /** Ready to show as the address, or null when nothing is close enough. */
  label: string | null;
  place: NearestPlace | null;
  street: NearestPlace | null;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.sqrt(a));
}

@Injectable()
export class PlacesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The name of whatever is closest to a dropped pin.
   *
   * Google answers a point in Usharal with a Plus Code - "7PF8+4CDJ" - which
   * tells a driver nothing. A named shop, or failing that a named street, is
   * what people actually say out loud.
   */
  async findNearest(lat: number, lng: number): Promise<NearestPlaceAnswer> {
    const candidates = await this.loadCandidates(lat, lng, MAX_SEARCH_RADIUS_M);

    const withDistance = candidates
      .map((place) => ({
        id: place.id,
        name: place.name,
        kind: place.kind,
        category: place.category,
        lat: place.lat,
        lng: place.lng,
        distanceM: Math.round(haversineMeters(lat, lng, place.lat, place.lng)),
      }))
      .sort((a, b) => a.distanceM - b.distanceM);

    const place =
      withDistance.find((item) => item.kind === PlaceKind.POI) ?? null;
    const street =
      withDistance.find((item) => item.kind === PlaceKind.STREET) ?? null;

    return {
      label: this.buildLabel(place, street),
      place,
      street,
    };
  }

  async search(query: string, limit = 10) {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return [];
    }

    return this.prisma.place.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: trimmed, mode: 'insensitive' } },
          { aliases: { has: trimmed.toLowerCase() } },
        ],
      },
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
      take: Math.min(limit, 25),
    });
  }

  private buildLabel(place: NearestPlace | null, street: NearestPlace | null) {
    if (place && place.distanceM <= POI_NAMING_RADIUS_M) {
      // Close enough that "at" is honest; further out it would mislead.
      return place.distanceM <= 40 ? place.name : `возле ${place.name}`;
    }

    if (street && street.distanceM <= STREET_NAMING_RADIUS_M) {
      return street.name;
    }

    if (place && place.distanceM <= MAX_SEARCH_RADIUS_M) {
      return `возле ${place.name}`;
    }

    return null;
  }

  /**
   * Narrows by bounding box in the database, then measures properly in JS.
   * A village holds a few hundred rows, so this stays cheap and avoids
   * needing PostGIS for a trigonometric ORDER BY.
   */
  private async loadCandidates(lat: number, lng: number, radiusM: number) {
    const latDelta = radiusM / 111_320;
    // Longitude degrees shrink with latitude; guard against the poles so the
    // divisor can never reach zero.
    const lngDelta = radiusM / (111_320 * Math.max(0.01, Math.cos((lat * Math.PI) / 180)));

    const where: Prisma.PlaceWhereInput = {
      isActive: true,
      lat: { gte: lat - latDelta, lte: lat + latDelta },
      lng: { gte: lng - lngDelta, lte: lng + lngDelta },
    };

    return this.prisma.place.findMany({ where, take: 500 });
  }
}
