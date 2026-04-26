import type { Car, User } from "../api";

export function buildFullName(user: User): string {
  return [user.last_name, user.first_name, user.patronymic].filter(Boolean).join(" ");
}

export function getStatusTone(status: Car["status"]): string {
  switch (status) {
    case "available":
      return "success";
    case "booked":
      return "warning";
    case "in_trip":
      return "info";
    case "service":
    case "inactive":
      return "muted";
    default:
      return "default";
  }
}
