import type { BonusZone, Car } from "./api";

export type Coordinates = [number, number];
export type AuthMode = "login" | "register";
export type UserTab = "map" | "wallet" | "activity";
export type AdminTab =
  | "map"
  | "wallet"
  | "activity"
  | "users"
  | "applications"
  | "fleet"
  | "bookings"
  | "trips"
  | "tariff"
  | "zones";

export type RouteSummary = {
  distanceKm: number | null;
  durationMinutes: number | null;
};

export type AuthForm = {
  email: string;
  password: string;
  password_confirm: string;
  first_name: string;
  last_name: string;
  patronymic: string;
  phone: string;
  driver_license_number: string;
};

export type CarForm = {
  id: string;
  brand: string;
  model: string;
  license_plate: string;
  status: string;
  latitude: string;
  longitude: string;
  price_per_minute: string;
  created_at: string;
};

export type BonusZoneForm = {
  name: string;
  latitude: string;
  longitude: string;
  radius_meters: string;
  discount_percent: string;
  is_active: boolean;
};

export type FleetMapProps = {
  cars: Car[];
  selectedCarId: number | null;
  onCarSelect: (carId: number) => void;
  userLocation?: Coordinates | null;
  onUserLocationChange?: (coords: Coordinates) => void;
  routeCar?: Car | null;
  destinationLocation?: Coordinates | null;
  onDestinationLocationChange?: (coords: Coordinates) => void;
  routeFrom?: Coordinates | null;
  onRouteSummaryChange?: (summary: RouteSummary) => void;
  bonusZones?: BonusZone[];
  onBonusZoneCenterChange?: (coords: Coordinates) => void;
};
