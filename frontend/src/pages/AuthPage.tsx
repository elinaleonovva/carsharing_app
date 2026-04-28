// @ts-nocheck
import { FormEvent, useState } from "react";

import { AuthFormCard } from "../components/AuthFormCard";
import { initialAuthForm } from "../constants";
import { useAutoDismissMessage } from "../hooks/useAutoDismissMessage";
import type { AuthForm, AuthMode } from "../types";
import type { User } from "../utils/api";
import { api } from "../utils/api";
import { getErrorMessage } from "../utils/messages";
import {
  normalizeDriverLicenseInput,
  normalizePhoneInput,
  validateAuthForm,
} from "../utils/validation";

type AuthPageProps = {
  onLoginSuccess: (token: string, user: User) => void;
};

export function AuthPage({ onLoginSuccess }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [authForm, setAuthForm] = useState<AuthForm>(initialAuthForm);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useAutoDismissMessage(message, setMessage);

  const updateAuthForm = (field: keyof AuthForm, value: string) => {
    setAuthForm((form) => ({ ...form, [field]: value }));
  };

  const handleModeChange = (nextMode: AuthMode) => {
    setMode(nextMode);
    setMessage("");
  };

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
      if (mode === "login") {
        const response = await api.login({
          email: authForm.email.trim().toLowerCase(),
          password: authForm.password,
        });

        onLoginSuccess(response.token, response.user);
        setAuthForm(initialAuthForm);
        setMessage("Вход выполнен");
      } else {
        const response = await api.register({
          email: authForm.email.trim().toLowerCase(),
          password: authForm.password,
          password_confirm: authForm.password_confirm,
          first_name: authForm.first_name.trim().replace(/\s+/g, " "),
          last_name: authForm.last_name.trim().replace(/\s+/g, " "),
          patronymic: authForm.patronymic.trim().replace(/\s+/g, " "),
          phone: normalizePhoneInput(authForm.phone),
          driver_license_number: normalizeDriverLicenseInput(authForm.driver_license_number),
        });

        setMode("login");
        setAuthForm({
          ...initialAuthForm,
          email: authForm.email.trim().toLowerCase(),
        });
        setMessage(response.detail);
      }
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="app-shell auth-shell">
      <section className="intro-panel">
        <div className="brand-row">
          <span className="brand-mark">CP</span>
          <span className="brand-name">Carsharing Platform</span>
        </div>
        <div className="intro-copy">
          <h1>Доступ к городскому автопарку</h1>
          <p>
            Для доступа к сервису нужно зарегистрироваться и дождаться подтверждения аккаунта
          </p>
        </div>
      </section>

      <section className="work-panel">
        <AuthFormCard
          mode={mode}
          form={authForm}
          isLoading={isLoading}
          onModeChange={handleModeChange}
          onFieldChange={updateAuthForm}
          onSubmit={handleAuthSubmit}
        />

        <div className="auth-feedback-shell">
          {message && <p className="message auth-message">{message}</p>}
        </div>
      </section>
    </main>
  );
}
