import type { Wallet } from "../utils/api";
import { formatDateTime, formatMoney } from "../utils/format";

type UserWalletSectionProps = {
  balance: string;
  wallet: Wallet | null;
  hasDebt: boolean;
  topUpAmount: string;
  message: string;
  onTopUpAmountChange: (value: string) => void;
  onTopUp: () => void;
};

export function UserWalletSection({
  balance,
  wallet,
  hasDebt,
  topUpAmount,
  message,
  onTopUpAmountChange,
  onTopUp,
}: UserWalletSectionProps) {
  return (
    <section className="dashboard-grid wallet-layout">
      <div className="panel">
        <span className="eyebrow">Баланс</span>
        <h2>Кошелек</h2>
        <p className="big-number">{formatMoney(wallet?.balance ?? balance)}</p>
        {hasDebt && (
          <p className="inline-note">
            Сейчас есть задолженность {formatMoney(Math.abs(Number(wallet?.balance ?? balance)))}
          </p>
        )}
        <div className="inline-form wallet-top-up-form">
          <input
            value={topUpAmount}
            onChange={(event) => onTopUpAmountChange(event.target.value)}
            type="number"
            min="1"
            step="1"
          />
          <button className="primary-button" type="button" onClick={onTopUp}>
            Пополнить
          </button>
        </div>
        {message && <p className="message section-message wallet-message">{message}</p>}
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
  );
}
