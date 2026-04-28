// @ts-nocheck
import { FormEvent, useEffect, useState } from "react";

import { AdminUsersSection } from "../components/AdminUsersSection";
import { CarList } from "../components/CarList";
import { FleetMap } from "../components/FleetMap";
import { TabBar } from "../components/TabBar";
import {
  blockedNumberKeys,
  initialBonusZoneForm,
  initialCarForm,
  licensePlatePattern,
} from "../constants";
import type { AdminTab, BonusZoneForm, BonusZonePreview, CarForm, Coordinates, RouteSummary } from "../types";
import type { Booking, BonusZone, Car, Tariff, TimeCoefficient, Trip, User, Wallet } from "../utils/api";
import { api } from "../utils/api";
import { formatCountdown, formatDateTime, formatMoney } from "../utils/format";
import { calculateDistanceKm, getCarCoords, isInsideMkad, toApiCoordinate } from "../utils/map";
import { getErrorMessage } from "../utils/messages";
import { calculateEstimatedTripPrice, getBookingSecondsLeft, getTripDestination } from "../utils/trips";
import { getStatusTone } from "../utils/users";

export function AdminDashboard({ token, user, onLogout }: { token: string; user: User; onLogout: () => void }) {
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
  const [fleetSelectedCarId, setFleetSelectedCarId] = useState<number | null>(null);
  const [editingCarId, setEditingCarId] = useState<number | null>(null);
  const [isPickingCarLocation, setIsPickingCarLocation] = useState(false);
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
  const carPlacementLocation =
    Number.isFinite(Number(carForm.latitude)) && Number.isFinite(Number(carForm.longitude))
      ? ([Number(carForm.latitude), Number(carForm.longitude)] as Coordinates)
      : null;
  const primaryBonusZone = bonusZones[0] ?? null;
  const bonusZonePreview =
    zoneForm.latitude && zoneForm.longitude && Number(zoneForm.radius_meters) > 0
      ? {
          latitude: zoneForm.latitude,
          longitude: zoneForm.longitude,
          radius_meters: zoneForm.radius_meters,
          name: "Бонусная зона",
        }
      : null;
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
      setFleetSelectedCarId((currentSelectedCarId) => {
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
    if (tab !== "zones" || !primaryBonusZone || zoneForm.latitude || zoneForm.longitude) {
      return;
    }

    startEditingZone(primaryBonusZone);
  }, [tab, primaryBonusZone?.id, zoneForm.latitude, zoneForm.longitude]);

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
      if (successText) {
        setMessage(successText);
      }
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
    setMessage("");
    setMapMessage("");
    setWalletMessage("");
    setActivityMessage("");
    if (nextTab === "map") setMapMessage("");
    if (nextTab === "wallet") setWalletMessage("");
    if (nextTab === "activity") setActivityMessage("");
    if (nextTab === "zones") {
      if (primaryBonusZone) {
        startEditingZone(primaryBonusZone);
      } else {
        setEditingZoneId(null);
        setZoneForm(initialBonusZoneForm);
      }
    }
  };

  const buildCarPayload = () => ({
    brand: carForm.brand,
    model: carForm.model,
    license_plate: carForm.license_plate,
    latitude: carForm.latitude,
    longitude: carForm.longitude,
    price_per_minute: carForm.price_per_minute,
  });

  const resetCarForm = () => {
    setEditingCarId(null);
    setIsPickingCarLocation(false);
    setCarForm(initialCarForm);
  };

  const handleCarLocationChange = (coords: Coordinates) => {
    if (!isInsideMkad(coords)) {
      setMapMessage("Автомобиль можно поставить только внутри МКАД");
      return;
    }

    setMapMessage("");
    setCarForm((form) => ({
      ...form,
      latitude: toApiCoordinate(coords[0]),
      longitude: toApiCoordinate(coords[1]),
    }));
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
      editingCarId ? "" : "Автомобиль добавлен в автопарк",
    );

    if (isSaved) {
      setIsPickingCarLocation(false);
      resetCarForm();
    }
  };

  const startEditingCar = (car: Car) => {
    setEditingCarId(car.id);
    setIsPickingCarLocation(true);
    setFleetSelectedCarId(car.id);
    setCarForm({
      brand: car.brand,
      model: car.model,
      license_plate: car.license_plate,
      latitude: car.latitude,
      longitude: car.longitude,
      price_per_minute: car.price_per_minute,
    });
  };

  const handleDeleteCar = (car: Car) => {
    void runAction(
      async () => {
        await api.adminDeleteCar(token, car.id);
        if (editingCarId === car.id) {
          resetCarForm();
        }
      },
      "Автомобиль удален из автопарка",
    );
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
      setMapMessage("Зону можно поставить только внутри МКАД");
      return;
    }

    setMapMessage("");
    setZoneForm((form) => ({
      ...form,
      latitude: toApiCoordinate(coords[0]),
      longitude: toApiCoordinate(coords[1]),
    }));
  };

  const handleSaveBonusZone = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!zoneForm.latitude || !zoneForm.longitude) {
      setMessage("Сначала выберите центр зоны кликом по карте");
      return;
    }

    const payload = {
      ...zoneForm,
      name: "Бонусная зона",
      discount_percent: "10.00",
      is_active: true,
    };
    const zoneId = editingZoneId ?? primaryBonusZone?.id ?? null;

    setMessage("");
    try {
      const savedZone = zoneId
        ? await api.adminUpdateBonusZone(token, zoneId, payload)
        : await api.adminCreateBonusZone(token, payload);
      await loadAdminData();
      setEditingZoneId(savedZone.id);
      setZoneForm({
        name: "Бонусная зона",
        latitude: savedZone.latitude,
        longitude: savedZone.longitude,
        radius_meters: String(savedZone.radius_meters),
        discount_percent: savedZone.discount_percent,
        is_active: true,
      });
      setMessage("Бонусная зона сохранена");
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  };

  const startEditingZone = (zone: BonusZone) => {
    setEditingZoneId(zone.id);
    setZoneForm({
      name: "Бонусная зона",
      latitude: zone.latitude,
      longitude: zone.longitude,
      radius_meters: String(zone.radius_meters),
      discount_percent: "10.00",
      is_active: true,
    });
  };

  return (
    <main className="dashboard-page">
      <header className="topbar">
        <div>
          <span className="eyebrow">Администратор</span>
          <h1>Панель администратора</h1>
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
        <AdminUsersSection
          applications={pendingUsers}
          users={adminUsers}
          onApprove={(item) =>
            void runAction(
              () => api.adminUserAction(token, item.id, "approve"),
              "Заявка одобрена",
            )
          }
          onReject={(item) =>
            void runAction(
              () => api.adminUserAction(token, item.id, "reject"),
              "Заявка отклонена",
            )
          }
        />
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
              <button
                className="ghost-button"
                type="button"
                onClick={() => {
                  setIsPickingCarLocation((value) => !value);
                  setMapMessage("");
                }}
              >
                {isPickingCarLocation ? "Показать список автомобилей" : "Выбрать точку на карте"}
              </button>
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

          {isPickingCarLocation ? (
            <div className="panel map-panel">
              <div className="map-stage">
                {mapMessage && <p className="message map-message">{mapMessage}</p>}
                <FleetMap
                  cars={cars}
                  selectedCarId={fleetSelectedCarId}
                  onCarSelect={setFleetSelectedCarId}
                  placementLocation={carPlacementLocation}
                  onPlacementLocationChange={handleCarLocationChange}
                  bonusZones={bonusZones.filter((zone) => zone.is_active)}
                />
              </div>
            </div>
          ) : (
            <CarList cars={cars} onEdit={startEditingCar} onDelete={handleDeleteCar} />
          )}
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
        <section className="dashboard-grid zones-layout">
          <div className="panel wide-panel">
            <div className="map-stage admin-map">
              {mapMessage && <p className="message map-message">{mapMessage}</p>}
              <FleetMap
                cars={cars}
                selectedCarId={selectedCarId}
                onCarSelect={setSelectedCarId}
                routeCar={null}
                bonusZones={bonusZonePreview ? [] : primaryBonusZone ? [primaryBonusZone] : []}
                bonusZonePreview={bonusZonePreview}
                onBonusZoneCenterChange={handleZoneCenterChange}
              />
            </div>
          </div>

          <div className="panel">
            <span className="eyebrow">Редактирование</span>
            <h2>Бонусная зона</h2>
            <p className="helper-text">Нажмите на карту для выбора центра зоны, затем задайте радиус</p>
            <form className="form-stack" onSubmit={handleSaveBonusZone}>
              <label>
                Радиус, м
                <input
                  value={zoneForm.radius_meters}
                  onChange={(event) => setZoneForm((form) => ({ ...form, radius_meters: event.target.value }))}
                  onKeyDown={(event) => {
                    if (blockedNumberKeys.includes(event.key) || event.key === "-" || event.key === ".") event.preventDefault();
                  }}
                  type="number"
                  inputMode="numeric"
                  min="50"
                  max="5000"
                  step="10"
                  required
                />
              </label>
              <button className="primary-button" type="submit">
                Сохранить зону
              </button>
            </form>
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
