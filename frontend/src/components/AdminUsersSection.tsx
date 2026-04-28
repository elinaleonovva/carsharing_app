import type { User } from "../utils/api";
import { buildFullName, getVerificationStatusLabel } from "../utils/users";

type AdminUsersSectionProps = {
  applications: User[];
  users: User[];
  onApprove: (user: User) => void;
  onReject: (user: User) => void;
};

export function AdminUsersSection({ applications, users, onApprove, onReject }: AdminUsersSectionProps) {
  return (
    <section className="dashboard-grid">
      <div className="panel">
        <span className="eyebrow">Модерация</span>
        <h2>Заявки пользователей</h2>
        {applications.length === 0 ? (
          <p className="muted">Новых заявок сейчас нет</p>
        ) : (
          <div className="simple-list section-content-offset">
            {applications.map((item) => (
              <div className="application-card" key={item.id}>
                <div>
                  <strong>{item.full_name || buildFullName(item)}</strong>
                  <span>{item.email}</span>
                  <span>Телефон: {item.phone}</span>
                  <span>ВУ: {item.driver_license_number}</span>
                </div>
                <div className="button-row">
                  <button className="primary-button" type="button" onClick={() => onApprove(item)}>
                    Одобрить
                  </button>
                  <button className="ghost-button" type="button" onClick={() => onReject(item)}>
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
          {users.map((item) => (
            <div className="application-card" key={item.id}>
              <div>
                <strong>{item.full_name || buildFullName(item)}</strong>
                <span>{item.email}</span>
                <span>Телефон: {item.phone}</span>
                <span>Статус заявки: {getVerificationStatusLabel(item.verification_status)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
