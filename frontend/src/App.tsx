import { FormEvent, useEffect, useState } from "react";

import { ApiError, User, api } from "./api";

type AuthMode = "login" | "register";

type AuthForm = {
  email: string;
  password: string;
  password_confirm: string;
  first_name: string;
  last_name: string;
  phone: string;
};

type ProfileForm = Pick<User, "email" | "first_name" | "last_name" | "phone">;

const TOKEN_KEY = "carsharing_token";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const initialAuthForm: AuthForm = {
  email: "",
  password: "",
  password_confirm: "",
  first_name: "",
  last_name: "",
  phone: "",
};

const verificationLabels: Record<User["verification_status"], string> = {
  not_requested: "Заявка не отправлена",
  pending: "На проверке",
  approved: "Одобрен",
  rejected: "Отклонен",
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
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    email: "",
    first_name: "",
    last_name: "",
    phone: "",
  });
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
        setProfileForm({
          email: profile.email,
          first_name: profile.first_name,
          last_name: profile.last_name,
          phone: profile.phone,
        });
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
              phone: authForm.phone.trim(),
            });

      localStorage.setItem(TOKEN_KEY, response.token);
      setToken(response.token);
      setUser(response.user);
      setProfileForm({
        email: response.user.email,
        first_name: response.user.first_name,
        last_name: response.user.last_name,
        phone: response.user.phone,
      });
      setAuthForm(initialAuthForm);
      setMessage(mode === "login" ? "Вход выполнен" : "Аккаунт создан");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const profile = await api.updateMe(token, profileForm);
      setUser(profile);
      setMessage("Профиль обновлен");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerificationRequest = async () => {
    if (!token) {
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const response = await api.requestVerification(token);
      setUser(response.user);
      setMessage("Заявка отправлена администратору");
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
                      Имя
                      <input
                        value={authForm.first_name}
                        onChange={(event) =>
                          setAuthForm((form) => ({ ...form, first_name: event.target.value }))
                        }
                        autoComplete="given-name"
                      />
                    </label>
                    <label>
                      Фамилия
                      <input
                        value={authForm.last_name}
                        onChange={(event) =>
                          setAuthForm((form) => ({ ...form, last_name: event.target.value }))
                        }
                        autoComplete="family-name"
                      />
                    </label>
                  </div>
                  <label>
                    Телефон
                    <input
                      value={authForm.phone}
                      onChange={(event) =>
                        setAuthForm((form) => ({ ...form, phone: event.target.value }))
                      }
                      autoComplete="tel"
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
          <div className="dashboard">
            <header className="dashboard-header">
              <div>
                <span className="eyebrow">Личный кабинет</span>
                <h2>{user.first_name || user.email}</h2>
              </div>
              <button className="ghost-button" type="button" onClick={handleLogout}>
                Выйти
              </button>
            </header>

            <div className="status-strip">
              <div>
                <span>Роль</span>
                <strong>{user.role === "admin" ? "Администратор" : "Пользователь"}</strong>
              </div>
              <div>
                <span>Проверка</span>
                <strong>{verificationLabels[user.verification_status]}</strong>
              </div>
              <div>
                <span>Доступ к сервису</span>
                <strong>{user.can_use_service ? "Разрешен" : "Ожидает подтверждения"}</strong>
              </div>
            </div>

            <form className="form-stack" onSubmit={handleProfileSubmit}>
              <div className="two-columns">
                <label>
                  Email
                  <input
                    value={profileForm.email}
                    onChange={(event) =>
                      setProfileForm((form) => ({ ...form, email: event.target.value }))
                    }
                    type="email"
                  />
                </label>
                <label>
                  Телефон
                  <input
                    value={profileForm.phone}
                    onChange={(event) =>
                      setProfileForm((form) => ({ ...form, phone: event.target.value }))
                    }
                  />
                </label>
              </div>
              <div className="two-columns">
                <label>
                  Имя
                  <input
                    value={profileForm.first_name}
                    onChange={(event) =>
                      setProfileForm((form) => ({ ...form, first_name: event.target.value }))
                    }
                  />
                </label>
                <label>
                  Фамилия
                  <input
                    value={profileForm.last_name}
                    onChange={(event) =>
                      setProfileForm((form) => ({ ...form, last_name: event.target.value }))
                    }
                  />
                </label>
              </div>
              <div className="button-row">
                <button className="primary-button" disabled={isLoading} type="submit">
                  Сохранить профиль
                </button>
                <button
                  className="secondary-button"
                  disabled={isLoading || user.verification_status === "approved"}
                  type="button"
                  onClick={handleVerificationRequest}
                >
                  Отправить заявку
                </button>
              </div>
            </form>
          </div>
        )}

        {message && <p className="message">{message}</p>}
      </section>
    </main>
  );
}

export default App;
