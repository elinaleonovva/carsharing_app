import type { AuthForm, BonusZoneForm, CarForm, Coordinates } from "./types";

export const TOKEN_KEY = "carsharing_token";
export const BOOKING_TTL_MS = 15 * 60 * 1000;
export const MAP_MESSAGE_TIMEOUT_MS = 10_000;
export const MOSCOW_CENTER: Coordinates = [55.751244, 37.618423];

export const MKAD_POLYGON: Coordinates[] = [
  [55.9115, 37.545],
  [55.9075, 37.62],
  [55.895, 37.69],
  [55.87, 37.755],
  [55.835, 37.805],
  [55.785, 37.842],
  [55.73, 37.845],
  [55.68, 37.827],
  [55.625, 37.79],
  [55.585, 37.72],
  [55.571, 37.635],
  [55.582, 37.545],
  [55.615, 37.465],
  [55.665, 37.405],
  [55.735, 37.37],
  [55.805, 37.39],
  [55.865, 37.455],
];

export const initialAuthForm: AuthForm = {
  email: "",
  password: "",
  password_confirm: "",
  first_name: "",
  last_name: "",
  patronymic: "",
  phone: "",
  driver_license_number: "",
};

export const initialCarForm: CarForm = {
  brand: "",
  model: "",
  license_plate: "",
  status: "available",
  latitude: "55.751244",
  longitude: "37.618423",
  price_per_minute: "12.00",
};

export const initialBonusZoneForm: BonusZoneForm = {
  name: "Бонусная зона",
  latitude: "",
  longitude: "",
  radius_meters: "600",
  discount_percent: "10.00",
  is_active: true,
};
