import { FormEvent, useEffect, useState } from "react";

import { ApiError, Booking, Car, Tariff, Trip, User, Wallet, api } from "./api";

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

type CarForm = {
  brand: string;
  model: string;
  license_plate: string;
  status: string;
  latitude: string;
  longitude: string;
};

const TOKEN_KEY = "carsharing_token";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\d+$/;
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

const initialCarForm: CarForm = {
  brand: "",
  model: "",
  license_plate: "",
  status: "available",
  latitude: "55.751244",
  longitude: "37.618423",
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
  if (!phonePattern.test(form.phone.trim())) return "Номер телефона должен содержать только цифры";
  if (form.phone.trim().length !== 11) return "Номер телефона должен содержать 11 цифр";
  if (!license) return "Введите номер водительского удостоверения";
  if (license.length !== 10) return "Введите номер водительского удостоверения в формате XX XX YYYYYY";

  const series = license.slice(0, 4);
  const number = license.slice(4);
  const digits = [...series].filter((char) => /\d/.test(char)).length;
  const letters = [...series].filter((char) => /[A-Za-zА-Яа-яЁё]/.test(char)).length;

  if (!driverLicenseSeriesPattern.test(series) || !/^\d{6}$/.test(number)) {
    return "Введите номер водительского удостоверения в формате XX XX YYYYYY";
  }
  if (!((digits === 4 && letters === 0) || (digits === 2 && letters === 2))) {
    return "Серия ВУ должна содержать 4 цифры или 2 цифры и 2 буквы";
  }
  if (!form.password.trim()) return "Введите пароль";
  if (form.password.length < 8) return "Пароль должен содержать не менее 8 символов";
  if (!form.password_confirm.trim()) return "Повторите пароль";
  if (form.password !== form.password_confirm) return "Пароли не совпадают";

  return null;
}

function formatMoney(value: string | number): string {
  return `${Number(value).toFixed(2)} ₽`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("ru-RU");
}

function App() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(null);
  const [authForm, setAuthForm] = useState<AuthForm>(initialAuthForm);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!token) return;

    setIsLoading(true);
    api
      .me(token)
      .then(setUser)
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

  if (user && token) {
    if (user.role === "admin") {
      return <AdminDashboard token={token} user={user} onLogout={handleLogout} />;
    }

    if (user.can_use_service) {
      return <UserDashboard token={token} user={user} onLogout={handleLogout} />;
    }

    return <WaitingScreen user={user} onLogout={handleLogout} />;
  }

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
        <div className="auth-card">
          <div className="mode-switch" role="tablist" aria-label="Выбор формы">
            <button
              className={mode === "login" ? "active" : ""}
              type="button"
              onClick={() => {
                setMode("login");
                setMessage("");
              }}
            >
              Вход
            </button>
            <button
              className={mode === "register" ? "active" : ""}
              type="button"
              onClick={() => {
                setMode("register");
                setMessage("");
              }}
            >
              Регистрация
            </button>
          </div>

          <form className="form-stack" onSubmit={handleAuthSubmit}>
            <label>
              Email
              <input
                value={authForm.email}
                onChange={(event) => setAuthForm((form) => ({ ...form, email: event.target.value }))}
                type="email"
                placeholder="name@example.com"
                required
              />
            </label>

            {mode === "register" && (
              <>
                <div className="two-columns">
                  <label>
                    Фамилия
                    <input
                      value={authForm.last_name}
                      onChange={(event) =>
                        setAuthForm((form) => ({ ...form, last_name: event.target.value }))
                      }
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
                    placeholder="79990001122"
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
              </>
            )}

            <div className="two-columns">
              <label>
                Пароль
                <input
                  value={authForm.password}
                  onChange={(event) =>
                    setAuthForm((form) => ({ ...form, password: event.target.value }))
                  }
                  type="password"
                  required
                />
              </label>
              {mode === "register" && (
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
                    required
                  />
                </label>
              )}
            </div>

            <button className="primary-button" disabled={isLoading} type="submit">
              {isLoading ? "Подождите..." : mode === "login" ? "Войти" : "Отправить заявку"}
            </button>
          </form>
        </div>

        {message && <p className="message">{message}</p>}
      </section>
    </main>
  );
}

function WaitingScreen({ user, onLogout }: { user: User; onLogout: () => void }) {
  return (
    <main className="single-page">
      <section className="status-card">
        <span className="eyebrow">Статус заявки</span>
        <h2>{user.verification_status === "rejected" ? "Заявка отклонена" : "Ваша заявка отправлена"}</h2>
        <p>
          {user.verification_status === "rejected"
            ? "Администратор отклонил заявку. Уточните данные и попробуйте позже"
            : "Дождитесь, пока администратор проверит данные и откроет доступ"}
        </p>
        <button className="ghost-button" type="button" onClick={onLogout}>
          Выйти
        </button>
      </section>
    </main>
  );
}

function UserDashboard({ token, user, onLogout }: { token: string; user: User; onLogout: () => void }) {
  const [cars, setCars] = useState<Car[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [history, setHistory] = useState<Trip[]>([]);
  const [selectedCarId, setSelectedCarId] = useState<number | null>(null);
  const [latitude, setLatitude] = useState("55.751244");
  const [longitude, setLongitude] = useState("37.618423");
  const [topUpAmount, setTopUpAmount] = useState("500");
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(Date.now());

  const selectedCar = cars.find((car) => car.id === selectedCarId) ?? null;

  const loadData = async () => {
    const [carsData, walletData, bookingData, tripsData] = await Promise.all([
      api.cars(token),
      api.wallet(token),
      api.booking(token),
      api.trips(token),
    ]);

    setCars(carsData);
    setWallet(walletData);
    setBooking(bookingData);
    setActiveTrip(tripsData.active);
    setHistory(tripsData.history);
    if (!selectedCarId && carsData.length > 0) {
      setSelectedCarId(carsData[0].id);
    }
  };

  useEffect(() => {
    loadData().catch((error) => setMessage(getErrorMessage(error)));
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const runAction = async (action: () => Promise<unknown>, successText: string) => {
    setMessage("");
    try {
      await action();
      await loadData();
      setMessage(successText);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  };

  const activeSeconds = activeTrip
    ? Math.max(0, Math.floor((now - new Date(activeTrip.started_at).getTime()) / 1000))
    : 0;

  return (
    <main className="dashboard-page">
      <header className="topbar">
        <div>
          <span className="eyebrow">Пользователь</span>
          <h1>{user.first_name} {user.last_name}</h1>
        </div>
        <button className="ghost-button" type="button" onClick={onLogout}>Выйти</button>
      </header>

      <section className="dashboard-grid">
        <div className="panel">
          <h2>Кошелек</h2>
          <p className="big-number">{formatMoney(wallet?.balance ?? user.balance)}</p>
          <div className="inline-form">
            <input
              value={topUpAmount}
              onChange={(event) => setTopUpAmount(event.target.value)}
              type="number"
              min="1"
            />
            <button
              className="primary-button"
              type="button"
              onClick={() => runAction(() => api.topUp(token, topUpAmount), "Баланс пополнен")}
            >
              Пополнить
            </button>
          </div>
        </div>

        <div className="panel">
          <h2>Мое местоположение</h2>
          <div className="two-columns">
            <label>
              Широта
              <input value={latitude} onChange={(event) => setLatitude(event.target.value)} />
            </label>
            <label>
              Долгота
              <input value={longitude} onChange={(event) => setLongitude(event.target.value)} />
            </label>
          </div>
        </div>

        <div className="panel wide-panel">
          <h2>Карта автомобилей</h2>
          <div className="map-box">
            {cars.map((car, index) => (
              <button
                key={car.id}
                className={`map-marker ${car.id === selectedCarId ? "active" : ""}`}
                style={{
                  left: `${12 + (index * 17) % 76}%`,
                  top: `${18 + (index * 23) % 62}%`,
                }}
                type="button"
                onClick={() => setSelectedCarId(car.id)}
                title={`${car.brand} ${car.model}`}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </div>

        <div className="panel wide-panel">
          <h2>Автомобили</h2>
          <div className="car-list">
            {cars.map((car) => (
              <button
                key={car.id}
                className={`car-row ${car.id === selectedCarId ? "active" : ""}`}
                type="button"
                onClick={() => setSelectedCarId(car.id)}
              >
                <strong>{car.brand} {car.model}</strong>
                <span>{car.license_plate}</span>
                <span>{car.status_label}</span>
              </button>
            ))}
          </div>
          {selectedCar && (
            <div className="button-row">
              <button
                className="secondary-button"
                type="button"
                disabled={Boolean(booking || activeTrip)}
                onClick={() => runAction(() => api.createBooking(token, selectedCar.id), "Автомобиль забронирован")}
              >
                Забронировать
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={Boolean(activeTrip)}
                onClick={() =>
                  runAction(
                    () => api.startTrip(token, selectedCar.id, latitude, longitude),
                    "Поездка началась",
                  )
                }
              >
                Начать поездку
              </button>
            </div>
          )}
        </div>

        <div className="panel">
          <h2>Активная бронь</h2>
          {booking ? (
            <>
              <p>{booking.car.brand} {booking.car.model}</p>
              <button
                className="ghost-button"
                type="button"
                onClick={() => runAction(() => api.cancelBooking(token, booking.id), "Бронь отменена")}
              >
                Отменить бронь
              </button>
            </>
          ) : (
            <p className="muted">Активной брони нет</p>
          )}
        </div>

        <div className="panel">
          <h2>Активная поездка</h2>
          {activeTrip ? (
            <>
              <p>{activeTrip.car.brand} {activeTrip.car.model}</p>
              <p className="big-number">{Math.floor(activeSeconds / 60)} мин {activeSeconds % 60} сек</p>
              <button
                className="primary-button"
                type="button"
                onClick={() =>
                  runAction(
                    () => api.finishTrip(token, activeTrip.id, latitude, longitude),
                    "Поездка завершена",
                  )
                }
              >
                Завершить поездку
              </button>
            </>
          ) : (
            <p className="muted">Активной поездки нет</p>
          )}
        </div>

        <div className="panel wide-panel">
          <h2>История поездок</h2>
          {history.length === 0 ? (
            <p className="muted">История пока пустая</p>
          ) : (
            <div className="simple-list">
              {history.map((trip) => (
                <p key={trip.id}>
                  {formatDate(trip.started_at)} - {trip.car.brand} {trip.car.model}, {formatMoney(trip.total_price)}
                </p>
              ))}
            </div>
          )}
        </div>
      </section>

      {message && <p className="message fixed-message">{message}</p>}
    </main>
  );
}

function AdminDashboard({ token, user, onLogout }: { token: string; user: User; onLogout: () => void }) {
  const [applications, setApplications] = useState<User[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [tariff, setTariff] = useState<Tariff | null>(null);
  const [carForm, setCarForm] = useState<CarForm>(initialCarForm);
  const [message, setMessage] = useState("");

  const loadAdminData = async () => {
    const [usersData, carsData, tariffData] = await Promise.all([
      api.adminApplications(token),
      api.adminCars(token),
      api.adminTariff(token),
    ]);
    setApplications(usersData);
    setCars(carsData);
    setTariff(tariffData);
  };

  useEffect(() => {
    loadAdminData().catch((error) => setMessage(getErrorMessage(error)));
  }, []);

  const runAction = async (action: () => Promise<unknown>, successText: string) => {
    setMessage("");
    try {
      await action();
      await loadAdminData();
      setMessage(successText);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  };

  const handleCreateCar = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    runAction(
      () => api.adminCreateCar(token, carForm),
      "Автомобиль добавлен",
    ).then(() => setCarForm(initialCarForm));
  };

  const pendingUsers = applications.filter((item) => item.verification_status === "pending");

  return (
    <main className="dashboard-page">
      <header className="topbar">
        <div>
          <span className="eyebrow">Администратор</span>
          <h1>{user.email}</h1>
        </div>
        <button className="ghost-button" type="button" onClick={onLogout}>Выйти</button>
      </header>

      <section className="dashboard-grid">
        <div className="panel wide-panel">
          <h2>Заявки пользователей</h2>
          {pendingUsers.length === 0 ? (
            <p className="muted">Новых заявок нет</p>
          ) : (
            <div className="simple-list">
              {pendingUsers.map((item) => (
                <div className="application-row" key={item.id}>
                  <div>
                    <strong>{item.full_name || `${item.last_name} ${item.first_name}`}</strong>
                    <span>{item.email}</span>
                    <span>ВУ: {item.driver_license_number}</span>
                  </div>
                  <div className="button-row">
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() =>
                        runAction(() => api.adminUserAction(token, item.id, "approve"), "Заявка одобрена")
                      }
                    >
                      Одобрить
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() =>
                        runAction(() => api.adminUserAction(token, item.id, "reject"), "Заявка отклонена")
                      }
                    >
                      Отклонить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <h2>Тариф</h2>
          <label>
            Цена за минуту
            <input
              value={tariff?.price_per_minute ?? ""}
              onChange={(event) => setTariff((value) => value && { ...value, price_per_minute: event.target.value })}
            />
          </label>
          <label>
            Минимальный баланс
            <input
              value={tariff?.min_start_balance ?? ""}
              onChange={(event) => setTariff((value) => value && { ...value, min_start_balance: event.target.value })}
            />
          </label>
          <button
            className="primary-button"
            type="button"
            disabled={!tariff}
            onClick={() =>
              tariff &&
              runAction(
                () =>
                  api.adminUpdateTariff(token, {
                    price_per_minute: tariff.price_per_minute,
                    min_start_balance: tariff.min_start_balance,
                  }),
                "Тариф сохранен",
              )
            }
          >
            Сохранить тариф
          </button>
        </div>

        <div className="panel">
          <h2>Новый автомобиль</h2>
          <form className="form-stack" onSubmit={handleCreateCar}>
            <input
              placeholder="Марка"
              value={carForm.brand}
              onChange={(event) => setCarForm((form) => ({ ...form, brand: event.target.value }))}
              required
            />
            <input
              placeholder="Модель"
              value={carForm.model}
              onChange={(event) => setCarForm((form) => ({ ...form, model: event.target.value }))}
              required
            />
            <input
              placeholder="Госномер"
              value={carForm.license_plate}
              onChange={(event) => setCarForm((form) => ({ ...form, license_plate: event.target.value }))}
              required
            />
            <div className="two-columns">
              <input
                placeholder="Широта"
                value={carForm.latitude}
                onChange={(event) => setCarForm((form) => ({ ...form, latitude: event.target.value }))}
                required
              />
              <input
                placeholder="Долгота"
                value={carForm.longitude}
                onChange={(event) => setCarForm((form) => ({ ...form, longitude: event.target.value }))}
                required
              />
            </div>
            <button className="primary-button" type="submit">Добавить</button>
          </form>
        </div>

        <div className="panel wide-panel">
          <h2>Автопарк</h2>
          <div className="simple-list">
            {cars.map((car) => (
              <div className="car-admin-row" key={car.id}>
                <span>{car.brand} {car.model}</span>
                <span>{car.license_plate}</span>
                <select
                  value={car.status}
                  onChange={(event) =>
                    runAction(
                      () => api.adminUpdateCar(token, car.id, { status: event.target.value }),
                      "Статус автомобиля обновлен",
                    )
                  }
                >
                  <option value="available">Доступен</option>
                  <option value="booked">Забронирован</option>
                  <option value="in_trip">В поездке</option>
                  <option value="service">На обслуживании</option>
                  <option value="inactive">Неактивен</option>
                </select>
              </div>
            ))}
          </div>
        </div>
      </section>

      {message && <p className="message fixed-message">{message}</p>}
    </main>
  );
}

export default App;
