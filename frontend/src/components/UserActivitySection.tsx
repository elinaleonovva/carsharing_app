import type { Booking, Trip } from "../utils/api";
import { formatCountdown, formatDateTime, formatMoney } from "../utils/format";

type UserActivitySectionProps = {
  booking: Booking | null;
  activeTrip: Trip | null;
  history: Trip[];
  bookingSecondsLeft: number | null;
  message: string;
  onOpenMap: () => void;
  onCancelBooking: (booking: Booking) => void;
  onFinishTrip: () => void;
};

export function UserActivitySection({
  booking,
  activeTrip,
  history,
  bookingSecondsLeft,
  message,
  onOpenMap,
  onCancelBooking,
  onFinishTrip,
}: UserActivitySectionProps) {
  return (
    <section className="dashboard-grid activity-layout">
      {message && <p className="message section-message activity-message">{message}</p>}
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
              <button className="ghost-button" type="button" onClick={onOpenMap}>
                Открыть на карте
              </button>
              <button className="secondary-button" type="button" onClick={() => onCancelBooking(booking)}>
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
              <button className="ghost-button" type="button" onClick={onOpenMap}>
                Вернуться к карте
              </button>
              <button className="primary-button" type="button" onClick={onFinishTrip}>
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
  );
}
