import { FormEvent, useEffect, useState } from "react";

import { ApiError, User, api } from "./api";

type AuthMode = "login" | "register";

type AuthForm = {
  email: string;
  password: string;
  password_confirm: string;
  first_name: string;
  last_name: string;
  patronymic: string;
  phone: string;
  driver_license_number: string;
};

const TOKEN_KEY = "carsharing_token";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+?[\d\s()-]+$/;
const driverLicenseSeriesPattern = /^[0-9A-Za-zА-Яа-яЁё]{4}$/;

const initialAuthForm: AuthForm = {
  email: "",
  password: "",
  password_confirm: "",
  first_name: "",
  last_name: "",
  patronymic: "",
  phone: "",
  driver_license_number: "",
};

function normalizeMessage(message: string): string {
  return message.trim().replace(/[.!?]+$/u, "");
}

function collectMessages(value: unknown): string[] {
  if (typeof value === "string") {
    return [normalizeMessage(value)];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectMessages(item));
  }

  if (value && typeof value === "object") {
    return Object.values(value).flatMap((item) => collectMessages(item));
  }

  return [];
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const messages = collectMessages(error.details);
    if (messages.length > 0) {
      return messages.join(" ");
    }
  }

  return "Не удалось выполнить запрос Проверьте, что backend запущен";
}

function validateAuthForm(mode: AuthMode, form: AuthForm): string | null {
  const email = form.email.trim().toLowerCase();
  const phoneDigits = form.phone.replace(/\D/g, "");
  const license = form.driver_license_number.replace(/\s+/g, "").toUpperCase();

  if (!email) {
    return "Введите email";
  }

  if (!emailPattern.test(email)) {
    return "Введите корректный email";
  }

  if (mode === "login") {
    if (!form.password.trim()) {
      return "Введите пароль";
    }

    return null;
  }

  if (!form.last_name.trim()) {
    return "Введите фамилию";
  }

  if (!form.first_name.trim()) {
    return "Введите имя";
  }

  if (!form.patronymic.trim()) {
    return "Введите отчество";
  }

  if (!form.phone.trim()) {
    return "Введите номер телефона";
  }

  if (!phonePattern.test(form.phone.trim())) {
    return "Введите корректный номер телефона";
  }

  if (phoneDigits.length < 10 || phoneDigits.length > 15) {
    return "Номер телефона должен содержать от 10 до 15 цифр";
  }

  if (!license) {
    return "Введите номер водительского удостоверения";
  }

  if (license.length !== 10) {
    return "Введите номер водительского удостоверения в формате XX XX YYYYYY";
  }

  const licenseSeries = license.slice(0, 4);
  const licenseNumber = license.slice(4);
  const seriesDigitCount = [...licenseSeries].filter((char) => /\d/.test(char)).length;
  const seriesLetterCount = [...licenseSeries].filter((char) => /[A-Za-zА-Яа-яЁё]/.test(char)).length;

  if (!driverLicenseSeriesPattern.test(licenseSeries) || !/^\d{6}$/.test(licenseNumber)) {
    return "Введите номер водительского удостоверения в формате XX XX YYYYYY";
  }

  if (
    !(
      (seriesDigitCount === 4 && seriesLetterCount === 0) ||
      (seriesDigitCount === 2 && seriesLetterCount === 2)
    )
  ) {
    return "Серия ВУ должна содержать 4 цифры или 2 цифры и 2 буквы";
  }

  if (!form.password.trim()) {
    return "Введите пароль";
  }

  if (form.password.length < 8) {
    return "Пароль должен содержать не менее 8 символов";
  }

  if (!form.password_confirm.trim()) {
    return "Повторите пароль";
  }

  if (form.password !== form.password_confirm) {
    return "Пароли не совпадают";
  }

  return null;
}

function App() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(null);
  const [authForm, setAuthForm] = useState<AuthForm>(initialAuthForm);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }

    setIsLoading(true);
    api
      .me(token)
      .then((profile) => {
        setUser(profile);
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      })
      .finally(() => setIsLoading(false));
  }, [token]);

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");

    const validationError = validateAuthForm(mode, authForm);
    if (validationError) {
      setMessage(validationError);
      return;
    }

    setIsLoading(true);

    try {
      const response =
        mode === "login"
          ? await api.login({
              email: authForm.email.trim().toLowerCase(),
              password: authForm.password,
            })
          : await api.register({
              email: authForm.email.trim().toLowerCase(),
              password: authForm.password,
              password_confirm: authForm.password_confirm,
              first_name: authForm.first_name.trim(),
              last_name: authForm.last_name.trim(),
              patronymic: authForm.patronymic.trim(),
              phone: authForm.phone.trim(),
              driver_license_number: authForm.driver_license_number.trim(),
            });

      localStorage.setItem(TOKEN_KEY, response.token);
      setToken(response.token);
      setUser(response.user);
      setAuthForm(initialAuthForm);
      setMessage(mode === "login" ? "Вход выполнен" : "");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    if (token) {
      await api.logout(token).catch(() => undefined);
    }

    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setMessage("");
  };

  return (
    <main className="app-shell">
      <section className="intro-panel">
        <div className="brand-row">
          <span className="brand-mark">CS</span>
          <span className="brand-name">Carsharing Platform</span>
        </div>
        <div className="intro-copy">
          <h1>Доступ к городскому автопарку</h1>
          <p>Для доступа к сервису нужно зарегистрироваться и подтвердить аккаунт</p>
        </div>
      </section>

      <section className="work-panel">
        {!user ? (
          <div className="auth-card">
            <div className="mode-switch" role="tablist" aria-label="Выбор формы">
              <button
                className={mode === "login" ? "active" : ""}
                type="button"
                onClick={() => setMode("login")}
              >
                Вход
              </button>
              <button
                className={mode === "register" ? "active" : ""}
                type="button"
                onClick={() => setMode("register")}
              >
                Регистрация
              </button>
            </div>

            <form className="form-stack" onSubmit={handleAuthSubmit}>
              {mode === "login" ? (
                <>
                  <label>
                    Email
                    <input
                      value={authForm.email}
                      onChange={(event) =>
                        setAuthForm((form) => ({ ...form, email: event.target.value }))
                      }
                      type="email"
                      autoComplete="email"
                      placeholder="name@example.com"
                      required
                    />
                  </label>
                  <label>
                    Пароль
                    <input
                      value={authForm.password}
                      onChange={(event) =>
                        setAuthForm((form) => ({ ...form, password: event.target.value }))
                      }
                      type="password"
                      autoComplete="current-password"
                      required
                    />
                  </label>
                </>
              ) : (
                <>
                  <label>
                    Email
                    <input
                      value={authForm.email}
                      onChange={(event) =>
                        setAuthForm((form) => ({ ...form, email: event.target.value }))
                      }
                      type="email"
                      autoComplete="email"
                      placeholder="name@example.com"
                      required
                    />
                  </label>
                  <div className="two-columns">
                    <label>
                      Фамилия
                      <input
                        value={authForm.last_name}
                        onChange={(event) =>
                          setAuthForm((form) => ({ ...form, last_name: event.target.value }))
                        }
                        autoComplete="family-name"
                        required
                      />
                    </label>
                    <label>
                      Имя
                      <input
                        value={authForm.first_name}
                        onChange={(event) =>
                          setAuthForm((form) => ({ ...form, first_name: event.target.value }))
                        }
                        autoComplete="given-name"
                        required
                      />
                    </label>
                  </div>
                  <label>
                    Отчество
                    <input
                      value={authForm.patronymic}
                      onChange={(event) =>
                        setAuthForm((form) => ({ ...form, patronymic: event.target.value }))
                      }
                      autoComplete="additional-name"
                      required
                    />
                  </label>
                  <label>
                    Телефон
                    <input
                      value={authForm.phone}
                      onChange={(event) =>
                        setAuthForm((form) => ({ ...form, phone: event.target.value }))
                      }
                      autoComplete="tel"
                      placeholder="+7 999 000-11-22"
                      required
                    />
                  </label>
                  <label>
                    Номер водительского удостоверения
                    <input
                      value={authForm.driver_license_number}
                      onChange={(event) =>
                        setAuthForm((form) => ({
                          ...form,
                          driver_license_number: event.target.value,
                        }))
                      }
                      placeholder="12 34 123456"
                      required
                    />
                  </label>
                  <div className="two-columns">
                    <label>
                      Пароль
                      <input
                        value={authForm.password}
                        onChange={(event) =>
                          setAuthForm((form) => ({ ...form, password: event.target.value }))
                        }
                        type="password"
                        autoComplete="new-password"
                        required
                      />
                    </label>
                    <label>
                      Повтор пароля
                      <input
                        value={authForm.password_confirm}
                        onChange={(event) =>
                          setAuthForm((form) => ({
                            ...form,
                            password_confirm: event.target.value,
                          }))
                        }
                        type="password"
                        autoComplete="new-password"
                        required
                      />
                    </label>
                  </div>
                </>
              )}

              <button className="primary-button" disabled={isLoading} type="submit">
                {isLoading ? "Подождите..." : mode === "login" ? "Войти" : "Создать аккаунт"}
              </button>
            </form>
          </div>
        ) : (
          <div className="status-card">
            <span className="eyebrow">Статус заявки</span>
            <h2>{user.can_use_service ? "Доступ открыт" : "Ваша заявка отправлена"}</h2>
            <p>
              {user.can_use_service
                ? "Администратор подтвердил данные, можно переходить к сервису"
                : "Дождитесь, пока администратор проверит данные и откроет доступ"}
            </p>
            <button className="ghost-button" type="button" onClick={handleLogout}>
              Выйти
            </button>
          </div>
        )}

        {message && <p className="message">{message}</p>}
      </section>
    </main>
  );
}

export default App;
