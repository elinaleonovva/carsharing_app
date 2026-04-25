export const appConfig = {
  apiBaseUrl: process.env.APP_API_BASE_URL?.trim() || "/api",
  yandexMapsApiKey: process.env.APP_YANDEX_MAPS_API_KEY?.trim() || "",
  yandexMapsLang: process.env.APP_YANDEX_MAPS_LANG?.trim() || "ru_RU",
};
