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
  placementLocation = null,
  onPlacementLocationChange,
  routeCar = null,
  destinationLocation = null,
  onDestinationLocationChange,
  routeFrom = null,
  onRouteSummaryChange,
  bonusZones = [],
  bonusZonePreview = null,
  onBonusZoneCenterChange,
}: FleetMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<YMapsMapInstance | null>(null);
  const ymapsRef = useRef<YMapsApi | null>(null);
  const locationChangeRef = useRef(onUserLocationChange);
  const placementChangeRef = useRef(onPlacementLocationChange);
  const destinationChangeRef = useRef(onDestinationLocationChange);
  const bonusZoneCenterChangeRef = useRef(onBonusZoneCenterChange);
  const routeSummaryChangeRef = useRef(onRouteSummaryChange);
  const carSelectRef = useRef(onCarSelect);
  const [isLoading, setIsLoading] = useState(true);
  const [isMapReady, setIsMapReady] = useState(false);
  const [error, setError] = useState("");
  const bonusZonesKey = bonusZones
    .map((zone) => `${zone.id}:${zone.latitude}:${zone.longitude}:${zone.radius_meters}:${zone.discount_percent}`)
    .join("|");

  const handleMapCoordinateSelect = (coords: Coordinates) => {
    if (bonusZoneCenterChangeRef.current) {
      bonusZoneCenterChangeRef.current(coords);
      return;
    }

    if (placementChangeRef.current) {
      placementChangeRef.current(coords);
      return;
    }

    if (destinationChangeRef.current) {
      destinationChangeRef.current(coords);
      return;
    }

    locationChangeRef.current?.(coords);
  };

  useEffect(() => {
    locationChangeRef.current = onUserLocationChange;
  }, [onUserLocationChange]);

  useEffect(() => {
    placementChangeRef.current = onPlacementLocationChange;
  }, [onPlacementLocationChange]);

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
          handleMapCoordinateSelect(normalizedCoords);
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
    const container = containerRef.current;

    if (!map || !container || !isMapReady) {
      return;
    }

    const fitToViewport = () => {
      map.container?.fitToViewport?.();
    };

    fitToViewport();
    const animationFrame = window.requestAnimationFrame(fitToViewport);
    const firstTimer = window.setTimeout(fitToViewport, 80);
    const secondTimer = window.setTimeout(fitToViewport, 300);
    const resizeObserver = "ResizeObserver" in window ? new ResizeObserver(fitToViewport) : null;
    resizeObserver?.observe(container);
    if (container.parentElement) {
      resizeObserver?.observe(container.parentElement);
    }
    window.addEventListener("resize", fitToViewport);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(firstTimer);
      window.clearTimeout(secondTimer);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", fitToViewport);
    };
  }, [isMapReady]);

  useEffect(() => {
    const map = mapRef.current;
    const ymaps = ymapsRef.current;

    if (!map || !ymaps || !isMapReady) {
      return;
    }

    map.geoObjects.removeAll();

    for (const zone of bonusZones) {
      const shortBonusText = `Бонусная зона. Скидка ${zone.discount_percent}% за финиш здесь`;
      const circle = new ymaps.Circle(
        [[Number(zone.latitude), Number(zone.longitude)], Number(zone.radius_meters)],
        {
          hintContent: shortBonusText,
          balloonContentHeader: "Бонусная зона",
          balloonContentBody: shortBonusText,
        },
        {
          fillColor: "#f7a84b33",
          strokeColor: "#d06a25",
          strokeOpacity: 0.8,
          strokeWidth: 2,
        },
      );
      circle.events.add("click", (event) => {
        const coords = event.get("coords");
        if (Array.isArray(coords)) {
          handleMapCoordinateSelect([Number(coords[0]), Number(coords[1])]);
        }
      });
      map.geoObjects.add(circle);
    }

    if (bonusZonePreview) {
      const previewLatitude = Number(bonusZonePreview.latitude);
      const previewLongitude = Number(bonusZonePreview.longitude);
      const previewRadius = Number(bonusZonePreview.radius_meters);

      if (Number.isFinite(previewLatitude) && Number.isFinite(previewLongitude) && previewRadius > 0) {
        const previewCircle = new ymaps.Circle(
          [[previewLatitude, previewLongitude], previewRadius],
          {
            hintContent: "Бонусная зона. Скидка 10% за финиш здесь",
            balloonContentHeader: "Бонусная зона",
            balloonContentBody: `Радиус ${previewRadius} м`,
          },
          {
            fillColor: "#1d6b5738",
            strokeColor: "#174c43",
            strokeOpacity: 0.95,
            strokeWidth: 4,
          },
        );
        previewCircle.events.add("click", (event) => {
          const coords = event.get("coords");
          if (Array.isArray(coords)) {
            handleMapCoordinateSelect([Number(coords[0]), Number(coords[1])]);
          }
        });

        map.geoObjects.add(previewCircle);
      }
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

    if (placementLocation) {
      const placementPlacemark = new ymaps.Placemark(
        placementLocation,
        {
          hintContent: "Позиция автомобиля",
          balloonContentHeader: "Позиция автомобиля",
          balloonContentBody: "Сюда будет поставлен автомобиль после сохранения формы",
        },
        {
          preset: "islands#darkGreenDotIcon",
        },
      );
      map.geoObjects.add(placementPlacemark);
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
    bonusZonesKey,
    bonusZonePreview?.latitude,
    bonusZonePreview?.longitude,
    bonusZonePreview?.radius_meters,
    bonusZonePreview?.name,
    destinationLocation?.[0],
    destinationLocation?.[1],
    isMapReady,
    routeCar,
    routeFrom?.[0],
    routeFrom?.[1],
    selectedCarId,
    placementLocation?.[0],
    placementLocation?.[1],
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
