import type { Car } from "../api";
import { MKAD_POLYGON } from "../constants";
import type { Coordinates } from "../types";

export function getCarCoords(car: Car): Coordinates {
  return [Number(car.latitude), Number(car.longitude)];
}

export function getCoordinatesLabel(coords: Coordinates | null): string {
  if (!coords) {
    return "Точка еще не выбрана";
  }

  return `${coords[0].toFixed(6)}, ${coords[1].toFixed(6)}`;
}

export function toApiCoordinate(value: number): string {
  return value.toFixed(6);
}

export function isInsideMkad(coords: Coordinates): boolean {
  const [lat, lon] = coords;
  let inside = false;

  for (let i = 0, j = MKAD_POLYGON.length - 1; i < MKAD_POLYGON.length; j = i++) {
    const [latI, lonI] = MKAD_POLYGON[i];
    const [latJ, lonJ] = MKAD_POLYGON[j];
    const intersects = lonI > lon !== lonJ > lon && lat < ((latJ - latI) * (lon - lonI)) / (lonJ - lonI) + latI;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

export function calculateDistanceKm(from: Coordinates | null, to: Coordinates | null): number | null {
  if (!from || !to) {
    return null;
  }

  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(to[0] - from[0]);
  const dLon = toRad(to[1] - from[1]);
  const lat1 = toRad(from[0]);
  const lat2 = toRad(to[0]);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Number((earthRadiusKm * c).toFixed(1));
}

export function getCarPreset(car: Car, selectedCarId: number | null): string {
  if (car.id === selectedCarId) {
    return "islands#orangeCircleDotIcon";
  }

  switch (car.status) {
    case "available":
      return "islands#greenCircleDotIcon";
    case "booked":
      return "islands#yellowCircleDotIcon";
    case "in_trip":
      return "islands#blueCircleDotIcon";
    default:
      return "islands#grayCircleDotIcon";
  }
}
