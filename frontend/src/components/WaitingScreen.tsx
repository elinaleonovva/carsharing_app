import type { User } from "../utils/api";

type WaitingScreenProps = {
  user: User;
  onLogout: () => void;
};

export function WaitingScreen({ user, onLogout }: WaitingScreenProps) {
  const isRejected = user.verification_status === "rejected";

  return (
    <main className="single-page">
      <section className="status-card">
        <span className="eyebrow">Статус заявки</span>
        <h2>{isRejected ? "Заявка отклонена" : "Заявка отправлена"}</h2>
        <p>
          {isRejected
            ? "Администратор отклонил заявку. Проверьте данные и попробуйте снова"
            : "Как только администратор подтвердит аккаунт, откроется доступ к карте, кошельку и поездкам"}
        </p>
        <button className="ghost-button" type="button" onClick={onLogout}>
          Выйти
        </button>
      </section>
    </main>
  );
}
