declare module "*.css";
declare module "react";
declare module "react-dom/client";
declare module "react/jsx-runtime";

declare namespace JSX {
  interface IntrinsicElements {
    [elementName: string]: any;
  }
}

declare namespace NodeJS {
  interface ProcessEnv {
    APP_API_BASE_URL?: string;
    APP_YANDEX_MAPS_API_KEY?: string;
    APP_YANDEX_MAPS_LANG?: string;
  }
}

declare const process: {
  env: NodeJS.ProcessEnv;
};

type YMapsCoordinates = [number, number];

interface YMapsEvent {
  get(name: string): unknown;
}

interface YMapsEvents {
  add(name: string, handler: (event: YMapsEvent) => void): void;
}

interface YMapsGeoObjects {
  add(object: unknown): void;
  remove(object: unknown): void;
  removeAll(): void;
}

interface YMapsMapInstance {
  events: YMapsEvents;
  geoObjects: YMapsGeoObjects;
  destroy(): void;
}

interface YMapsPlacemarkInstance {
  events: YMapsEvents;
}

interface YMapsMultiRouteInstance {}

interface YMapsApi {
  ready(callback: () => void): void;
  Map: new (element: HTMLElement, state: unknown, options?: unknown) => YMapsMapInstance;
  Placemark: new (
    geometry: YMapsCoordinates,
    properties?: unknown,
    options?: unknown,
  ) => YMapsPlacemarkInstance;
  multiRouter: {
    MultiRoute: new (model: unknown, options?: unknown) => YMapsMultiRouteInstance;
  };
}

interface Window {
  ymaps?: YMapsApi;
}
