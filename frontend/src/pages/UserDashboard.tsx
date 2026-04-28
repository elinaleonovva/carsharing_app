// @ts-nocheck
import { useEffect, useState } from "react";

import { FleetMap } from "../components/FleetMap";
import { TabBar } from "../components/TabBar";
import { useAutoDismissMessage } from "../hooks/useAutoDismissMessage";
import { useCurrentTime } from "../hooks/useCurrentTime";
import { usePolling } from "../hooks/usePolling";
import type { Coordinates, RouteSummary, UserTab } from "../types";
import type { Booking, BonusZone, Car, Trip, User, Wallet } from "../utils/api";
import { api } from "../utils/api";
import { UserActivitySection } from "../components/UserActivitySection";
import { UserWalletSection } from "../components/UserWalletSection";
import { formatCountdown, formatMoney } from "../utils/format";
import { calculateDistanceKm, getCarCoords, isInsideMkad, toApiCoordinate } from "../utils/map";
import { getErrorMessage } from "../utils/messages";
import { calculateEstimatedTripPrice, getBookingSecondsLeft, getTripDestination } from "../utils/trips";
import { buildFullName, getStatusTone } from "../utils/users";

export function UserDashboard({ token, user, onLogout }: { token: string; user: User; onLogout: () => void }) {
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
  const now = useCurrentTime();
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

  usePolling(() => void loadData(), 30000, [token]);
  useAutoDismissMessage(mapMessage, setMapMessage, 10000);

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
        <UserWalletSection
          balance={user.balance}
          wallet={wallet}
          hasDebt={hasDebt}
          topUpAmount={topUpAmount}
          message={walletMessage}
          onTopUpAmountChange={setTopUpAmount}
          onTopUp={() =>
            void runAction(() => api.topUp(token, topUpAmount), "Баланс успешно пополнен", setWalletMessage)
          }
        />
      )}

      {tab === "activity" && (
        <UserActivitySection
          booking={booking}
          activeTrip={activeTrip}
          history={history}
          bookingSecondsLeft={bookingSecondsLeft}
          message={activityMessage}
          onOpenMap={() => setTab("map")}
          onCancelBooking={(bookingToCancel) =>
            void runAction(
              () => api.cancelBooking(token, bookingToCancel.id),
              "Бронирование отменено",
              setActivityMessage,
            )
          }
          onFinishTrip={() => handleFinishTrip(setActivityMessage)}
        />
      )}

      {isRefreshing && <p className="loading-banner">Синхронизируем карту, бронь и поездки...</p>}
    </main>
  );
}
