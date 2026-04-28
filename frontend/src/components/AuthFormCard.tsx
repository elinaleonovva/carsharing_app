import { FormEvent } from "react";

import type { AuthForm, AuthMode } from "../types";
import {
  normalizeDriverLicenseInput,
  normalizePersonNameInput,
  normalizePhoneInput,
} from "../utils/validation";

type AuthFormCardProps = {
  mode: AuthMode;
  form: AuthForm;
  isLoading: boolean;
  onModeChange: (mode: AuthMode) => void;
  onFieldChange: (field: keyof AuthForm, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function AuthFormCard({
  mode,
  form,
  isLoading,
  onModeChange,
  onFieldChange,
  onSubmit,
}: AuthFormCardProps) {
  return (
    <div className={mode === "register" ? "auth-card auth-card--compact" : "auth-card"}>
      <div className="mode-switch" role="tablist" aria-label="Выбор формы">
        <button className={mode === "login" ? "active" : ""} type="button" onClick={() => onModeChange("login")}>
          Вход
        </button>
        <button className={mode === "register" ? "active" : ""} type="button" onClick={() => onModeChange("register")}>
          Регистрация
        </button>
      </div>

      <form className="form-stack auth-form" onSubmit={onSubmit} noValidate>
        <label className="auth-field">
          Email
          <input
            className="auth-input"
            value={form.email}
            onChange={(event) => onFieldChange("email", event.target.value.trimStart())}
            type="email"
            placeholder="name@example.com"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            required
          />
        </label>

        {mode === "register" && (
          <>
            <div className="two-columns auth-two-columns">
              <label className="auth-field">
                Фамилия
                <input
                  className="auth-input"
                  value={form.last_name}
                  onChange={(event) => onFieldChange("last_name", normalizePersonNameInput(event.target.value))}
                  maxLength={150}
                  required
                />
              </label>
              <label className="auth-field">
                Имя
                <input
                  className="auth-input"
                  value={form.first_name}
                  onChange={(event) => onFieldChange("first_name", normalizePersonNameInput(event.target.value))}
                  maxLength={150}
                  required
                />
              </label>
            </div>
            <label className="auth-field">
              Отчество
              <input
                className="auth-input"
                value={form.patronymic}
                onChange={(event) => onFieldChange("patronymic", normalizePersonNameInput(event.target.value))}
                maxLength={150}
                required
              />
            </label>
            <label className="auth-field">
              Телефон
              <input
                className="auth-input"
                value={form.phone}
                onChange={(event) => onFieldChange("phone", normalizePhoneInput(event.target.value))}
                placeholder="79990001122"
                inputMode="numeric"
                autoComplete="tel"
                maxLength={11}
                required
              />
            </label>
            <label className="auth-field">
              Номер водительского удостоверения
              <input
                className="auth-input"
                value={form.driver_license_number}
                onChange={(event) =>
                  onFieldChange("driver_license_number", normalizeDriverLicenseInput(event.target.value))
                }
                placeholder="12 34 123456"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                maxLength={13}
                required
              />
            </label>
          </>
        )}

        <div className={mode === "register" ? "two-columns auth-two-columns" : "auth-password-row"}>
          <label className="auth-field">
            Пароль
            <input
              className="auth-input"
              value={form.password}
              onChange={(event) => onFieldChange("password", event.target.value)}
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
            />
          </label>
          {mode === "register" && (
            <label className="auth-field">
              Повтор пароля
              <input
                className="auth-input"
                value={form.password_confirm}
                onChange={(event) => onFieldChange("password_confirm", event.target.value)}
                type="password"
                autoComplete="new-password"
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
  );
}
