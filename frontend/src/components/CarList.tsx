import type { Car } from "../utils/api";
import { formatMoney } from "../utils/format";

type CarListProps = {
  cars: Car[];
  onEdit: (car: Car) => void;
  onDelete: (car: Car) => void;
};

export function CarList({ cars, onEdit, onDelete }: CarListProps) {
  return (
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
            </div>
            <div className="button-row">
              <strong>{formatMoney(car.price_per_minute)} / мин</strong>
              <button className="ghost-button small-action-button" type="button" onClick={() => onEdit(car)}>
                Редактировать
              </button>
              <button
                className="ghost-button small-action-button danger-action-button"
                type="button"
                onClick={() => onDelete(car)}
              >
                Удалить
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
