import type { AuthForm, AuthMode } from "../types";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const personNamePattern = /^[A-Za-zА-Яа-яЁё]+(?:[ -][A-Za-zА-Яа-яЁё]+)*$/;
const phonePattern = /^\d+$/;
const driverLicenseSeriesPattern = /^[0-9A-Za-zА-Яа-яЁё]{4}$/;

export function normalizePersonNameInput(value: string): string {
  return value.replace(/[^A-Za-zА-Яа-яЁё -]+/g, "").replace(/\s{2,}/g, " ");
}

export function normalizePhoneInput(value: string): string {
  return value.replace(/\D+/g, "").slice(0, 11);
}

export function normalizeDriverLicenseInput(value: string): string {
  const compact = value.replace(/[^0-9A-Za-zА-Яа-яЁё]+/g, "").toUpperCase().slice(0, 10);
  const series = compact.slice(0, 4);
  const number = compact.slice(4);

  if (compact.length <= 2) {
    return compact;
  }

  if (compact.length <= 4) {
    return `${series.slice(0, 2)} ${series.slice(2)}`;
  }

  return `${series.slice(0, 2)} ${series.slice(2)} ${number}`.trim();
}

export function validateAuthForm(mode: AuthMode, form: AuthForm): string | null {
  const email = form.email.trim().toLowerCase();
  const firstName = form.first_name.trim();
  const lastName = form.last_name.trim();
  const patronymic = form.patronymic.trim();
  const license = form.driver_license_number.replace(/\s+/g, "").toUpperCase();

  if (!email) return "Введите email";
  if (!emailPattern.test(email)) return "Введите корректный email";

  if (mode === "login") {
    return form.password.trim() ? null : "Введите пароль";
  }

  if (!lastName) return "Введите фамилию";
  if (!personNamePattern.test(lastName)) return "Фамилия может содержать только буквы, пробел и дефис";
  if (!firstName) return "Введите имя";
  if (!personNamePattern.test(firstName)) return "Имя может содержать только буквы, пробел и дефис";
  if (!patronymic) return "Введите отчество";
  if (!personNamePattern.test(patronymic)) return "Отчество может содержать только буквы, пробел и дефис";
  if (!form.phone.trim()) return "Введите номер телефона";
  if (!phonePattern.test(form.phone.trim())) return "Телефон должен содержать только цифры";
  if (form.phone.trim().length !== 11) return "Телефон должен содержать 11 цифр";
  if (!license) return "Введите номер водительского удостоверения";
  if (license.length !== 10) return "Введите номер ВУ в формате XX XX YYYYYY";

  const series = license.slice(0, 4);
  const number = license.slice(4);
  const isDigitSeries = /^\d{4}$/.test(series);
  const isMixedSeries = /^\d{2}[A-Za-zА-Яа-яЁё]{2}$/.test(series);

  if (!driverLicenseSeriesPattern.test(series) || !/^\d{6}$/.test(number)) {
    return "Введите номер ВУ в формате XX XX YYYYYY";
  }
  if (!(isDigitSeries || isMixedSeries)) {
    return "Серия ВУ должна содержать 4 цифры или 2 цифры и 2 буквы";
  }
  if (!form.password.trim()) return "Введите пароль";
  if (!form.password_confirm.trim()) return "Повторите пароль";
  if (form.password !== form.password_confirm) return "Пароли не совпадают";

  return null;
}
