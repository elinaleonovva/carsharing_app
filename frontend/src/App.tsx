// @ts-nocheck
import { FormEvent, useEffect, useState } from "react";

import { ApiError, Booking, BonusZone, Car, Tariff, TimeCoefficient, Trip, User, Wallet, api } from "./api";
import { FleetMap } from "./components/FleetMap";
import { TabBar } from "./components/TabBar";
import { WaitingScreen } from "./components/WaitingScreen";

type Coordinates = [number, number];
type AuthMode = "login" | "register";
type UserTab = "map" | "wallet" | "activity";
type AdminTab = "map" | "wallet" | "activity" | "users" | "fleet" | "bookings" | "tariff" | "zones";
type RouteSummary = {
  distanceKm: number | null;
  durationMinutes: number | null;
};

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
  price_per_minute: string;
};

type BonusZoneForm = {
  name: string;
  latitude: string;
  longitude: string;
  radius_meters: string;
  discount_percent: string;
  is_active: boolean;
};

type FleetMapProps = {
  cars: Car[];
  selectedCarId: number | null;
  onCarSelect: (carId: number) => void;
  userLocation?: Coordinates | null;
  onUserLocationChange?: (coords: Coordinates) => void;
  routeCar?: Car | null;
  destinationLocation?: Coordinates | null;
  onDestinationLocationChange?: (coords: Coordinates) => void;
  routeFrom?: Coordinates | null;
  onRouteSummaryChange?: (summary: RouteSummary) => void;
  bonusZones?: BonusZone[];
  onBonusZoneCenterChange?: (coords: Coordinates) => void;
};

const TOKEN_KEY = "carsharing_token";
const BOOKING_TTL_MS = 15 * 60 * 1000;
const MOSCOW_CENTER: Coordinates = [55.751244, 37.618423];
const MKAD_POLYGON: Coordinates[] = [
  [55.9115, 37.5450],
  [55.9075, 37.6200],
  [55.8950, 37.6900],
  [55.8700, 37.7550],
  [55.8350, 37.8050],
  [55.7850, 37.8420],
  [55.7300, 37.8450],
  [55.6800, 37.8270],
  [55.6250, 37.7900],
  [55.5850, 37.7200],
  [55.5710, 37.6350],
  [55.5820, 37.5450],
  [55.6150, 37.4650],
  [55.6650, 37.4050],
  [55.7350, 37.3700],
  [55.8050, 37.3900],
  [55.8650, 37.4550],
];

const moneyFormatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\d+$/;
const driverLicenseSeriesPattern = /^[0-9A-Za-zА-Яа-яЁё]{4}$/;
const licensePlatePattern = "^[АВЕКМНОРСТУХABEKMHOPCTYX][0-9]{3}[АВЕКМНОРСТУХABEKMHOPCTYX]{2}[0-9]{2,3}$";
const blockedNumberKeys = ["e", "E", "+"];

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
  price_per_minute: "12.00",
};

const initialBonusZoneForm: BonusZoneForm = {
  name: "",
  latitude: "55.751244",
  longitude: "37.618423",
  radius_meters: "600",
  discount_percent: "10.00",
  is_active: true,
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

function toApiCoordinate(value: number): string {
  return value.toFixed(6);
}

function isInsideMkad(coords: Coordinates): boolean {
  const [lat, lon] = coords;
  let inside = false;

  for (let i = 0, j = MKAD_POLYGON.length - 1; i < MKAD_POLYGON.length; j = i++) {
    const [latI, lonI] = MKAD_POLYGON[i];
    const [latJ, lonJ] = MKAD_POLYGON[j];
    const intersects = lonI > lon !== lonJ > lon && lat < ((latJ - latI) * (lon - lonI)) / (lonJ - lonI) + latI;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
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

function getTripDestination(trip: Trip | null): Coordinates | null {
  if (!trip?.destination_latitude || !trip.destination_longitude) {
    return null;
  }

  return [Number(trip.destination_latitude), Number(trip.destination_longitude)];
}

function calculateEstimatedTripPrice(
  trip: Trip | null,
  durationMinutes: number | null,
): string | null {
  if (!trip || !durationMinutes) {
    return null;
  }

  const safeMinutes = Math.max(1, Math.ceil(durationMinutes));
  const total = safeMinutes * Number(trip.price_per_minute) * Number(trip.coefficient);
  return total.toFixed(2);
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

function UserDashboard({ token, user, onLogout }: { token: string; user: User; onLogout: () => void }) {
  const [tab, setTab] = useState<UserTab>("map");
  const [cars, setCars] = useState<Car[]>([]);
  const [bonusZones, setBonusZones] = useState<BonusZone[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [history, setHistory] = useState<Trip[]>([]);
  const [selectedCarId, setSelectedCarId] = useState<number | null>(null);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [destinationLocation, setDestinationLocation] = useState<Coordinates | null>(null);
  const [destinationRouteSummary, setDestinationRouteSummary] = useState<RouteSummary>({
    distanceKm: null,
    durationMinutes: null,
  });
  const [topUpAmount, setTopUpAmount] = useState("500");
  const [mapMessage, setMapMessage] = useState("");
  const [walletMessage, setWalletMessage] = useState("");
  const [activityMessage, setActivityMessage] = useState("");
  const [now, setNow] = useState(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(true);

  const selectedCar = cars.find((car) => car.id === selectedCarId) ?? null;
  const selectedCarDistance = calculateDistanceKm(
    userLocation,
    selectedCar ? getCarCoords(selectedCar) : null,
  );
  const hasDebt = Number(wallet?.balance ?? user.balance) < 0;
  const activeTripStart = activeTrip ? getCarCoords(activeTrip.car) : null;
  const estimatedTripPrice = calculateEstimatedTripPrice(activeTrip, destinationRouteSummary.durationMinutes);
  const bookingSecondsLeft = getBookingSecondsLeft(booking, now);
  const loadData = async (showLoader = false) => {
    if (showLoader) {
      setIsRefreshing(true);
    }

    try {
      const [carsData, walletData, bookingData, tripsData, bonusZonesData] = await Promise.all([
        api.cars(token),
        api.wallet(token),
        api.booking(token),
        api.trips(token),
        api.bonusZones(token),
      ]);

      setCars(carsData);
      setBonusZones(bonusZonesData);
      setWallet(walletData);
      setBooking(bookingData);
      setActiveTrip(tripsData.active);
      setHistory(tripsData.history);
      setDestinationLocation(getTripDestination(tripsData.active));
      setDestinationRouteSummary({ distanceKm: null, durationMinutes: null });
      setSelectedCarId((currentSelectedCarId) => {
        if (tripsData.active) {
          return null;
        }

        if (currentSelectedCarId && carsData.some((car) => car.id === currentSelectedCarId)) {
          return currentSelectedCarId;
        }

        return null;
      });
    } catch (error) {
      setMapMessage(getErrorMessage(error));
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
    if (!mapMessage) {
      return;
    }

    const timer = window.setTimeout(() => setMapMessage(""), 10000);
    return () => window.clearTimeout(timer);
  }, [mapMessage]);

  useEffect(() => {
    if (booking && bookingSecondsLeft === 0) {
      void loadData();
    }
  }, [booking, bookingSecondsLeft]);

  const handleUserLocationChange = (coords: Coordinates) => {
    if (!isInsideMkad(coords)) {
      setMapMessage("Точку можно поставить только внутри МКАД");
      return;
    }

    setUserLocation(coords);
    setMapMessage("");
  };

  const runAction = async (
    action: () => Promise<unknown>,
    successText: string,
    setSectionMessage: (message: string) => void,
  ) => {
    setSectionMessage("");

    try {
      await action();
      await loadData();
      setSectionMessage(successText);
    } catch (error) {
      setSectionMessage(getErrorMessage(error));
    }
  };

  const handleBookSelectedCar = () => {
    if (hasDebt) {
      setMapMessage("Сначала погасите задолженность в кошельке");
      return;
    }

    if (!selectedCar) {
      setMapMessage("Сначала выберите машину на карте");
      return;
    }

    void runAction(
      () => api.createBooking(token, selectedCar.id),
      "Машина забронирована на 15 минут",
      setMapMessage,
    );
  };

  const handleStartTrip = () => {
    if (hasDebt) {
      setMapMessage("Сначала погасите задолженность в кошельке");
      return;
    }

    if (!selectedCar) {
      setMapMessage("Сначала выберите машину на карте");
      return;
    }

    if (!userLocation) {
      setMapMessage("Сначала поставьте свою точку на карте");
      return;
    }

    setMapMessage("");
    void api
      .startTrip(token, selectedCar.id, toApiCoordinate(userLocation[0]), toApiCoordinate(userLocation[1]))
      .then(async () => {
        setSelectedCarId(null);
        setDestinationLocation(null);
        setDestinationRouteSummary({ distanceKm: null, durationMinutes: null });
        await loadData();
        setMapMessage("Поездка началась. Теперь поставьте точку назначения на карте");
      })
      .catch((error) => setMapMessage(getErrorMessage(error)));
  };

  const handleDestinationChange = (coords: Coordinates) => {
    if (!activeTrip) {
      return;
    }

    if (!isInsideMkad(coords)) {
      setMapMessage("Точку назначения можно поставить только внутри МКАД");
      return;
    }

    setDestinationLocation(coords);
    setDestinationRouteSummary({ distanceKm: null, durationMinutes: null });
    void api
      .setTripDestination(token, activeTrip.id, toApiCoordinate(coords[0]), toApiCoordinate(coords[1]))
      .then((trip) => {
        setActiveTrip(trip);
        setMapMessage("");
      })
      .catch((error) => setMapMessage(getErrorMessage(error)));
  };

  const handleFinishTrip = (setSectionMessage = setMapMessage) => {
    if (!activeTrip) {
      setSectionMessage("Активной поездки нет");
      return;
    }

    if (!destinationLocation) {
      setSectionMessage("Перед завершением поставьте точку назначения на карте");
      return;
    }

    void runAction(
      () =>
        api.finishTrip(
          token,
          activeTrip.id,
          toApiCoordinate(destinationLocation[0]),
          toApiCoordinate(destinationLocation[1]),
          destinationRouteSummary.durationMinutes ?? undefined,
        ),
      "Поездка завершена",
      setSectionMessage,
    );
  };

  const bookingBelongsToSelectedCar = booking?.car.id === selectedCar?.id;
  const bookingBelongsToAnotherCar = Boolean(booking && selectedCar && booking.car.id !== selectedCar.id);
  const handleTabChange = (nextTab: UserTab) => {
    setTab(nextTab);
    if (nextTab === "map") setMapMessage("");
    if (nextTab === "wallet") setWalletMessage("");
    if (nextTab === "activity") setActivityMessage("");
  };

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
        onChange={handleTabChange}
        items={[
          { value: "map", label: "Карта" },
          { value: "wallet", label: "Кошелек" },
          { value: "activity", label: "Активность" },
        ]}
      />

      {tab === "map" && (
        <section className="dashboard-stack map-layout">
          <div className="panel hero-panel">
            <div className="hero-row">
              <div>
                <span className="eyebrow">Карта Москвы</span>
                <h2>Машины рядом на карте</h2>
              </div>
            </div>
            <p className="helper-text">
              Нажмите на карту, чтобы поставить свою точку. Затем выберите машину: маршрут
              построится автоматически
            </p>
          </div>

          <div className="panel map-panel">
            <div className="map-stage">
              {mapMessage && <p className="message map-message">{mapMessage}</p>}
              <FleetMap
                cars={cars}
                selectedCarId={selectedCarId}
                onCarSelect={setSelectedCarId}
                userLocation={activeTrip ? null : userLocation}
                onUserLocationChange={activeTrip ? undefined : handleUserLocationChange}
                routeCar={activeTrip ? null : selectedCar}
                destinationLocation={destinationLocation}
                onDestinationLocationChange={activeTrip ? handleDestinationChange : undefined}
                routeFrom={activeTripStart}
                onRouteSummaryChange={setDestinationRouteSummary}
                bonusZones={bonusZones}
              />

              {activeTrip && (
                <aside className="map-popup trip-popup">
                  <span className="status-pill info">Поездка идет</span>
                  <h3>
                    {activeTrip.car.brand} {activeTrip.car.model}
                  </h3>
                  <p className="popup-lead">Поставьте на карте точку назначения</p>
                  <div className="detail-list">
                    <div>
                      <span>Цена машины</span>
                      <strong>{formatMoney(activeTrip.price_per_minute)} / мин</strong>
                    </div>
                    <div>
                      <span>Маршрут</span>
                      <strong>
                        {destinationRouteSummary.distanceKm === null
                          ? destinationLocation
                            ? "Строится..."
                            : "Выберите точку"
                          : `${destinationRouteSummary.distanceKm} км`}
                      </strong>
                    </div>
                    <div>
                      <span>Время маршрута</span>
                      <strong>
                        {destinationRouteSummary.durationMinutes === null
                          ? "Оценка появится после маршрута"
                          : `${destinationRouteSummary.durationMinutes} мин`}
                      </strong>
                    </div>
                    <div>
                      <span>Итог</span>
                      <strong>{estimatedTripPrice ? formatMoney(estimatedTripPrice) : "После выбора точки"}</strong>
                    </div>
                  </div>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={!destinationLocation || destinationRouteSummary.durationMinutes === null}
                    onClick={() => handleFinishTrip(setMapMessage)}
                  >
                    Завершить поездку
                  </button>
                </aside>
              )}

              {!activeTrip && selectedCar && (
                <aside className="map-popup car-popup">
                  <button
                    className="map-popup-close"
                    type="button"
                    aria-label="Закрыть карточку машины"
                    onClick={() => setSelectedCarId(null)}
                  >
                    ×
                  </button>
                  <span className={`status-pill ${getStatusTone(selectedCar.status)}`}>
                    {selectedCar.status_label}
                  </span>
                  <h3>
                    {selectedCar.brand} {selectedCar.model}
                  </h3>
                  <p className="popup-lead">Госномер: {selectedCar.license_plate}</p>
                  <div className="detail-list">
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
                    <div>
                      <span>Цена</span>
                      <strong>{formatMoney(selectedCar.price_per_minute)} / мин</strong>
                    </div>
                  </div>
                  <div className="button-row">
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={hasDebt || Boolean(activeTrip || booking)}
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
                      disabled={hasDebt || !userLocation || Boolean(activeTrip) || bookingBelongsToAnotherCar}
                      onClick={handleStartTrip}
                    >
                      {activeTrip ? "Поездка уже идет" : "Начать поездку"}
                    </button>
                  </div>
                  {hasDebt && (
                    <p className="inline-note">
                      Есть задолженность. Пополните кошелек, чтобы снова бронировать и начинать поездки
                    </p>
                  )}
                  {!hasDebt && !userLocation && (
                    <p className="inline-note">
                      Чтобы начать поездку, поставьте свою точку на карте
                    </p>
                  )}
                  {!hasDebt && userLocation && bookingBelongsToAnotherCar && (
                    <p className="inline-note">
                      У вас уже есть активная бронь на другую машину. Сначала отмените ее в разделе активности
                    </p>
                  )}
                </aside>
              )}
            </div>
          </div>
        </section>
      )}

      {tab === "wallet" && (
        <section className="dashboard-grid wallet-layout">
          <div className="panel">
            <span className="eyebrow">Баланс</span>
            <h2>Кошелек</h2>
            <p className="big-number">{formatMoney(wallet?.balance ?? user.balance)}</p>
            {hasDebt && (
              <p className="inline-note">
                Сейчас есть задолженность {formatMoney(Math.abs(Number(wallet?.balance ?? user.balance)))}
              </p>
            )}
            <div className="inline-form wallet-top-up-form">
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
                  void runAction(() => api.topUp(token, topUpAmount), "Баланс успешно пополнен", setWalletMessage)
                }
              >
                Пополнить
              </button>
            </div>
            {walletMessage && <p className="message section-message wallet-message">{walletMessage}</p>}
          </div>

          <div className="panel wide-panel">
            <span className="eyebrow">Операции</span>
            <h2>История кошелька</h2>
            {wallet?.transactions.length ? (
              <div className="simple-list history-list">
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
              <p className="muted">Операций пока нет</p>
            )}
          </div>
        </section>
      )}

      {tab === "activity" && (
        <section className="dashboard-grid activity-layout">
          {activityMessage && <p className="message section-message activity-message">{activityMessage}</p>}
          <div className={`panel ${booking ? "booking-activity-panel" : ""}`}>
            <span className="eyebrow">Бронирование</span>
            <h2>Активная бронь</h2>
            {booking ? (
              <>
                <p className="panel-title">
                  {booking.car.brand} {booking.car.model}
                </p>
                <p className="helper-text">Бронь действует 15 минут, затем снимается автоматически</p>
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
                        "Бронирование отменено",
                        setActivityMessage,
                      )
                    }
                  >
                    Отменить бронь
                  </button>
                </div>
              </>
            ) : (
              <p className="muted">Сейчас нет активной брони</p>
            )}
          </div>

          <div className={`panel ${activeTrip ? "trip-activity-panel" : ""}`}>
            <span className="eyebrow">Поездка</span>
            <h2>Активная поездка</h2>
            {activeTrip ? (
              <>
                <p className="panel-title">
                  {activeTrip.car.brand} {activeTrip.car.model}
                </p>
                <div className="button-row">
                  <button className="ghost-button" type="button" onClick={() => setTab("map")}>
                    Вернуться к карте
                  </button>
                  <button className="primary-button" type="button" onClick={() => handleFinishTrip(setActivityMessage)}>
                    Завершить поездку
                  </button>
                </div>
              </>
            ) : (
              <p className="muted">Активной поездки нет</p>
            )}
          </div>

          <div className="panel wide-panel">
            <span className="eyebrow">История</span>
            <h2>История поездок</h2>
            {history.length ? (
              <div className="simple-list history-list">
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
              <p className="muted">История поездок пока пустая</p>
            )}
          </div>
        </section>
      )}

      {isRefreshing && <p className="loading-banner">Синхронизируем карту, бронь и поездки...</p>}
    </main>
  );
}

function AdminDashboard({ token, user, onLogout }: { token: string; user: User; onLogout: () => void }) {
  const [tab, setTab] = useState<AdminTab>("map");
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [applications, setApplications] = useState<User[]>([]);
  const [cars, setCars] = useState<Car[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [adminBooking, setAdminBooking] = useState<Booking | null>(null);
  const [adminTrips, setAdminTrips] = useState<{ active: Trip | null; history: Trip[] }>({ active: null, history: [] });
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [allTrips, setAllTrips] = useState<Trip[]>([]);
  const [tariff, setTariff] = useState<Tariff | null>(null);
  const [coefficients, setCoefficients] = useState<TimeCoefficient[]>([]);
  const [bonusZones, setBonusZones] = useState<BonusZone[]>([]);
  const [carForm, setCarForm] = useState<CarForm>(initialCarForm);
  const [zoneForm, setZoneForm] = useState<BonusZoneForm>(initialBonusZoneForm);
  const [selectedCarId, setSelectedCarId] = useState<number | null>(null);
  const [editingCarId, setEditingCarId] = useState<number | null>(null);
  const [editingZoneId, setEditingZoneId] = useState<number | null>(null);
  const [topUpAmount, setTopUpAmount] = useState("500");
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [destinationLocation, setDestinationLocation] = useState<Coordinates | null>(null);
  const [destinationRouteSummary, setDestinationRouteSummary] = useState<RouteSummary>({
    distanceKm: null,
    durationMinutes: null,
  });
  const [mapMessage, setMapMessage] = useState("");
  const [walletMessage, setWalletMessage] = useState("");
  const [activityMessage, setActivityMessage] = useState("");
  const [now, setNow] = useState(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [message, setMessage] = useState("");

  const selectedCar = cars.find((car) => car.id === selectedCarId) ?? null;
  const pendingUsers = applications;
  const activeTrip = adminTrips.active;
  const history = adminTrips.history;
  const selectedCarDistance = calculateDistanceKm(
    userLocation,
    selectedCar ? getCarCoords(selectedCar) : null,
  );
  const hasDebt = Number(wallet?.balance ?? user.balance) < 0;
  const activeTripStart = activeTrip ? getCarCoords(activeTrip.car) : null;
  const estimatedTripPrice = calculateEstimatedTripPrice(activeTrip, destinationRouteSummary.durationMinutes);
  const bookingSecondsLeft = getBookingSecondsLeft(adminBooking, now);

  const loadAdminData = async (showLoader = false) => {
    if (showLoader) {
      setIsRefreshing(true);
    }

    try {
      const [
        usersData,
        applicationsData,
        carsData,
        walletData,
        bookingData,
        tripsData,
        allBookingsData,
        allTripsData,
        tariffData,
        coefficientsData,
        bonusZonesData,
      ] = await Promise.all([
        api.adminUsers(token),
        api.adminApplications(token),
        api.adminCars(token),
        api.wallet(token),
        api.booking(token),
        api.trips(token),
        api.adminBookings(token),
        api.adminTrips(token),
        api.adminTariff(token),
        api.adminCoefficients(token),
        api.adminBonusZones(token),
      ]);

      setAdminUsers(usersData);
      setApplications(applicationsData);
      setCars(carsData);
      setWallet(walletData);
      setAdminBooking(bookingData);
      setAdminTrips(tripsData);
      setDestinationLocation(getTripDestination(tripsData.active));
      setDestinationRouteSummary({ distanceKm: null, durationMinutes: null });
      setAllBookings(allBookingsData);
      setAllTrips(allTripsData);
      setTariff(tariffData);
      setCoefficients(coefficientsData);
      setBonusZones(bonusZonesData);
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
    void loadAdminData(true);
  }, [token]);

  useEffect(() => {
    const dataTimer = window.setInterval(() => {
      void loadAdminData();
    }, 30000);

    return () => window.clearInterval(dataTimer);
  }, [token]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!mapMessage) {
      return;
    }

    const timer = window.setTimeout(() => setMapMessage(""), 10000);
    return () => window.clearTimeout(timer);
  }, [mapMessage]);

  useEffect(() => {
    if (adminBooking && bookingSecondsLeft === 0) {
      void loadAdminData();
    }
  }, [adminBooking, bookingSecondsLeft]);

  useEffect(() => {
    if (!message) {
      return;
    }

    const timer = window.setTimeout(() => setMessage(""), 10000);
    return () => window.clearTimeout(timer);
  }, [message]);

  const runAction = async (action: () => Promise<unknown>, successText: string) => {
    setMessage("");

    try {
      await action();
      await loadAdminData();
      setMessage(successText);
      return true;
    } catch (error) {
      setMessage(getErrorMessage(error));
      return false;
    }
  };

  const runServiceAction = async (
    action: () => Promise<unknown>,
    successText: string,
    setSectionMessage: (message: string) => void,
  ) => {
    setSectionMessage("");

    try {
      await action();
      await loadAdminData();
      setSectionMessage(successText);
    } catch (error) {
      setSectionMessage(getErrorMessage(error));
    }
  };

  const handleUserLocationChange = (coords: Coordinates) => {
    if (!isInsideMkad(coords)) {
      setMapMessage("Точку можно поставить только внутри МКАД");
      return;
    }

    setUserLocation(coords);
    setMapMessage("");
  };

  const handleBookSelectedCar = () => {
    if (hasDebt) {
      setMapMessage("Сначала погасите задолженность в кошельке");
      return;
    }

    if (!selectedCar) {
      setMapMessage("Сначала выберите машину на карте");
      return;
    }

    void runServiceAction(
      () => api.createBooking(token, selectedCar.id),
      "Машина забронирована на 15 минут",
      setMapMessage,
    );
  };

  const handleStartTrip = () => {
    if (hasDebt) {
      setMapMessage("Сначала погасите задолженность в кошельке");
      return;
    }

    if (!selectedCar) {
      setMapMessage("Сначала выберите машину на карте");
      return;
    }

    if (!userLocation) {
      setMapMessage("Сначала поставьте свою точку на карте");
      return;
    }

    setMapMessage("");
    void api
      .startTrip(token, selectedCar.id, toApiCoordinate(userLocation[0]), toApiCoordinate(userLocation[1]))
      .then(async () => {
        setSelectedCarId(null);
        setDestinationLocation(null);
        setDestinationRouteSummary({ distanceKm: null, durationMinutes: null });
        await loadAdminData();
        setMapMessage("Поездка началась. Теперь поставьте точку назначения на карте");
      })
      .catch((error) => setMapMessage(getErrorMessage(error)));
  };

  const handleDestinationChange = (coords: Coordinates) => {
    if (!activeTrip) {
      return;
    }

    if (!isInsideMkad(coords)) {
      setMapMessage("Точку назначения можно поставить только внутри МКАД");
      return;
    }

    setDestinationLocation(coords);
    setDestinationRouteSummary({ distanceKm: null, durationMinutes: null });
    void api
      .setTripDestination(token, activeTrip.id, toApiCoordinate(coords[0]), toApiCoordinate(coords[1]))
      .then((trip) => {
        setAdminTrips((current) => ({ ...current, active: trip }));
        setMapMessage("");
      })
      .catch((error) => setMapMessage(getErrorMessage(error)));
  };

  const handleFinishTrip = (setSectionMessage = setMapMessage) => {
    if (!activeTrip) {
      setSectionMessage("Активной поездки нет");
      return;
    }

    if (!destinationLocation) {
      setSectionMessage("Перед завершением поставьте точку назначения на карте");
      return;
    }

    void runServiceAction(
      () =>
        api.finishTrip(
          token,
          activeTrip.id,
          toApiCoordinate(destinationLocation[0]),
          toApiCoordinate(destinationLocation[1]),
          destinationRouteSummary.durationMinutes ?? undefined,
        ),
      "Поездка завершена",
      setSectionMessage,
    );
  };

  const bookingBelongsToSelectedCar = adminBooking?.car.id === selectedCar?.id;
  const bookingBelongsToAnotherCar = Boolean(adminBooking && selectedCar && adminBooking.car.id !== selectedCar.id);

  const handleTabChange = (nextTab: AdminTab) => {
    setTab(nextTab);
    if (nextTab === "map") setMapMessage("");
    if (nextTab === "wallet") setWalletMessage("");
    if (nextTab === "activity") setActivityMessage("");
  };

  const buildCarPayload = () => ({
    brand: carForm.brand,
    model: carForm.model,
    license_plate: carForm.license_plate,
    status: carForm.status,
    latitude: carForm.latitude,
    longitude: carForm.longitude,
    price_per_minute: carForm.price_per_minute,
  });

  const resetCarForm = () => {
    setEditingCarId(null);
    setCarForm(initialCarForm);
  };

  const handleSaveCar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const latitude = Number(carForm.latitude);
    const longitude = Number(carForm.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setMessage("Введите корректные числовые координаты автомобиля");
      return;
    }

    if (!isInsideMkad([latitude, longitude])) {
      setMessage("Автомобиль можно добавить только внутри МКАД");
      return;
    }

    const payload = buildCarPayload();
    const action = editingCarId
      ? () => api.adminUpdateCar(token, editingCarId, payload)
      : () => api.adminCreateCar(token, payload);
    const isSaved = await runAction(
      action,
      editingCarId ? "Данные автомобиля обновлены" : "Автомобиль добавлен в автопарк",
    );

    if (isSaved) {
      resetCarForm();
    }
  };

  const startEditingCar = (car: Car) => {
    setEditingCarId(car.id);
    setSelectedCarId(car.id);
    setCarForm({
      brand: car.brand,
      model: car.model,
      license_plate: car.license_plate,
      status: car.status,
      latitude: car.latitude,
      longitude: car.longitude,
      price_per_minute: car.price_per_minute,
    });
  };

  const updateCoefficientField = (coefficientId: number, field: keyof TimeCoefficient, value: string) => {
    setCoefficients((current) =>
      current.map((coefficient) =>
        coefficient.id === coefficientId ? { ...coefficient, [field]: value } : coefficient,
      ),
    );
  };

  const handleSaveCoefficient = (coefficient: TimeCoefficient) => {
    void runAction(
      () =>
        api.adminUpdateCoefficient(token, coefficient.id, {
          name: coefficient.name,
          start_time: coefficient.start_time,
          end_time: coefficient.end_time,
          coefficient: coefficient.coefficient,
        }),
      "Коэффициент сохранен",
    );
  };

  const handleZoneCenterChange = (coords: Coordinates) => {
    if (!isInsideMkad(coords)) {
      setMessage("Зону можно поставить только внутри МКАД");
      return;
    }

    setZoneForm((form) => ({
      ...form,
      latitude: toApiCoordinate(coords[0]),
      longitude: toApiCoordinate(coords[1]),
    }));
    setMessage("Центр бонусной зоны выбран на карте");
  };

  const handleSaveBonusZone = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const action = editingZoneId
      ? () => api.adminUpdateBonusZone(token, editingZoneId, zoneForm)
      : () => api.adminCreateBonusZone(token, zoneForm);
    void runAction(action, editingZoneId ? "Бонусная зона обновлена" : "Бонусная зона создана").then(() => {
      setZoneForm(initialBonusZoneForm);
      setEditingZoneId(null);
    });
  };

  const startEditingZone = (zone: BonusZone) => {
    setEditingZoneId(zone.id);
    setZoneForm({
      name: zone.name,
      latitude: zone.latitude,
      longitude: zone.longitude,
      radius_meters: String(zone.radius_meters),
      discount_percent: zone.discount_percent,
      is_active: zone.is_active,
    });
  };

  return (
    <main className="dashboard-page">
      <header className="topbar">
        <div>
          <span className="eyebrow">Администратор</span>
          <h1>{user.email}</h1>
          <p className="topbar-note">Разделы автопарка, заявок и тарифов вынесены в отдельные SPA-вкладки</p>
        </div>
        <button className="ghost-button" type="button" onClick={onLogout}>
          Выйти
        </button>
      </header>

      <TabBar<AdminTab>
        value={tab}
        onChange={handleTabChange}
        items={[
          { value: "map", label: "Карта" },
          { value: "wallet", label: "Кошелек" },
          { value: "activity", label: "Активность" },
          { value: "users", label: "Пользователи" },
          { value: "fleet", label: "Автомобили" },
          { value: "bookings", label: "Брони и поездки" },
          { value: "tariff", label: "Тариф" },
          { value: "zones", label: "Зоны" },
        ]}
      />

      {tab === "map" && (
        <section className="dashboard-stack map-layout">
          <div className="panel hero-panel">
            <div className="hero-row">
              <div>
                <span className="eyebrow">Карта Москвы</span>
                <h2>Машины рядом на карте</h2>
              </div>
            </div>
            <p className="helper-text">
              Нажмите на карту, чтобы поставить свою точку. Затем выберите машину: маршрут
              построится автоматически
            </p>
          </div>

          <div className="panel map-panel">
            <div className="map-stage">
              {mapMessage && <p className="message map-message">{mapMessage}</p>}
              <FleetMap
                cars={cars}
                selectedCarId={selectedCarId}
                onCarSelect={setSelectedCarId}
                userLocation={activeTrip ? null : userLocation}
                onUserLocationChange={activeTrip ? undefined : handleUserLocationChange}
                routeCar={activeTrip ? null : selectedCar}
                destinationLocation={destinationLocation}
                onDestinationLocationChange={activeTrip ? handleDestinationChange : undefined}
                routeFrom={activeTripStart}
                onRouteSummaryChange={setDestinationRouteSummary}
                bonusZones={bonusZones.filter((zone) => zone.is_active)}
              />

              {activeTrip && (
                <aside className="map-popup trip-popup">
                  <span className="status-pill info">Поездка идет</span>
                  <h3>
                    {activeTrip.car.brand} {activeTrip.car.model}
                  </h3>
                  <p className="popup-lead">Поставьте на карте точку назначения</p>
                  <div className="detail-list">
                    <div>
                      <span>Цена машины</span>
                      <strong>{formatMoney(activeTrip.price_per_minute)} / мин</strong>
                    </div>
                    <div>
                      <span>Маршрут</span>
                      <strong>
                        {destinationRouteSummary.distanceKm === null
                          ? destinationLocation
                            ? "Строится..."
                            : "Выберите точку"
                          : `${destinationRouteSummary.distanceKm} км`}
                      </strong>
                    </div>
                    <div>
                      <span>Время маршрута</span>
                      <strong>
                        {destinationRouteSummary.durationMinutes === null
                          ? "Оценка появится после маршрута"
                          : `${destinationRouteSummary.durationMinutes} мин`}
                      </strong>
                    </div>
                    <div>
                      <span>Примерно</span>
                      <strong>{estimatedTripPrice ? formatMoney(estimatedTripPrice) : "После выбора точки"}</strong>
                    </div>
                  </div>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={!destinationLocation || destinationRouteSummary.durationMinutes === null}
                    onClick={() => handleFinishTrip(setMapMessage)}
                  >
                    Завершить поездку
                  </button>
                </aside>
              )}

              {!activeTrip && selectedCar && (
                <aside className="map-popup car-popup">
                  <button
                    className="map-popup-close"
                    type="button"
                    aria-label="Закрыть карточку машины"
                    onClick={() => setSelectedCarId(null)}
                  >
                    ×
                  </button>
                  <span className={`status-pill ${getStatusTone(selectedCar.status)}`}>
                    {selectedCar.status_label}
                  </span>
                  <h3>
                    {selectedCar.brand} {selectedCar.model}
                  </h3>
                  <p className="popup-lead">Госномер: {selectedCar.license_plate}</p>
                  <div className="detail-list">
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
                    <div>
                      <span>Цена</span>
                      <strong>{formatMoney(selectedCar.price_per_minute)} / мин</strong>
                    </div>
                  </div>
                  <div className="button-row">
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={hasDebt || Boolean(activeTrip || adminBooking)}
                      onClick={handleBookSelectedCar}
                    >
                      {bookingBelongsToSelectedCar
                        ? "Уже забронирована"
                        : adminBooking
                          ? "Есть активная бронь"
                          : "Забронировать"}
                    </button>
                    <button
                      className="primary-button"
                      type="button"
                      disabled={hasDebt || !userLocation || Boolean(activeTrip) || bookingBelongsToAnotherCar}
                      onClick={handleStartTrip}
                    >
                      {activeTrip ? "Поездка уже идет" : "Начать поездку"}
                    </button>
                  </div>
                  {hasDebt && (
                    <p className="inline-note">
                      Есть задолженность. Пополните кошелек, чтобы снова бронировать и начинать поездки
                    </p>
                  )}
                  {!hasDebt && !userLocation && (
                    <p className="inline-note">
                      Чтобы начать поездку, поставьте свою точку на карте
                    </p>
                  )}
                  {!hasDebt && userLocation && bookingBelongsToAnotherCar && (
                    <p className="inline-note">
                      У вас уже есть активная бронь на другую машину. Сначала отмените ее в разделе активности
                    </p>
                  )}
                </aside>
              )}
            </div>
          </div>
        </section>
      )}

      {tab === "wallet" && (
        <section className="dashboard-grid wallet-layout">
          <div className="panel">
            <span className="eyebrow">Баланс</span>
            <h2>Кошелек</h2>
            <p className="big-number">{formatMoney(wallet?.balance ?? user.balance)}</p>
            {hasDebt && (
              <p className="inline-note">
                Сейчас есть задолженность {formatMoney(Math.abs(Number(wallet?.balance ?? user.balance)))}
              </p>
            )}
            <div className="inline-form wallet-top-up-form">
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
                  void runServiceAction(() => api.topUp(token, topUpAmount), "Баланс успешно пополнен", setWalletMessage)
                }
              >
                Пополнить
              </button>
            </div>
            {walletMessage && <p className="message section-message wallet-message">{walletMessage}</p>}
          </div>

          <div className="panel wide-panel">
            <span className="eyebrow">Операции</span>
            <h2>История кошелька</h2>
            {wallet?.transactions.length ? (
              <div className="simple-list history-list">
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
              <p className="muted">Операций пока нет</p>
            )}
          </div>
        </section>
      )}

      {tab === "activity" && (
        <section className="dashboard-grid activity-layout">
          {activityMessage && <p className="message section-message activity-message">{activityMessage}</p>}
          <div className={`panel ${adminBooking ? "booking-activity-panel" : ""}`}>
            <span className="eyebrow">Бронирование</span>
            <h2>Активная бронь</h2>
            {adminBooking ? (
              <>
                <p className="panel-title">
                  {adminBooking.car.brand} {adminBooking.car.model}
                </p>
                <p className="helper-text">Бронь действует 15 минут, затем снимается автоматически</p>
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
                      void runServiceAction(
                        () => api.cancelBooking(token, adminBooking.id),
                        "Бронирование отменено",
                        setActivityMessage,
                      )
                    }
                  >
                    Отменить бронь
                  </button>
                </div>
              </>
            ) : (
              <p className="muted">Сейчас нет активной брони</p>
            )}
          </div>

          <div className={`panel ${activeTrip ? "trip-activity-panel" : ""}`}>
            <span className="eyebrow">Поездка</span>
            <h2>Активная поездка</h2>
            {activeTrip ? (
              <>
                <p className="panel-title">
                  {activeTrip.car.brand} {activeTrip.car.model}
                </p>
                <div className="button-row">
                  <button className="ghost-button" type="button" onClick={() => setTab("map")}>
                    Вернуться к карте
                  </button>
                  <button className="primary-button" type="button" onClick={() => handleFinishTrip(setActivityMessage)}>
                    Завершить поездку
                  </button>
                </div>
              </>
            ) : (
              <p className="muted">Активной поездки нет</p>
            )}
          </div>

          <div className="panel wide-panel">
            <span className="eyebrow">История</span>
            <h2>История поездок</h2>
            {history.length ? (
              <div className="simple-list history-list">
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
              <p className="muted">История поездок пока пустая</p>
            )}
          </div>
        </section>
      )}

      {tab === "users" && (
        <section className="dashboard-grid">
          <div className="panel">
            <span className="eyebrow">Модерация</span>
            <h2>Заявки пользователей</h2>
            {pendingUsers.length === 0 ? (
              <p className="muted">Новых заявок сейчас нет</p>
            ) : (
              <div className="simple-list section-content-offset">
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
                            "Заявка одобрена",
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
                            "Заявка отклонена",
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

          <div className="panel">
            <span className="eyebrow">Пользователи</span>
            <h2>Список пользователей</h2>
            <div className="simple-list section-content-offset">
              {adminUsers.map((item) => (
                <div className="application-card" key={item.id}>
                  <div>
                    <strong>{item.full_name || buildFullName(item)}</strong>
                    <span>{item.email}</span>
                    <span>Телефон: {item.phone}</span>
                    <span>Статус заявки: {item.verification_status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {tab === "fleet" && (
        <section className="dashboard-grid fleet-layout">
          <div className="panel">
            <span className="eyebrow">{editingCarId ? "Редактирование" : "Добавление"}</span>
            <h2>{editingCarId ? "Данные автомобиля" : "Новый автомобиль"}</h2>
            <form className="form-stack" onSubmit={handleSaveCar}>
              <label>
                Марка
                <input value={carForm.brand} onChange={(event) => setCarForm((form) => ({ ...form, brand: event.target.value }))} required />
              </label>
              <label>
                Модель
                <input value={carForm.model} onChange={(event) => setCarForm((form) => ({ ...form, model: event.target.value }))} required />
              </label>
              <label>
                Госномер
                <input
                  value={carForm.license_plate}
                  onChange={(event) =>
                    setCarForm((form) => ({
                      ...form,
                      license_plate: event.target.value.replace(/[\s-]+/g, "").toUpperCase(),
                    }))
                  }
                  maxLength={9}
                  pattern={licensePlatePattern}
                  title="Введите госномер в формате А123ВС77 или А123ВС777"
                  required
                />
              </label>
              <label>
                Статус
                <select value={carForm.status} onChange={(event) => setCarForm((form) => ({ ...form, status: event.target.value }))}>
                  <option value="available">Доступен</option>
                  <option value="booked">Забронирован</option>
                  <option value="in_trip">В поездке</option>
                  <option value="service">На обслуживании</option>
                  <option value="inactive">Неактивен</option>
                </select>
              </label>
              <div className="two-columns">
                <label>
                  Широта
                  <input
                    value={carForm.latitude}
                    onChange={(event) => setCarForm((form) => ({ ...form, latitude: event.target.value }))}
                    onKeyDown={(event) => {
                      if (blockedNumberKeys.includes(event.key)) event.preventDefault();
                    }}
                    type="number"
                    inputMode="decimal"
                    min="55.55"
                    max="55.92"
                    step="0.000001"
                    required
                  />
                </label>
                <label>
                  Долгота
                  <input
                    value={carForm.longitude}
                    onChange={(event) => setCarForm((form) => ({ ...form, longitude: event.target.value }))}
                    onKeyDown={(event) => {
                      if (blockedNumberKeys.includes(event.key)) event.preventDefault();
                    }}
                    type="number"
                    inputMode="decimal"
                    min="37.35"
                    max="37.86"
                    step="0.000001"
                    required
                  />
                </label>
              </div>
              <label>
                Цена за минуту
                <input
                  value={carForm.price_per_minute}
                  onChange={(event) => setCarForm((form) => ({ ...form, price_per_minute: event.target.value }))}
                  onKeyDown={(event) => {
                    if (blockedNumberKeys.includes(event.key) || event.key === "-") event.preventDefault();
                  }}
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  required
                />
              </label>
              <button className="primary-button" type="submit">
                {editingCarId ? "Сохранить" : "Добавить"}
              </button>
              {editingCarId && (
                <button
                  className="ghost-button"
                  type="button"
                  onClick={resetCarForm}
                >
                  Новый автомобиль
                </button>
              )}
            </form>
          </div>

          <div className="panel">
            <span className="eyebrow">Автомобили</span>
            <h2>Список автопарка</h2>
            <div className="simple-list section-content-offset">
              {cars.map((car) => (
                <div className="list-card" key={car.id}>
                  <div>
                    <strong>
                      {car.brand} {car.model}
                    </strong>
                    <span>{car.license_plate}</span>
                    <span>{car.status_label}</span>
                  </div>
                  <div className="button-row">
                    <strong>{formatMoney(car.price_per_minute)} / мин</strong>
                    <button className="ghost-button" type="button" onClick={() => startEditingCar(car)}>
                      Редактировать
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {tab === "bookings" && (
        <section className="dashboard-grid">
          <div className="panel">
            <span className="eyebrow">Брони</span>
            <h2>Все бронирования</h2>
            <div className="simple-list section-content-offset">
              {allBookings.map((bookingItem) => (
                <div className="list-card" key={bookingItem.id}>
                  <div>
                    <strong>
                      {bookingItem.car.brand} {bookingItem.car.model}
                    </strong>
                    <span>{bookingItem.user?.email ?? "Пользователь"}</span>
                    <span>{formatDateTime(bookingItem.created_at)}</span>
                  </div>
                  <strong>{bookingItem.status}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <span className="eyebrow">Поездки</span>
            <h2>Все поездки</h2>
            <div className="simple-list section-content-offset">
              {allTrips.map((trip) => (
                <div className="list-card" key={trip.id}>
                  <div>
                    <strong>
                      {trip.car.brand} {trip.car.model}
                    </strong>
                    <span>{trip.user?.email ?? "Пользователь"}</span>
                    <span>
                      {formatDateTime(trip.started_at)} · {trip.total_minutes} мин
                    </span>
                    {trip.bonus_zone_name && <span>Скидка: {trip.bonus_zone_name}</span>}
                  </div>
                  <strong>{trip.status === "completed" ? formatMoney(trip.total_price) : "Активна"}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {tab === "zones" && (
        <section className="dashboard-grid">
          <div className="panel wide-panel">
            <div className="hero-row">
              <div>
                <span className="eyebrow">Бонусные зоны</span>
                <h2>Зоны возврата на карте</h2>
              </div>
              <span className="badge">Скидка при финише в зоне</span>
            </div>
            <div className="map-stage admin-map">
              <FleetMap
                cars={cars}
                selectedCarId={selectedCarId}
                onCarSelect={setSelectedCarId}
                routeCar={null}
                bonusZones={bonusZones}
                onBonusZoneCenterChange={handleZoneCenterChange}
              />
            </div>
          </div>

          <div className="panel">
            <span className="eyebrow">{editingZoneId ? "Редактирование" : "Создание"}</span>
            <h2>{editingZoneId ? "Бонусная зона" : "Новая зона"}</h2>
            <p className="helper-text">Кликните по карте, чтобы выбрать центр зоны. Пользователь увидит активные зоны на своей карте.</p>
            <form className="form-stack" onSubmit={handleSaveBonusZone}>
              <input
                placeholder="Название зоны"
                value={zoneForm.name}
                onChange={(event) => setZoneForm((form) => ({ ...form, name: event.target.value }))}
                required
              />
              <div className="two-columns">
                <input
                  placeholder="Широта"
                  value={zoneForm.latitude}
                  onChange={(event) => setZoneForm((form) => ({ ...form, latitude: event.target.value }))}
                  required
                />
                <input
                  placeholder="Долгота"
                  value={zoneForm.longitude}
                  onChange={(event) => setZoneForm((form) => ({ ...form, longitude: event.target.value }))}
                  required
                />
              </div>
              <div className="two-columns">
                <input
                  placeholder="Радиус, м"
                  value={zoneForm.radius_meters}
                  onChange={(event) => setZoneForm((form) => ({ ...form, radius_meters: event.target.value }))}
                  required
                />
                <input
                  placeholder="Скидка, %"
                  value={zoneForm.discount_percent}
                  onChange={(event) => setZoneForm((form) => ({ ...form, discount_percent: event.target.value }))}
                  required
                />
              </div>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={zoneForm.is_active}
                  onChange={(event) => setZoneForm((form) => ({ ...form, is_active: event.target.checked }))}
                />
                Активна для пользователей
              </label>
              <button className="primary-button" type="submit">
                {editingZoneId ? "Сохранить зону" : "Создать зону"}
              </button>
              {editingZoneId && (
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => {
                    setEditingZoneId(null);
                    setZoneForm(initialBonusZoneForm);
                  }}
                >
                  Новая зона
                </button>
              )}
            </form>
          </div>

          <div className="panel">
            <span className="eyebrow">Список</span>
            <h2>Все зоны</h2>
            <div className="simple-list section-content-offset">
              {bonusZones.map((zone) => (
                <div className="list-card" key={zone.id}>
                  <div>
                    <strong>{zone.name}</strong>
                    <span>{zone.radius_meters} м · скидка {zone.discount_percent}%</span>
                    <span>{zone.is_active ? "Активна" : "Скрыта"}</span>
                  </div>
                  <div className="button-row">
                    <button className="ghost-button" type="button" onClick={() => startEditingZone(zone)}>
                      Редактировать
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() =>
                        void runAction(
                          () => api.adminUpdateBonusZone(token, zone.id, { is_active: !zone.is_active }),
                          zone.is_active ? "Зона скрыта" : "Зона активирована",
                        )
                      }
                    >
                      {zone.is_active ? "Скрыть" : "Включить"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {tab === "tariff" && (
        <section className="dashboard-stack">
          <div className="panel">
            <span className="eyebrow">Час пик</span>
            <h2>Коэффициенты спроса</h2>
            <div className="coefficient-table section-content-offset">
              <div className="coefficient-table-header">
                <div className="coefficient-form-row coefficient-header-fields">
                  <span>Название</span>
                  <span>Начало</span>
                  <span>Конец</span>
                  <span>Коэффициент</span>
                </div>
                <span className="coefficient-header-action"></span>
              </div>
              {coefficients.map((coefficient) => (
                <div className="list-card coefficient-card" key={coefficient.id}>
                  <div className="coefficient-form-row">
                    <div>
                      <input
                        aria-label="Название"
                        value={coefficient.name}
                        onChange={(event) => updateCoefficientField(coefficient.id, "name", event.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <input
                        aria-label="Начало"
                        type="time"
                        value={coefficient.start_time.slice(0, 5)}
                        onChange={(event) => updateCoefficientField(coefficient.id, "start_time", event.target.value)}
                        min="00:00"
                        max="23:59"
                        step="60"
                        required
                      />
                    </div>
                    <div>
                      <input
                        aria-label="Конец"
                        type="time"
                        value={coefficient.end_time.slice(0, 5)}
                        onChange={(event) => updateCoefficientField(coefficient.id, "end_time", event.target.value)}
                        min="00:00"
                        max="23:59"
                        step="60"
                        required
                      />
                    </div>
                    <div>
                      <input
                        aria-label="Коэффициент"
                        type="number"
                        inputMode="decimal"
                        value={coefficient.coefficient}
                        onChange={(event) => updateCoefficientField(coefficient.id, "coefficient", event.target.value)}
                        onKeyDown={(event) => {
                          if (blockedNumberKeys.includes(event.key) || event.key === "-") event.preventDefault();
                        }}
                        min="0.01"
                        max="9"
                        step="0.01"
                        required
                      />
                    </div>
                  </div>
                  <button className="primary-button" type="button" onClick={() => handleSaveCoefficient(coefficient)}>
                    Сохранить
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {message && <p className="message fixed-message">{message}</p>}
      {isRefreshing && <p className="loading-banner">Синхронизируем карту, бронь и поездки...</p>}
    </main>
  );
}

export default App;

