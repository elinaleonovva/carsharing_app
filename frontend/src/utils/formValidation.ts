import type { InvalidEvent } from "react";

type ValidationOptions = {
  label: string;
  min?: string | number;
  max?: string | number;
  patternMessage?: string;
};

export function clearCustomValidity(input: HTMLInputElement): void {
  input.setCustomValidity("");
}

export function setRussianValidationMessage(input: HTMLInputElement, options: ValidationOptions): void {
  const { validity } = input;

  if (validity.valueMissing) {
    input.setCustomValidity(`Заполните поле "${options.label}"`);
    return;
  }

  if (validity.typeMismatch) {
    input.setCustomValidity(`Введите корректное значение в поле "${options.label}"`);
    return;
  }

  if (validity.patternMismatch) {
    input.setCustomValidity(options.patternMessage ?? `Введите корректное значение в поле "${options.label}"`);
    return;
  }

  if (validity.rangeUnderflow) {
    input.setCustomValidity(`Значение поля "${options.label}" должно быть не меньше ${options.min}`);
    return;
  }

  if (validity.rangeOverflow) {
    input.setCustomValidity(`Значение поля "${options.label}" должно быть не больше ${options.max}`);
    return;
  }

  if (validity.stepMismatch) {
    input.setCustomValidity(`Введите допустимый шаг значения в поле "${options.label}"`);
    return;
  }

  if (validity.tooLong) {
    input.setCustomValidity(`Сократите значение в поле "${options.label}"`);
    return;
  }

  if (validity.badInput) {
    input.setCustomValidity(`Введите число в поле "${options.label}"`);
    return;
  }

  input.setCustomValidity(`Введите корректное значение в поле "${options.label}"`);
}

export function russianValidation(options: ValidationOptions) {
  return (event: InvalidEvent<HTMLInputElement>) => {
    setRussianValidationMessage(event.currentTarget, options);
  };
}
