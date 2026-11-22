import React, { useState } from 'react';
import { CheckCircle2, Home, Briefcase, LogOut, MapPin, Navigation } from 'lucide-react';
import { LeafletMap } from './LeafletMap';
import { DEFAULT_MINYA_CENTER, detectNearestZone, getZoneCenter } from '../lib/geo';
import {
  createCustomerAddress,
  type CustomerAddress,
  type CustomerProfile,
  type Zone,
} from '../lib/supabase';

interface ForcedLocationSetupProps {
  profile: CustomerProfile;
  zones: Zone[];
  onAddressSaved: (addresses: CustomerAddress[]) => void;
  onLogout: () => void;
}

export const ForcedLocationSetup: React.FC<ForcedLocationSetupProps> = ({
  profile,
  zones,
  onAddressSaved,
  onLogout,
}) => {
  const initialZone = zones.find((z) => z.id === profile.zone_id) ?? zones[0];
  const initialCenter = initialZone ? getZoneCenter(initialZone) : DEFAULT_MINYA_CENTER;

  const [lat, setLat] = useState(initialCenter.lat);
  const [lng, setLng] = useState(initialCenter.lng);
  const [pinConfirmed, setPinConfirmed] = useState(false);
  const [addressLabel, setAddressLabel] = useState('البيت');
  const [addressDetails, setAddressDetails] = useState(profile.default_address || '');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const detected = detectNearestZone(lat, lng, zones);
  const detectedZoneName = detected?.zone.name ?? initialZone?.name ?? 'مدينة المنيا';

  const handlePinChange = (nextLat: number, nextLng: number) => {
    setLat(nextLat);
    setLng(nextLng);
    setPinConfirmed(true);
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!addressLabel.trim()) {
      setErrorMsg('يرجى إدخال اسم الموقع (مثال: البيت أو الشغل).');
      return;
    }

    if (!addressDetails.trim()) {
      setErrorMsg('يرجى كتابة تفاصيل العنوان (اسم الشارع، رقم العمارة، الدور).');
      return;
    }

    setSaving(true);
    try {
      const updated = await createCustomerAddress({
        customerId: profile.id,
        addressLabel: addressLabel.trim(),
        addressDetails: addressDetails.trim(),
        latitude: lat,
        longitude: lng,
        isDefault: true,
      });
      onAddressSaved(updated);
    } catch {
      setErrorMsg('تعذر حفظ الموقع حالياً. يرجى المحاولة مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8FB] text-[#0A192F]">
      {/* Top Navy Header */}
      <header className="bg-[#0A192F] text-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <img
              src="/src/assets/images/hatly_official_logo_1794860801844.jpg"
              alt="شعار هاتلي"
              referrerPolicy="no-referrer"
              className="h-10 w-10 rounded-xl bg-white object-contain p-0.5"
            />
            <div>
              <h1 className="text-base font-extrabold">يرجى تحديد موقعك</h1>
              <p className="text-xs text-slate-300">خطوة مطلوبة مرة واحدة لبدء استخدام هاتلي</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-white/10"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>خروج</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <div>
            <h2 className="text-xl font-extrabold text-[#0A192F]">يرجى تحديد موقعك</h2>
            <p className="mt-1 text-sm text-slate-600">
              أهلاً {profile.full_name} — حدد عنوانك الأساسي على الخريطة ليتم استخدامه تلقائياً عند طلب التوصيل.
            </p>
          </div>

          {/* Interactive Draggable Marker Map */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 font-bold text-[#0A192F]">
                <MapPin className="h-4 w-4 text-[#FF7B00]" />
                <span>المنطقة المكتشفة: {detectedZoneName}</span>
              </span>
              <span className="tabular-nums text-slate-400" dir="ltr">
                {lat.toFixed(5)}, {lng.toFixed(5)}
              </span>
            </div>

            <LeafletMap
              mode="picker"
              lat={lat}
              lng={lng}
              onPinChange={handlePinChange}
              heightClass="h-72 sm:h-80"
            />

            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs">
              <span className="font-semibold text-slate-600">
                {pinConfirmed
                  ? 'تم تحديد الإحداثيات بنجاح'
                  : 'حرك الدبوس على الخريطة أو اضغط على زر «موقعي الحالي»'}
              </span>
              {pinConfirmed && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />}
            </div>
          </div>

          {/* Location Name */}
          <div>
            <label htmlFor="forced-addr-label" className="mb-1.5 block text-sm font-bold text-[#0A192F]">
              اسم الموقع
            </label>
            <input
              id="forced-addr-label"
              type="text"
              required
              value={addressLabel}
              onChange={(e) => setAddressLabel(e.target.value)}
              placeholder="مثال: البيت، الشغل، منزل العائلة"
              className="min-h-[48px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-[#0A192F] outline-none focus:border-[#FF7B00] focus:bg-white"
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAddressLabel('البيت')}
                className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors ${
                  addressLabel === 'البيت'
                    ? 'border-[#FF7B00] bg-[#FF7B00]/10 text-[#0A192F]'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Home className="h-3.5 w-3.5 text-[#FF7B00]" />
                <span>البيت</span>
              </button>
              <button
                type="button"
                onClick={() => setAddressLabel('الشغل')}
                className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors ${
                  addressLabel === 'الشغل'
                    ? 'border-[#FF7B00] bg-[#FF7B00]/10 text-[#0A192F]'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Briefcase className="h-3.5 w-3.5 text-[#0A192F]" />
                <span>الشغل</span>
              </button>
            </div>
          </div>

          {/* Address Details */}
          <div>
            <label htmlFor="forced-addr-details" className="mb-1.5 block text-sm font-bold text-[#0A192F]">
              تفاصيل العنوان
            </label>
            <textarea
              id="forced-addr-details"
              required
              rows={2}
              value={addressDetails}
              onChange={(e) => setAddressDetails(e.target.value)}
              placeholder="مثال: شارع طه حسين، عمارة 14، الدور الثالث، شقة 6"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm text-[#0A192F] outline-none focus:border-[#FF7B00] focus:bg-white"
            />
          </div>

          {errorMsg && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[#FF7B00] px-6 py-3.5 text-base font-extrabold text-white shadow-lg shadow-[#FF7B00]/20 transition-colors hover:bg-[#E56E00] disabled:opacity-60"
          >
            <Navigation className="h-5 w-5" />
            <span>{saving ? 'جاري حفظ موقعك...' : 'حفظ الموقع والمتابعة'}</span>
          </button>
        </form>
      </main>
    </div>
  );
};
