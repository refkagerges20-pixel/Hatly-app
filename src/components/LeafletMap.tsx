import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { LocateFixed } from 'lucide-react';

interface LeafletMapProps {
  mode: 'picker' | 'tracker';
  lat: number;
  lng: number;
  courierLat?: number | null;
  courierLng?: number | null;
  pinConfirmed?: boolean;
  onPinChange?: (lat: number, lng: number) => void;
  heightClass?: string;
}

function createCustomerPinIcon(confirmed: boolean) {
  const fill = confirmed ? '#FF7B00' : '#0A192F';
  return L.divIcon({
    className: 'hatly-customer-pin',
    html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);">
      <div style="width:36px;height:36px;border-radius:9999px;background:${fill};border:3px solid #FFFFFF;box-shadow:0 6px 16px rgba(10,25,47,0.32);display:flex;align-items:center;justify-content:center;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
      </div>
      <div style="width:10px;height:10px;background:${fill};transform:rotate(45deg);margin-top:-6px;border-right:2px solid #fff;border-bottom:2px solid #fff;"></div>
    </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function createCourierPinIcon() {
  return L.divIcon({
    className: 'hatly-courier-pin',
    html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-50%);">
      <div style="width:40px;height:40px;border-radius:9999px;background:#0A192F;border:3px solid #FF7B00;box-shadow:0 6px 18px rgba(10,25,47,0.35);display:flex;align-items:center;justify-content:center;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF7B00" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>
      </div>
    </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

export const LeafletMap: React.FC<LeafletMapProps> = ({
  mode,
  lat,
  lng,
  courierLat,
  courierLng,
  pinConfirmed = true,
  onPinChange,
  heightClass = 'h-64',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const customerMarkerRef = useRef<L.Marker | null>(null);
  const courierMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Initialize Leaflet map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [lat, lng],
      zoom: mode === 'picker' ? 14 : 13,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    const customerMarker = L.marker([lat, lng], {
      draggable: mode === 'picker',
      icon: createCustomerPinIcon(pinConfirmed),
    }).addTo(map);

    if (mode === 'picker') {
      customerMarker.on('dragend', () => {
        const pos = customerMarker.getLatLng();
        onPinChange?.(pos.lat, pos.lng);
      });

      map.on('click', (e: L.LeafletMouseEvent) => {
        customerMarker.setLatLng(e.latlng);
        onPinChange?.(e.latlng.lat, e.latlng.lng);
      });
    }

    mapRef.current = map;
    customerMarkerRef.current = customerMarker;

    // Ensure proper size calculation inside tabs/sheets
    const timer = window.setTimeout(() => {
      map.invalidateSize();
    }, 120);

    return () => {
      window.clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      customerMarkerRef.current = null;
      courierMarkerRef.current = null;
      routeLineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Sync customer marker position & courier marker in tracker mode
  useEffect(() => {
    const map = mapRef.current;
    const customerMarker = customerMarkerRef.current;
    if (!map || !customerMarker) return;

    customerMarker.setLatLng([lat, lng]);
    if (mode === 'picker') {
      customerMarker.setIcon(createCustomerPinIcon(pinConfirmed));
    }

    if (
      mode === 'tracker' &&
      typeof courierLat === 'number' &&
      typeof courierLng === 'number'
    ) {
      if (!courierMarkerRef.current) {
        courierMarkerRef.current = L.marker([courierLat, courierLng], {
          icon: createCourierPinIcon(),
        })
          .bindTooltip('موقع المندوب', { direction: 'top', offset: [0, -24] })
          .addTo(map);
      } else {
        courierMarkerRef.current.setLatLng([courierLat, courierLng]);
      }

      if (routeLineRef.current) {
        routeLineRef.current.setLatLngs([
          [courierLat, courierLng],
          [lat, lng],
        ]);
      } else {
        routeLineRef.current = L.polyline(
          [
            [courierLat, courierLng],
            [lat, lng],
          ],
          {
            color: '#FF7B00',
            weight: 3.5,
            dashArray: '8, 8',
            opacity: 0.9,
          }
        ).addTo(map);
      }

      const bounds = L.latLngBounds([
        [lat, lng],
        [courierLat, courierLng],
      ]);
      map.fitBounds(bounds, { padding: [44, 44], maxZoom: 15 });
    } else {
      if (courierMarkerRef.current) {
        courierMarkerRef.current.remove();
        courierMarkerRef.current = null;
      }
      if (routeLineRef.current) {
        routeLineRef.current.remove();
        routeLineRef.current = null;
      }
      map.setView([lat, lng], Math.max(map.getZoom(), 15), { animate: true });
    }
  }, [lat, lng, courierLat, courierLng, mode, pinConfirmed]);

  const handleLocateMe = () => {
    if (!navigator.geolocation || !mapRef.current || !customerMarkerRef.current) {
      setGeoError('تحديد الموقع التلقائي غير مدعوم في هذا المتصفح، اضغط على الخريطة يدوياً.');
      return;
    }
    setGeoError(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nextLat = pos.coords.latitude;
        const nextLng = pos.coords.longitude;
        customerMarkerRef.current?.setLatLng([nextLat, nextLng]);
        mapRef.current?.setView([nextLat, nextLng], 15, { animate: true });
        onPinChange?.(nextLat, nextLng);
        setLocating(false);
      },
      () => {
        setLocating(false);
        setGeoError('تعذر الوصول لموقعك، يرجى الضغط على الخريطة لتحديد الموقع يدوياً.');
      },
      { enableHighAccuracy: true, timeout: 7000 }
    );
  };

  return (
    <div className={`relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 ${heightClass}`}>
      <div ref={containerRef} className="h-full w-full" />

      {mode === 'picker' && (
        <>
          <div
            className={`pointer-events-none absolute top-3 right-3 z-[400] rounded-lg px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm ${
              pinConfirmed ? 'bg-[#0A192F]/90' : 'bg-[#FF7B00] shadow-md'
            }`}
          >
            {pinConfirmed
              ? 'اسحب الدبوس أو اضغط على الخريطة لتغيير الموقع'
              : 'اضغط على الخريطة أو اسحب الدبوس لتحديد موقع التوصيل (مطلوب)'}
          </div>

          {geoError && (
            <div className="pointer-events-none absolute bottom-14 right-3 left-3 z-[400] rounded-lg bg-red-600/95 px-3 py-1.5 text-[11px] font-semibold text-white">
              {geoError}
            </div>
          )}

          <button
            type="button"
            onClick={handleLocateMe}
            disabled={locating}
            className="absolute right-3 bottom-3 z-[400] inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-[#0A192F] shadow-md transition-colors hover:bg-slate-50 disabled:opacity-60"
          >
            <LocateFixed className={`h-4 w-4 text-[#FF7B00] ${locating ? 'animate-spin' : ''}`} />
            <span>{locating ? 'جاري التحديد...' : 'موقعي الحالي'}</span>
          </button>
        </>
      )}
    </div>
  );
};
