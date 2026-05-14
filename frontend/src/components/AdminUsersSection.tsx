import type { User } from "../utils/api";
import { buildFullName } from "../utils/users";

type AdminUsersSectionProps = {
  users: User[];
};

export function AdminUsersSection({ users }: AdminUsersSectionProps) {
  return (
    <section className="dashboard-grid">
      <div className="panel wide-panel">
        <span className="eyebrow">Пользователи</span>
        <h2>Список пользователей</h2>
        <div className="simple-list section-content-offset">
          {users.map((item) => (
            <div className="application-card" key={item.id}>
              <div>
                <strong>{item.full_name || buildFullName(item)}</strong>
                <span>{item.email}</span>
                <span>Телефон: {item.phone}</span>
                <span>{item.is_blocked ? "Аккаунт заблокирован" : "Аккаунт активен"}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
