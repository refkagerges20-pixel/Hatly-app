import type { Zone } from './supabase';

export interface Coordinates {
  lat: number;
  lng: number;
}

// Accurate center coordinates for Minya Governorate zones
const ZONE_COORDS_BY_NAME: Record<string, Coordinates> = {
  'مدينة المنيا': { lat: 28.1099, lng: 30.7503 },
  'المنيا الجديدة': { lat: 28.0815, lng: 30.8225 },
  'بني مزار': { lat: 28.496, lng: 30.802 },
  'مطاي': { lat: 28.419, lng: 30.779 },
  'سمالوط': { lat: 28.312, lng: 30.71 },
  'ملوي': { lat: 27.7314, lng: 30.8417 },
  'دير مواس': { lat: 27.641, lng: 30.849 },
  'أبو قرقاص': { lat: 27.931, lng: 30.836 },
  'العدوة': { lat: 28.698, lng: 30.614 },
  'مغاغة': { lat: 28.648, lng: 30.842 },
};

const ZONE_COORDS_BY_ID: Record<string, Coordinates> = {
  '7dbfe2fb-eaf1-4657-9662-c352bc7051a5': { lat: 28.1099, lng: 30.7503 },
  'bff61200-f0e9-406f-aa2a-c38f20cda630': { lat: 28.0815, lng: 30.8225 },
};

export const DEFAULT_MINYA_CENTER: Coordinates = { lat: 28.1099, lng: 30.7503 };

export function getZoneCenter(zone: Zone): Coordinates {
  if (typeof zone.latitude === 'number' && typeof zone.longitude === 'number') {
    return { lat: zone.latitude, lng: zone.longitude };
  }
  if (ZONE_COORDS_BY_NAME[zone.name]) {
    return ZONE_COORDS_BY_NAME[zone.name];
  }
  if (ZONE_COORDS_BY_ID[zone.id]) {
    return ZONE_COORDS_BY_ID[zone.id];
  }
  return DEFAULT_MINYA_CENTER;
}

/**
 * Pure TypeScript Haversine formula returning great-circle distance in kilometers.
 */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Finds the closest active zone using Haversine distance from the dropped pin.
 */
export function detectNearestZone(
  lat: number,
  lng: number,
  zones: Zone[]
): { zone: Zone; distanceKm: number } | null {
  if (!zones || zones.length === 0) return null;

  let bestZone = zones[0];
  let bestDist = Number.POSITIVE_INFINITY;

  for (const zone of zones) {
    const center = getZoneCenter(zone);
    const dist = haversineDistanceKm(lat, lng, center.lat, center.lng);
    if (dist < bestDist) {
      bestDist = dist;
      bestZone = zone;
    }
  }

  return {
    zone: bestZone,
    distanceKm: Number(bestDist.toFixed(2)),
  };
}
