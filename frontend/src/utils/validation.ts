import type { AuthForm, AuthMode } from "../types";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\d+$/;
const driverLicenseSeriesPattern = /^[0-9A-Za-zА-Яа-яЁё]{4}$/;

export function validateAuthForm(mode: AuthMode, form: AuthForm): string | null {
  const email = form.email.trim().toLowerCase();
  const license = form.driver_license_number.replace(/\s+/g, "").toUpperCase();

  if (!email) return "Введите email";
  if (!emailPattern.test(email)) return "Введите корректный email";

  if (mode === "login") {
    return form.password.trim() ? null : "Введите пароль";
  }

  if (!form.last_name.trim()) return "Введите фамилию";
  if (!form.first_name.trim()) return "Введите имя";
  if (!form.patronymic.trim()) return "Введите отчество";
  if (!form.phone.trim()) return "Введите номер телефона";
  if (!phonePattern.test(form.phone.trim())) return "Телефон должен содержать только цифры";
  if (form.phone.trim().length !== 11) return "Телефон должен содержать 11 цифр";
  if (!license) return "Введите номер водительского удостоверения";
  if (license.length !== 10) return "Введите номер ВУ в формате XX XX YYYYYY";

  const series = license.slice(0, 4);
  const number = license.slice(4);
  const digits = [...series].filter((char) => /\d/.test(char)).length;
  const letters = [...series].filter((char) => /[A-Za-zА-Яа-яЁё]/.test(char)).length;

  if (!driverLicenseSeriesPattern.test(series) || !/^\d{6}$/.test(number)) {
    return "Введите номер ВУ в формате XX XX YYYYYY";
  }
  if (!((digits === 4 && letters === 0) || (digits === 2 && letters === 2))) {
    return "Серия ВУ должна содержать 4 цифры или 2 цифры и 2 буквы";
  }
  if (!form.password.trim()) return "Введите пароль";
  if (form.password.length < 8) return "Пароль должен содержать минимум 8 символов";
  if (!form.password_confirm.trim()) return "Повторите пароль";
  if (form.password !== form.password_confirm) return "Пароли не совпадают";

  return null;
}
