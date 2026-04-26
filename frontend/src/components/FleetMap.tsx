// @ts-nocheck
import { useEffect, useRef, useState } from "react";

import { MOSCOW_CENTER } from "../constants";
import type { Coordinates, FleetMapProps } from "../types";
import { getErrorMessage } from "../utils/messages";
import { getCarCoords, getCarPreset } from "../utils/map";
import { getYandexMapsApiKey, loadYandexMaps } from "../yandexMapsLoader";

export function FleetMap({
  cars,
  selectedCarId,
  onCarSelect,
  userLocation = null,
  onUserLocationChange,
  routeCar = null,
  destinationLocation = null,
  onDestinationLocationChange,
  routeFrom = null,
  onRouteSummaryChange,
  bonusZones = [],
  onBonusZoneCenterChange,
}: FleetMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<YMapsMapInstance | null>(null);
  const ymapsRef = useRef<YMapsApi | null>(null);
  const locationChangeRef = useRef(onUserLocationChange);
  const destinationChangeRef = useRef(onDestinationLocationChange);
  const bonusZoneCenterChangeRef = useRef(onBonusZoneCenterChange);
  const routeSummaryChangeRef = useRef(onRouteSummaryChange);
  const carSelectRef = useRef(onCarSelect);
  const [isLoading, setIsLoading] = useState(true);
  const [isMapReady, setIsMapReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    locationChangeRef.current = onUserLocationChange;
  }, [onUserLocationChange]);

  useEffect(() => {
    destinationChangeRef.current = onDestinationLocationChange;
  }, [onDestinationLocationChange]);

  useEffect(() => {
    bonusZoneCenterChangeRef.current = onBonusZoneCenterChange;
  }, [onBonusZoneCenterChange]);

  useEffect(() => {
    routeSummaryChangeRef.current = onRouteSummaryChange;
  }, [onRouteSummaryChange]);

  useEffect(() => {
    carSelectRef.current = onCarSelect;
  }, [onCarSelect]);

  useEffect(() => {
    let cancelled = false;

    const initMap = async () => {
      if (!containerRef.current) {
        return;
      }

      try {
        const ymaps = await loadYandexMaps();
        if (cancelled || !containerRef.current) {
          return;
        }

        ymapsRef.current = ymaps;
        const map = new ymaps.Map(
          containerRef.current,
          {
            center: MOSCOW_CENTER,
            zoom: 11,
            controls: ["zoomControl", "fullscreenControl"],
          },
          {
            suppressMapOpenBlock: true,
          },
        );

        map.events.add("click", (event) => {
          const coords = event.get("coords");
          if (!Array.isArray(coords)) {
            return;
          }

          const normalizedCoords: Coordinates = [Number(coords[0]), Number(coords[1])];
          if (bonusZoneCenterChangeRef.current) {
            bonusZoneCenterChangeRef.current(normalizedCoords);
            return;
          }

          if (destinationChangeRef.current) {
            destinationChangeRef.current(normalizedCoords);
            return;
          }

          locationChangeRef.current?.(normalizedCoords);
        });

        mapRef.current = map;
        setIsMapReady(true);
        setIsLoading(false);
      } catch (mapError) {
        if (!cancelled) {
          setError(getErrorMessage(mapError));
          setIsLoading(false);
        }
      }
    };

    void initMap();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
      setIsMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const ymaps = ymapsRef.current;

    if (!map || !ymaps || !isMapReady) {
      return;
    }

    map.geoObjects.removeAll();

    for (const zone of bonusZones) {
      const circle = new ymaps.Circle(
        [[Number(zone.latitude), Number(zone.longitude)], Number(zone.radius_meters)],
        {
          hintContent: `${zone.name}: скидка ${zone.discount_percent}%`,
          balloonContentHeader: zone.name,
          balloonContentBody: `Скидка ${zone.discount_percent}% при завершении поездки в этой зоне`,
        },
        {
          fillColor: "#f7a84b33",
          strokeColor: "#d06a25",
          strokeOpacity: 0.8,
          strokeWidth: 2,
        },
      );
      map.geoObjects.add(circle);
    }

    for (const car of cars) {
      const placemark = new ymaps.Placemark(
        getCarCoords(car),
        {
          hintContent: `${car.brand} ${car.model}`,
          balloonContentHeader: `${car.brand} ${car.model}`,
          balloonContentBody: `
            <strong>${car.license_plate}</strong><br/>
            Статус: ${car.status_label}
          `,
        },
        {
          preset: getCarPreset(car, selectedCarId),
        },
      );

      placemark.events.add("click", (event) => {
        event.stopPropagation?.();
        carSelectRef.current(car.id);
        placemark.balloon?.open();
      });
      map.geoObjects.add(placemark);
    }

    if (userLocation) {
      const userPlacemark = new ymaps.Placemark(
        userLocation,
        {
          hintContent: "Моя точка",
          balloonContentHeader: "Моя точка",
          balloonContentBody: "Отсюда строится маршрут до выбранной машины",
        },
        {
          preset: "islands#redCircleDotIcon",
        },
      );
      map.geoObjects.add(userPlacemark);
    }

    if (userLocation && routeCar) {
      const route = new ymaps.multiRouter.MultiRoute(
        {
          referencePoints: [userLocation, getCarCoords(routeCar)],
          params: {
            routingMode: "pedestrian",
          },
        },
        {
          boundsAutoApply: true,
          wayPointVisible: false,
          viaPointVisible: false,
          routeActiveStrokeWidth: 5,
          routeActiveStrokeColor: "#1d6b57",
        },
      );

      map.geoObjects.add(route);
    }

    if (destinationLocation) {
      const destinationPlacemark = new ymaps.Placemark(
        destinationLocation,
        {
          hintContent: "Точка назначения",
          balloonContentHeader: "Точка назначения",
          balloonContentBody: "Сюда строится маршрут текущей поездки",
        },
        {
          preset: "islands#redFlagIcon",
        },
      );
      map.geoObjects.add(destinationPlacemark);
    }

    if (routeFrom && destinationLocation) {
      const destinationRoute = new ymaps.multiRouter.MultiRoute(
        {
          referencePoints: [routeFrom, destinationLocation],
          params: {
            routingMode: "auto",
          },
        },
        {
          boundsAutoApply: true,
          wayPointVisible: false,
          viaPointVisible: false,
          routeActiveStrokeWidth: 5,
          routeActiveStrokeColor: "#d06a25",
        },
      );

      destinationRoute.model.events.add("requestsuccess", () => {
        const activeRoute = destinationRoute.getActiveRoute?.() ?? destinationRoute.getRoutes?.().get(0);
        const distance = activeRoute?.properties.get("distance");
        const duration = activeRoute?.properties.get("duration");
        const distanceMeters = typeof distance?.value === "number" ? distance.value : null;
        const durationSeconds = typeof duration?.value === "number" ? duration.value : null;
        routeSummaryChangeRef.current?.({
          distanceKm: distanceMeters === null ? null : Number((distanceMeters / 1000).toFixed(1)),
          durationMinutes: durationSeconds === null ? null : Math.max(1, Math.ceil(durationSeconds / 60)),
        });
      });

      destinationRoute.model.events.add("requestfail", () => {
        routeSummaryChangeRef.current?.({ distanceKm: null, durationMinutes: null });
      });

      map.geoObjects.add(destinationRoute);
    }
  }, [
    cars,
    bonusZones,
    destinationLocation?.[0],
    destinationLocation?.[1],
    isMapReady,
    routeCar,
    routeFrom?.[0],
    routeFrom?.[1],
    selectedCarId,
    userLocation?.[0],
    userLocation?.[1],
  ]);

  if (!getYandexMapsApiKey()) {
    return (
      <div className="map-fallback">
        <strong>Карта отключена</strong>
        <p>Добавьте `APP_YANDEX_MAPS_API_KEY` в `.env`, чтобы подключить реальный API Яндекс Карт.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="map-fallback">
        <strong>Не удалось загрузить карту</strong>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="map-canvas-shell">
      <div className="map-canvas" ref={containerRef} />
      {isLoading && <div className="map-overlay">Загружаем Яндекс Карту...</div>}
    </div>
  );
}
