// @ts-nocheck
import { FormEvent, useEffect, useRef, useState } from "react";

import { ApiError, Booking, Car, Tariff, Trip, User, Wallet, api } from "./api";
import { getYandexMapsApiKey, loadYandexMaps } from "./yandexMapsLoader";

type Coordinates = [number, number];
type AuthMode = "login" | "register";
type UserTab = "map" | "wallet" | "activity";
type AdminTab = "fleet" | "applications" | "tariff";

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

type FleetMapProps = {
  cars: Car[];
  selectedCarId: number | null;
  onCarSelect: (carId: number) => void;
  userLocation?: Coordinates | null;
  onUserLocationChange?: (coords: Coordinates) => void;
  routeCar?: Car | null;
};

const TOKEN_KEY = "carsharing_token";
const BOOKING_TTL_MS = 15 * 60 * 1000;
const MOSCOW_CENTER: Coordinates = [55.751244, 37.618423];

const moneyFormatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

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
      return messages.join(". ");
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Не удалось выполнить запрос. Проверьте, что backend запущен и доступен.";
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

function formatMoney(value: string | number): string {
  return `${moneyFormatter.format(Number(value))} ₽`;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours} ч ${minutes} мин`;
  }

  return `${minutes} мин ${remainingSeconds} сек`;
}

function formatCountdown(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes} мин ${remainingSeconds.toString().padStart(2, "0")} сек`;
}

function getCarCoords(car: Car): Coordinates {
  return [Number(car.latitude), Number(car.longitude)];
}

function getCoordinatesLabel(coords: Coordinates | null): string {
  if (!coords) {
    return "Точка еще не выбрана";
  }

  return `${coords[0].toFixed(6)}, ${coords[1].toFixed(6)}`;
}

function getBookingSecondsLeft(booking: Booking | null, now: number): number | null {
  if (!booking) {
    return null;
  }

  const expiresAt = new Date(booking.created_at).getTime() + BOOKING_TTL_MS;
  return Math.max(0, Math.floor((expiresAt - now) / 1000));
}

function calculateDistanceKm(from: Coordinates | null, to: Coordinates | null): number | null {
  if (!from || !to) {
    return null;
  }

  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(to[0] - from[0]);
  const dLon = toRad(to[1] - from[1]);
  const lat1 = toRad(from[0]);
  const lat2 = toRad(to[0]);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Number((earthRadiusKm * c).toFixed(1));
}

function getStatusTone(status: Car["status"]): string {
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

function getCarPreset(car: Car, selectedCarId: number | null): string {
  if (car.id === selectedCarId) {
    return "islands#orangeCircleDotIcon";
  }

  switch (car.status) {
    case "available":
      return "islands#greenCircleDotIcon";
    case "booked":
      return "islands#yellowCircleDotIcon";
    case "in_trip":
      return "islands#blueCircleDotIcon";
    default:
      return "islands#grayCircleDotIcon";
  }
}

function buildFullName(user: User): string {
  return [user.last_name, user.first_name, user.patronymic].filter(Boolean).join(" ");
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
      setMessage(mode === "login" ? "Вход выполнен" : "Заявка отправлена");
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
          <span className="brand-name">CityDrive Moscow</span>
        </div>
        <div className="intro-copy">
          <h1>Каршеринг с картой, бронью и реальными маршрутами</h1>
          <p>
            Зарегистрируйтесь, дождитесь подтверждения аккаунта и управляйте поездкой
            через карту Москвы: ставьте свою точку, выбирайте машину и начинайте маршрут.
          </p>
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
  const isRejected = user.verification_status === "rejected";

  return (
    <main className="single-page">
      <section className="status-card">
        <span className="eyebrow">Статус заявки</span>
        <h2>{isRejected ? "Заявка отклонена" : "Заявка отправлена"}</h2>
        <p>
          {isRejected
            ? "Администратор отклонил заявку. Проверьте данные и попробуйте снова."
            : "Как только администратор подтвердит аккаунт, откроется доступ к карте, кошельку и поездкам."}
        </p>
        <button className="ghost-button" type="button" onClick={onLogout}>
          Выйти
        </button>
      </section>
    </main>
  );
}

function UserDashboard({ token, user, onLogout }: { token: string; user: User; onLogout: () => void }) {
  const [tab, setTab] = useState<UserTab>("map");
  const [cars, setCars] = useState<Car[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [history, setHistory] = useState<Trip[]>([]);
  const [selectedCarId, setSelectedCarId] = useState<number | null>(null);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [topUpAmount, setTopUpAmount] = useState("500");
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(true);

  const selectedCar = cars.find((car) => car.id === selectedCarId) ?? null;
  const selectedCarDistance = calculateDistanceKm(
    userLocation,
    selectedCar ? getCarCoords(selectedCar) : null,
  );
  const bookingSecondsLeft = getBookingSecondsLeft(booking, now);
  const activeTripSeconds = activeTrip
    ? Math.max(0, Math.floor((now - new Date(activeTrip.started_at).getTime()) / 1000))
    : 0;

  const loadData = async (showLoader = false) => {
    if (showLoader) {
      setIsRefreshing(true);
    }

    try {
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
      setSelectedCarId((currentSelectedCarId) => {
        if (currentSelectedCarId && carsData.some((car) => car.id === currentSelectedCarId)) {
          return currentSelectedCarId;
        }

        return null;
      });
      setMessage("");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      if (showLoader) {
        setIsRefreshing(false);
      }
    }
  };

  useEffect(() => {
    void loadData(true);
  }, [token]);

  useEffect(() => {
    const dataTimer = window.setInterval(() => {
      void loadData();
    }, 30000);

    return () => window.clearInterval(dataTimer);
  }, [token]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (booking && bookingSecondsLeft === 0) {
      void loadData();
    }
  }, [booking, bookingSecondsLeft]);

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

  const handleBookSelectedCar = () => {
    if (!selectedCar) {
      setMessage("Сначала выберите машину на карте.");
      return;
    }

    void runAction(
      () => api.createBooking(token, selectedCar.id),
      "Машина забронирована на 15 минут.",
    );
  };

  const handleStartTrip = () => {
    if (!selectedCar) {
      setMessage("Сначала выберите машину на карте.");
      return;
    }

    if (!userLocation) {
      setMessage("Сначала поставьте свою точку на карте.");
      return;
    }

    void runAction(
      () => api.startTrip(token, selectedCar.id, String(userLocation[0]), String(userLocation[1])),
      "Поездка началась.",
    );
  };

  const handleFinishTrip = () => {
    if (!activeTrip) {
      setMessage("Активной поездки нет.");
      return;
    }

    if (!userLocation) {
      setMessage("Перед завершением укажите текущую точку на карте.");
      return;
    }

    void runAction(
      () => api.finishTrip(token, activeTrip.id, String(userLocation[0]), String(userLocation[1])),
      "Поездка завершена.",
    );
  };

  const bookingBelongsToSelectedCar = booking?.car.id === selectedCar?.id;
  const bookingBelongsToAnotherCar = Boolean(booking && selectedCar && booking.car.id !== selectedCar.id);

  return (
    <main className="dashboard-page">
      <header className="topbar">
        <div>
          <span className="eyebrow">Пользователь</span>
          <h1>{buildFullName(user)}</h1>
        </div>
        <button className="ghost-button" type="button" onClick={onLogout}>
          Выйти
        </button>
      </header>

      <TabBar<UserTab>
        value={tab}
        onChange={setTab}
        items={[
          { value: "map", label: "Карта" },
          { value: "wallet", label: "Кошелек" },
          { value: "activity", label: "Активность" },
        ]}
      />

      {tab === "map" && (
        <section className="dashboard-stack">
          <div className="panel hero-panel">
            <div className="hero-row">
              <div>
                <span className="eyebrow">Карта Москвы</span>
                <h2>Все машины на карте и маршрут до выбранной точки</h2>
              </div>
            </div>
            <p className="helper-text">
              Нажмите на карту, чтобы поставить свою точку. Затем выберите машину: маршрут
              построится автоматически, а карточка машины появится прямо поверх карты.
            </p>
          </div>

          <div className="panel map-panel">
            <div className="map-stage">
              <FleetMap
                cars={cars}
                selectedCarId={selectedCarId}
                onCarSelect={setSelectedCarId}
                userLocation={userLocation}
                onUserLocationChange={setUserLocation}
                routeCar={selectedCar}
              />

              {selectedCar && (
                <aside className="map-popup">
                  <span className={`status-pill ${getStatusTone(selectedCar.status)}`}>
                    {selectedCar.status_label}
                  </span>
                  <h3>
                    {selectedCar.brand} {selectedCar.model}
                  </h3>
                  <p className="popup-lead">Госномер: {selectedCar.license_plate}</p>
                  <div className="detail-list">
                    <div>
                      <span>Координаты</span>
                      <strong>
                        {Number(selectedCar.latitude).toFixed(6)}, {Number(selectedCar.longitude).toFixed(6)}
                      </strong>
                    </div>
                    <div>
                      <span>Маршрут</span>
                      <strong>
                        {userLocation
                          ? selectedCarDistance === null
                            ? "Строится..."
                            : `Около ${selectedCarDistance} км`
                          : "Сначала поставьте свою точку"}
                      </strong>
                    </div>
                    <div>
                      <span>Бронь</span>
                      <strong>
                        {bookingBelongsToSelectedCar && bookingSecondsLeft !== null
                          ? `Еще ${formatCountdown(bookingSecondsLeft)}`
                          : "Не активна"}
                      </strong>
                    </div>
                  </div>
                  <div className="button-row">
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={Boolean(activeTrip || booking)}
                      onClick={handleBookSelectedCar}
                    >
                      {bookingBelongsToSelectedCar
                        ? "Уже забронирована"
                        : booking
                          ? "Есть активная бронь"
                          : "Забронировать"}
                    </button>
                    <button
                      className="primary-button"
                      type="button"
                      disabled={!userLocation || Boolean(activeTrip) || bookingBelongsToAnotherCar}
                      onClick={handleStartTrip}
                    >
                      {activeTrip ? "Поездка уже идет" : "Начать поездку"}
                    </button>
                  </div>
                  {!userLocation && (
                    <p className="inline-note">
                      Чтобы начать поездку, поставьте свою точку на карте.
                    </p>
                  )}
                  {bookingBelongsToAnotherCar && (
                    <p className="inline-note">
                      У вас уже есть активная бронь на другую машину. Сначала отмените ее в разделе активности.
                    </p>
                  )}
                </aside>
              )}
            </div>
          </div>
        </section>
      )}

      {tab === "wallet" && (
        <section className="dashboard-grid">
          <div className="panel">
            <span className="eyebrow">Баланс</span>
            <h2>Кошелек</h2>
            <p className="big-number">{formatMoney(wallet?.balance ?? user.balance)}</p>
            <p className="helper-text">
              Баланс используется для старта и завершения поездок. Пополнение сразу отражается в истории операций.
            </p>
            <div className="inline-form">
              <input
                value={topUpAmount}
                onChange={(event) => setTopUpAmount(event.target.value)}
                type="number"
                min="1"
                step="1"
              />
              <button
                className="primary-button"
                type="button"
                onClick={() =>
                  void runAction(() => api.topUp(token, topUpAmount), "Баланс успешно пополнен.")
                }
              >
                Пополнить
              </button>
            </div>
          </div>

          <div className="panel wide-panel">
            <span className="eyebrow">Операции</span>
            <h2>История кошелька</h2>
            {wallet?.transactions.length ? (
              <div className="simple-list">
                {wallet.transactions.map((transaction) => (
                  <div className="list-card" key={transaction.id}>
                    <div>
                      <strong>{transaction.description || transaction.transaction_type}</strong>
                      <span>{formatDateTime(transaction.created_at)}</span>
                    </div>
                    <strong className={Number(transaction.amount) >= 0 ? "text-success" : "text-danger"}>
                      {formatMoney(transaction.amount)}
                    </strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">Операций пока нет.</p>
            )}
          </div>
        </section>
      )}

      {tab === "activity" && (
        <section className="dashboard-grid">
          <div className="panel">
            <span className="eyebrow">Бронирование</span>
            <h2>Активная бронь</h2>
            {booking ? (
              <>
                <p className="panel-title">
                  {booking.car.brand} {booking.car.model}
                </p>
                <p className="helper-text">Бронь действует 15 минут, затем снимается автоматически.</p>
                <p className="big-number">
                  {bookingSecondsLeft !== null ? formatCountdown(bookingSecondsLeft) : "0 мин 00 сек"}
                </p>
                <div className="button-row">
                  <button className="ghost-button" type="button" onClick={() => setTab("map")}>
                    Открыть на карте
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() =>
                      void runAction(
                        () => api.cancelBooking(token, booking.id),
                        "Бронирование отменено.",
                      )
                    }
                  >
                    Отменить бронь
                  </button>
                </div>
              </>
            ) : (
              <p className="muted">Сейчас нет активной брони.</p>
            )}
          </div>

          <div className="panel">
            <span className="eyebrow">Поездка</span>
            <h2>Активная поездка</h2>
            {activeTrip ? (
              <>
                <p className="panel-title">
                  {activeTrip.car.brand} {activeTrip.car.model}
                </p>
                <p className="helper-text">Для завершения поездки можно заново поставить текущую точку на карте.</p>
                <p className="big-number">{formatDuration(activeTripSeconds)}</p>
                <div className="button-row">
                  <button className="ghost-button" type="button" onClick={() => setTab("map")}>
                    Вернуться к карте
                  </button>
                  <button className="primary-button" type="button" onClick={handleFinishTrip}>
                    Завершить поездку
                  </button>
                </div>
              </>
            ) : (
              <p className="muted">Активной поездки нет.</p>
            )}
          </div>

          <div className="panel wide-panel">
            <span className="eyebrow">История</span>
            <h2>История поездок</h2>
            {history.length ? (
              <div className="simple-list">
                {history.map((trip) => (
                  <div className="list-card" key={trip.id}>
                    <div>
                      <strong>
                        {trip.car.brand} {trip.car.model}
                      </strong>
                      <span>
                        {formatDateTime(trip.started_at)} • {trip.total_minutes} мин
                      </span>
                    </div>
                    <strong>{formatMoney(trip.total_price)}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">История поездок пока пустая.</p>
            )}
          </div>
        </section>
      )}

      {message && <p className="message fixed-message">{message}</p>}
      {isRefreshing && <p className="loading-banner">Синхронизируем карту, бронь и поездки...</p>}
    </main>
  );
}

function AdminDashboard({ token, user, onLogout }: { token: string; user: User; onLogout: () => void }) {
  const [tab, setTab] = useState<AdminTab>("fleet");
  const [applications, setApplications] = useState<User[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [tariff, setTariff] = useState<Tariff | null>(null);
  const [carForm, setCarForm] = useState<CarForm>(initialCarForm);
  const [selectedCarId, setSelectedCarId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const selectedCar = cars.find((car) => car.id === selectedCarId) ?? null;
  const pendingUsers = applications.filter((item) => item.verification_status === "pending");

  const loadAdminData = async () => {
    try {
      const [usersData, carsData, tariffData] = await Promise.all([
        api.adminApplications(token),
        api.adminCars(token),
        api.adminTariff(token),
      ]);

      setApplications(usersData);
      setCars(carsData);
      setTariff(tariffData);
      setSelectedCarId((currentSelectedCarId) => {
        if (currentSelectedCarId && carsData.some((car) => car.id === currentSelectedCarId)) {
          return currentSelectedCarId;
        }

        return carsData[0]?.id ?? null;
      });
      setMessage("");
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  };

  useEffect(() => {
    void loadAdminData();
  }, [token]);

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
    void runAction(() => api.adminCreateCar(token, carForm), "Автомобиль добавлен в автопарк.").then(
      () => setCarForm(initialCarForm),
    );
  };

  return (
    <main className="dashboard-page">
      <header className="topbar">
        <div>
          <span className="eyebrow">Администратор</span>
          <h1>{user.email}</h1>
          <p className="topbar-note">Разделы автопарка, заявок и тарифов вынесены в отдельные SPA-вкладки.</p>
        </div>
        <button className="ghost-button" type="button" onClick={onLogout}>
          Выйти
        </button>
      </header>

      <TabBar<AdminTab>
        value={tab}
        onChange={setTab}
        items={[
          { value: "fleet", label: "Автопарк" },
          { value: "applications", label: "Заявки" },
          { value: "tariff", label: "Тариф" },
        ]}
      />

      {tab === "fleet" && (
        <section className="dashboard-grid">
          <div className="panel wide-panel">
            <div className="hero-row">
              <div>
                <span className="eyebrow">Карта парка</span>
                <h2>Машины на реальной карте Москвы</h2>
              </div>
              <span className="badge">Всего машин: {cars.length}</span>
            </div>
            <div className="map-stage admin-map">
              <FleetMap
                cars={cars}
                selectedCarId={selectedCarId}
                onCarSelect={setSelectedCarId}
                routeCar={null}
              />

              {selectedCar && (
                <aside className="map-popup admin-popup">
                  <span className={`status-pill ${getStatusTone(selectedCar.status)}`}>
                    {selectedCar.status_label}
                  </span>
                  <h3>
                    {selectedCar.brand} {selectedCar.model}
                  </h3>
                  <p className="popup-lead">Госномер: {selectedCar.license_plate}</p>
                  <label>
                    Статус автомобиля
                    <select
                      value={selectedCar.status}
                      onChange={(event) =>
                        void runAction(
                          () => api.adminUpdateCar(token, selectedCar.id, { status: event.target.value }),
                          "Статус автомобиля обновлен.",
                        )
                      }
                    >
                      <option value="available">Доступен</option>
                      <option value="booked">Забронирован</option>
                      <option value="in_trip">В поездке</option>
                      <option value="service">На обслуживании</option>
                      <option value="inactive">Неактивен</option>
                    </select>
                  </label>
                  <div className="detail-list">
                    <div>
                      <span>Широта</span>
                      <strong>{selectedCar.latitude}</strong>
                    </div>
                    <div>
                      <span>Долгота</span>
                      <strong>{selectedCar.longitude}</strong>
                    </div>
                  </div>
                </aside>
              )}
            </div>
          </div>

          <div className="panel">
            <span className="eyebrow">Добавление</span>
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
              <button className="primary-button" type="submit">
                Добавить
              </button>
            </form>
          </div>

          <div className="panel">
            <span className="eyebrow">Подсказка</span>
            <h2>Работа с картой</h2>
            <p className="helper-text">
              Клик по маркеру машины открывает карточку справа. Через нее можно менять статус без отдельного
              списка всех автомобилей.
            </p>
            <p className="helper-text">
              Для отображения карты в админке используется тот же ключ Яндекс Карт, что и в пользовательской части.
            </p>
          </div>
        </section>
      )}

      {tab === "applications" && (
        <section className="dashboard-stack">
          <div className="panel">
            <span className="eyebrow">Модерация</span>
            <h2>Заявки пользователей</h2>
            {pendingUsers.length === 0 ? (
              <p className="muted">Новых заявок сейчас нет.</p>
            ) : (
              <div className="simple-list">
                {pendingUsers.map((item) => (
                  <div className="application-card" key={item.id}>
                    <div>
                      <strong>{item.full_name || buildFullName(item)}</strong>
                      <span>{item.email}</span>
                      <span>Телефон: {item.phone}</span>
                      <span>ВУ: {item.driver_license_number}</span>
                    </div>
                    <div className="button-row">
                      <button
                        className="primary-button"
                        type="button"
                        onClick={() =>
                          void runAction(
                            () => api.adminUserAction(token, item.id, "approve"),
                            "Заявка одобрена.",
                          )
                        }
                      >
                        Одобрить
                      </button>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() =>
                          void runAction(
                            () => api.adminUserAction(token, item.id, "reject"),
                            "Заявка отклонена.",
                          )
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
        </section>
      )}

      {tab === "tariff" && (
        <section className="dashboard-grid">
          <div className="panel">
            <span className="eyebrow">Тариф</span>
            <h2>Настройки поездок</h2>
            <label>
              Цена за минуту
              <input
                value={tariff?.price_per_minute ?? ""}
                onChange={(event) =>
                  setTariff((value) => (value ? { ...value, price_per_minute: event.target.value } : value))
                }
              />
            </label>
            <label>
              Минимальный баланс
              <input
                value={tariff?.min_start_balance ?? ""}
                onChange={(event) =>
                  setTariff((value) => (value ? { ...value, min_start_balance: event.target.value } : value))
                }
              />
            </label>
            <button
              className="primary-button"
              type="button"
              disabled={!tariff}
              onClick={() =>
                tariff &&
                void runAction(
                  () =>
                    api.adminUpdateTariff(token, {
                      price_per_minute: tariff.price_per_minute,
                      min_start_balance: tariff.min_start_balance,
                    }),
                  "Тариф сохранен.",
                )
              }
            >
              Сохранить тариф
            </button>
          </div>

          <div className="panel">
            <span className="eyebrow">Контекст</span>
            <h2>Как это влияет на пользователя</h2>
            <p className="helper-text">
              Новое значение тарифа применяется к следующим поездкам. Карта, брони и история поездок на клиенте
              обновляются через API без перезагрузки всей SPA.
            </p>
          </div>
        </section>
      )}

      {message && <p className="message fixed-message">{message}</p>}
    </main>
  );
}

function TabBar<T extends string>({
  items,
  value,
  onChange,
}: {
  items: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <nav className="tabbar" aria-label="Разделы">
      {items.map((item) => (
        <button
          key={item.value}
          className={item.value === value ? "active" : ""}
          type="button"
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}

function FleetMap({
  cars,
  selectedCarId,
  onCarSelect,
  userLocation = null,
  onUserLocationChange,
  routeCar = null,
}: FleetMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<YMapsMapInstance | null>(null);
  const ymapsRef = useRef<YMapsApi | null>(null);
  const locationChangeRef = useRef(onUserLocationChange);
  const carSelectRef = useRef(onCarSelect);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    locationChangeRef.current = onUserLocationChange;
  }, [onUserLocationChange]);

  useEffect(() => {
    carSelectRef.current = onCarSelect;
  }, [onCarSelect]);

  useEffect(() => {
    let cancelled = false;

    const initMap = async () => {
      if (!containerRef.current) {
        return;
      }

      try {
        const ymaps = await loadYandexMaps();
        if (cancelled || !containerRef.current) {
          return;
        }

        ymapsRef.current = ymaps;
        const map = new ymaps.Map(
          containerRef.current,
          {
            center: MOSCOW_CENTER,
            zoom: 11,
            controls: ["zoomControl", "fullscreenControl"],
          },
          {
            suppressMapOpenBlock: true,
          },
        );

        map.events.add("click", (event) => {
          const coords = event.get("coords");
          if (!Array.isArray(coords) || !locationChangeRef.current) {
            return;
          }

          locationChangeRef.current([Number(coords[0]), Number(coords[1])]);
        });

        mapRef.current = map;
        setIsLoading(false);
      } catch (mapError) {
        if (!cancelled) {
          setError(getErrorMessage(mapError));
          setIsLoading(false);
        }
      }
    };

    void initMap();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const ymaps = ymapsRef.current;

    if (!map || !ymaps) {
      return;
    }

    map.geoObjects.removeAll();

    for (const car of cars) {
      const placemark = new ymaps.Placemark(
        getCarCoords(car),
        {
          hintContent: `${car.brand} ${car.model}`,
          balloonContentHeader: `${car.brand} ${car.model}`,
          balloonContentBody: `
            <strong>${car.license_plate}</strong><br/>
            Статус: ${car.status_label}<br/>
            Координаты: ${Number(car.latitude).toFixed(6)}, ${Number(car.longitude).toFixed(6)}
          `,
        },
        {
          preset: getCarPreset(car, selectedCarId),
        },
      );

      placemark.events.add("click", (event) => {
        event.stopPropagation?.();
        carSelectRef.current(car.id);
        placemark.balloon?.open();
      });
      map.geoObjects.add(placemark);
    }

    if (userLocation) {
      const userPlacemark = new ymaps.Placemark(
        userLocation,
        {
          hintContent: "Моя точка",
          balloonContentHeader: "Моя точка",
          balloonContentBody: "Отсюда строится маршрут до выбранной машины.",
        },
        {
          preset: "islands#redCircleDotIcon",
        },
      );
      map.geoObjects.add(userPlacemark);
    }

    if (userLocation && routeCar) {
      const route = new ymaps.multiRouter.MultiRoute(
        {
          referencePoints: [userLocation, getCarCoords(routeCar)],
          params: {
            routingMode: "auto",
          },
        },
        {
          boundsAutoApply: true,
          wayPointVisible: false,
          viaPointVisible: false,
          routeActiveStrokeWidth: 5,
          routeActiveStrokeColor: "#1d6b57",
        },
      );

      map.geoObjects.add(route);
    }
  }, [cars, routeCar, selectedCarId, userLocation]);

  if (!getYandexMapsApiKey()) {
    return (
      <div className="map-fallback">
        <strong>Карта отключена</strong>
        <p>Добавьте `APP_YANDEX_MAPS_API_KEY` в `.env`, чтобы подключить реальный API Яндекс Карт.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="map-fallback">
        <strong>Не удалось загрузить карту</strong>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="map-canvas-shell">
      <div className="map-canvas" ref={containerRef} />
      {isLoading && <div className="map-overlay">Загружаем Яндекс Карту...</div>}
    </div>
  );
}

export default App;
