export type VerificationStatus =
  | "not_requested"
  | "pending"
  | "approved"
  | "rejected";

export type UserRole = "user" | "admin";

export type User = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: UserRole;
  verification_status: VerificationStatus;
  balance: string;
  is_blocked: boolean;
  is_verified: boolean;
  can_use_service: boolean;
};

export type AuthResponse = {
  token: string;
  user: User;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

type RequestOptions = {
  token?: string | null;
  method?: string;
  body?: unknown;
};

export class ApiError extends Error {
  constructor(public details: unknown, message = "Ошибка запроса") {
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
    request<AuthResponse>("/auth/register/", {
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
  me: (token: string) =>
    request<User>("/auth/me/", {
      token,
    }),
  updateMe: (token: string, body: unknown) =>
    request<User>("/auth/me/", {
      method: "PATCH",
      token,
      body,
    }),
  requestVerification: (token: string) =>
    request<{ status: VerificationStatus; user: User }>("/auth/verification-request/", {
      method: "POST",
      token,
    }),
};
