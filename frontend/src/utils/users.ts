import type { Car, User, VerificationStatus } from "./api";

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

export function getVerificationStatusLabel(status: VerificationStatus): string {
  switch (status) {
    case "pending":
      return "на рассмотрении";
    case "approved":
      return "одобрена";
    case "rejected":
      return "отклонена";
    case "not_requested":
      return "не отправлена";
    default:
      return status;
  }
}
