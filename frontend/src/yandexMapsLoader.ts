// @ts-nocheck
import { appConfig } from "./appConfig";

const SCRIPT_ID = "yandex-maps-api-script";

let loadPromise: Promise<YMapsApi> | null = null;

export function getYandexMapsApiKey(): string {
  return appConfig.yandexMapsApiKey;
}

export function loadYandexMaps(): Promise<YMapsApi> {
  if (!appConfig.yandexMapsApiKey) {
    return Promise.reject(new Error("Для карты нужен ключ APP_YANDEX_MAPS_API_KEY"));
  }

  if (window.ymaps) {
    return new Promise((resolve) => {
      window.ymaps.ready(() => resolve(window.ymaps as YMapsApi));
    });
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener("error", () => {
        reject(new Error("Не удалось загрузить Яндекс Карты"));
      });
      existingScript.addEventListener("load", () => {
        window.ymaps?.ready(() => resolve(window.ymaps as YMapsApi));
      });
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${appConfig.yandexMapsApiKey}&lang=${appConfig.yandexMapsLang}&load=package.full`;
    script.onload = () => {
      window.ymaps?.ready(() => resolve(window.ymaps as YMapsApi));
    };
    script.onerror = () => reject(new Error("Не удалось загрузить Яндекс Карты"));
    document.head.appendChild(script);
  });

  return loadPromise;
}
