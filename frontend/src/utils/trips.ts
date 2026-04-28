import type { Booking, Trip } from "./api";
import { BOOKING_TTL_MS } from "../constants";
import type { Coordinates } from "../types";

export function getBookingSecondsLeft(booking: Booking | null, now: number): number | null {
  if (!booking) {
    return null;
  }

  const expiresAt = new Date(booking.created_at).getTime() + BOOKING_TTL_MS;
  return Math.max(0, Math.floor((expiresAt - now) / 1000));
}

export function getTripDestination(trip: Trip | null): Coordinates | null {
  if (!trip?.destination_latitude || !trip.destination_longitude) {
    return null;
  }

  return [Number(trip.destination_latitude), Number(trip.destination_longitude)];
}

export function calculateEstimatedTripPrice(trip: Trip | null, durationMinutes: number | null): string | null {
  if (!trip || !durationMinutes) {
    return null;
  }

  const safeMinutes = Math.max(1, Math.ceil(durationMinutes));
  const total = safeMinutes * Number(trip.price_per_minute) * Number(trip.coefficient);
  return total.toFixed(2);
}
