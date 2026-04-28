import { appConfig } from "../appConfig";

export type VerificationStatus = "not_requested" | "pending" | "approved" | "rejected";
export type UserRole = "user" | "admin";
export type CarStatus = "available" | "booked" | "in_trip" | "service" | "inactive";

export type User = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  patronymic: string;
  phone: string;
  driver_license_number: string;
  role: UserRole;
  verification_status: VerificationStatus;
  balance: string;
  is_blocked: boolean;
  is_verified: boolean;
  can_use_service: boolean;
  full_name?: string;
};

export type Car = {
  id: number;
  brand: string;
  model: string;
  license_plate: string;
  status: CarStatus;
  status_label: string;
  latitude: string;
  longitude: string;
  price_per_minute: string;
  created_at: string;
};

export type Booking = {
  id: number;
  user?: User;
  car: Car;
  status: "active" | "cancelled" | "completed";
  created_at: string;
  closed_at: string | null;
};

export type Trip = {
  id: number;
  user?: User;
  car: Car;
  status: "active" | "completed";
  started_at: string;
  finished_at: string | null;
  start_latitude: string;
  start_longitude: string;
  destination_latitude: string | null;
  destination_longitude: string | null;
  end_latitude: string | null;
  end_longitude: string | null;
  price_per_minute: string;
  coefficient: string;
  bonus_zone_name: string | null;
  discount_percent: string;
  total_minutes: number;
  total_price: string;
};

export type BonusZone = {
  id: number;
  name: string;
  latitude: string;
  longitude: string;
  radius_meters: number;
  discount_percent: string;
  is_active: boolean;
  created_at: string;
};

export type WalletTransaction = {
  id: number;
  transaction_type: string;
  amount: string;
  description: string;
  created_at: string;
};

export type Wallet = {
  balance: string;
  transactions: WalletTransaction[];
};

export type Tariff = {
  id: number;
  name: string;
  price_per_minute: string;
  min_start_balance: string;
};

export type TimeCoefficient = {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
  coefficient: string;
};

export type AuthResponse = {
  token: string;
  user: User;
};

export type RegisterResponse = {
  detail: string;
  user: User;
};

const API_BASE_URL = appConfig.apiBaseUrl;

type RequestOptions = {
  token?: string | null;
  method?: string;
  body?: unknown;
};

export class ApiError extends Error {
  constructor(
    public details: unknown,
    message = "Ошибка запроса",
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");

  if (options.token) {
    headers.set("Authorization", `Token ${options.token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(data);
  }

  return data as T;
}

export const api = {
  register: (body: unknown) =>
    request<RegisterResponse>("/auth/register/", {
      method: "POST",
      body,
    }),
  login: (body: unknown) =>
    request<AuthResponse>("/auth/login/", {
      method: "POST",
      body,
    }),
  logout: (token: string) =>
    request<void>("/auth/logout/", {
      method: "POST",
      token,
    }),
  me: (token: string) => request<User>("/auth/me/", { token }),
  cars: (token: string) => request<Car[]>("/cars/", { token }),
  bonusZones: (token: string) => request<BonusZone[]>("/bonus-zones/", { token }),
  booking: (token: string) => request<Booking | null>("/bookings/", { token }),
  createBooking: (token: string, carId: number) =>
    request<Booking>("/bookings/", {
      method: "POST",
      token,
      body: { car_id: carId },
    }),
  cancelBooking: (token: string, bookingId: number) =>
    request<Booking>(`/bookings/${bookingId}/cancel/`, {
      method: "POST",
      token,
    }),
  trips: (token: string) =>
    request<{ active: Trip | null; history: Trip[] }>("/trips/", { token }),
  startTrip: (token: string, carId: number, latitude: string, longitude: string) =>
    request<Trip>("/trips/start/", {
      method: "POST",
      token,
      body: { car_id: carId, latitude, longitude },
    }),
  finishTrip: (token: string, tripId: number, latitude: string, longitude: string, routeDurationMinutes?: number) =>
    request<Trip>(`/trips/${tripId}/finish/`, {
      method: "POST",
      token,
      body: { latitude, longitude, route_duration_minutes: routeDurationMinutes },
    }),
  setTripDestination: (token: string, tripId: number, latitude: string, longitude: string) =>
    request<Trip>(`/trips/${tripId}/destination/`, {
      method: "POST",
      token,
      body: { latitude, longitude },
    }),
  wallet: (token: string) => request<Wallet>("/wallet/", { token }),
  topUp: (token: string, amount: string) =>
    request<WalletTransaction>("/wallet/top-up/", {
      method: "POST",
      token,
      body: { amount },
    }),
  adminApplications: (token: string) => request<User[]>("/admin/applications/", { token }),
  adminUsers: (token: string) => request<User[]>("/admin/users/", { token }),
  adminUserAction: (token: string, userId: number, action: string) =>
    request<User>(`/admin/users/${userId}/action/`, {
      method: "POST",
      token,
      body: { action },
    }),
  adminCars: (token: string) => request<Car[]>("/admin/cars/", { token }),
  adminBookings: (token: string) => request<Booking[]>("/admin/bookings/", { token }),
  adminTrips: (token: string) => request<Trip[]>("/admin/trips/", { token }),
  adminCreateCar: (token: string, body: unknown) =>
    request<Car>("/admin/cars/", {
      method: "POST",
      token,
      body,
    }),
  adminUpdateCar: (token: string, carId: number, body: unknown) =>
    request<Car>(`/admin/cars/${carId}/`, {
      method: "PATCH",
      token,
      body,
    }),
  adminDeleteCar: (token: string, carId: number) =>
    request<void>(`/admin/cars/${carId}/`, {
      method: "DELETE",
      token,
    }),
  adminTariff: (token: string) => request<Tariff>("/admin/tariff/", { token }),
  adminUpdateTariff: (token: string, body: unknown) =>
    request<Tariff>("/admin/tariff/", {
      method: "PATCH",
      token,
      body,
    }),
  adminCoefficients: (token: string) => request<TimeCoefficient[]>("/admin/coefficients/", { token }),
  adminCreateCoefficient: (token: string, body: unknown) =>
    request<TimeCoefficient>("/admin/coefficients/", {
      method: "POST",
      token,
      body,
    }),
  adminUpdateCoefficient: (token: string, coefficientId: number, body: unknown) =>
    request<TimeCoefficient>(`/admin/coefficients/${coefficientId}/`, {
      method: "PATCH",
      token,
      body,
    }),
  adminBonusZones: (token: string) => request<BonusZone[]>("/admin/bonus-zones/", { token }),
  adminCreateBonusZone: (token: string, body: unknown) =>
    request<BonusZone>("/admin/bonus-zones/", {
      method: "POST",
      token,
      body,
    }),
  adminUpdateBonusZone: (token: string, zoneId: number, body: unknown) =>
    request<BonusZone>(`/admin/bonus-zones/${zoneId}/`, {
      method: "PATCH",
      token,
      body,
    }),
};
