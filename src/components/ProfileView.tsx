import React, { useState } from 'react';
import { Bell, CheckCircle2, LogOut, MapPin, Phone, Smartphone, UserRound } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { MyAddressesSection } from './MyAddressesSection';
import { CustomerSupportSection } from './CustomerSupportSection';
import {
  syncProfileAndCustomer,
  type CustomerAddress,
  type CustomerProfile,
  type OrderRecord,
  type Zone,
} from '../lib/supabase';

interface ProfileViewProps {
  profile: CustomerProfile;
  zones: Zone[];
  addresses: CustomerAddress[];
  orders: OrderRecord[];
  onAddressesChange: (nextAddresses: CustomerAddress[]) => void;
  browserNotifPermission: NotificationPermission | 'unsupported';
  onRequestBrowserPermission: () => void;
  onUpdateProfile: (updated: CustomerProfile) => void;
  onLogout: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  profile,
  zones,
  addresses,
  orders,
  onAddressesChange,
  browserNotifPermission,
  onRequestBrowserPermission,
  onUpdateProfile,
  onLogout,
}) => {
  const [fullName, setFullName] = useState(profile.full_name);
  const [phone, setPhone] = useState(profile.phone);
  const [zoneId, setZoneId] = useState(profile.zone_id || zones[0]?.id || '');
  const [defaultAddress, setDefaultAddress] = useState(profile.default_address || '');
  const [savedToast, setSavedToast] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated: CustomerProfile = {
      ...profile,
      full_name: fullName.trim() || profile.full_name,
      phone: phone.trim() || profile.phone,
      zone_id: zoneId,
      default_address: defaultAddress.trim(),
    };
    await syncProfileAndCustomer(updated);
    onUpdateProfile(updated);
    setSavedToast(true);
    window.setTimeout(() => setSavedToast(false), 2500);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-10">
      {/* Header Card */}
      <section className="rounded-3xl bg-[#0A192F] p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#FF7B00] text-white">
            <UserRound className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold">{profile.full_name}</h2>
            <p className="mt-0.5 tabular-nums text-xs text-slate-300" dir="ltr">
              {profile.phone}
            </p>
            <p className="mt-1 text-xs font-semibold text-[#FF7B00]">
              حساب عميل هاتلي الموثق
            </p>
          </div>
        </div>
      </section>

      {/* Saved Addresses (مواقعي) */}
      <MyAddressesSection
        profile={profile}
        zones={zones}
        addresses={addresses}
        onAddressesChange={onAddressesChange}
      />

      {/* Customer Support & Previous Complaints */}
      <CustomerSupportSection profile={profile} orders={orders} />

      {/* Edit Profile Form */}
      <form onSubmit={handleSave} className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
        <h3 className="text-base font-extrabold text-[#0A192F]">بياناتي الشخصية</h3>

        <div>
          <label className="mb-1.5 block text-sm font-bold text-[#0A192F]">الاسم الكامل</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="min-h-[48px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-[#0A192F] outline-none focus:border-[#FF7B00] focus:bg-white"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-bold text-[#0A192F]">رقم الهاتف</label>
          <div className="relative">
            <Phone className="pointer-events-none absolute top-3.5 right-3.5 h-4 w-4 text-slate-400" />
            <input
              type="tel"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="tabular-nums min-h-[48px] w-full rounded-xl border border-slate-200 bg-slate-50 pr-10 pl-4 text-left text-sm font-semibold text-[#0A192F] outline-none focus:border-[#FF7B00] focus:bg-white"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-bold text-[#0A192F]">المنطقة المفضلة</label>
          <div className="relative">
            <MapPin className="pointer-events-none absolute top-3.5 right-3.5 h-4 w-4 text-slate-400" />
            <select
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value)}
              className="min-h-[48px] w-full rounded-xl border border-slate-200 bg-slate-50 pr-10 pl-4 text-sm font-semibold text-[#0A192F] outline-none focus:border-[#FF7B00] focus:bg-white"
            >
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-bold text-[#0A192F]">العنوان الافتراضي</label>
          <input
            type="text"
            value={defaultAddress}
            onChange={(e) => setDefaultAddress(e.target.value)}
            placeholder="مثال: شارع طه حسين، عمارة 12"
            className="min-h-[48px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-[#0A192F] outline-none focus:border-[#FF7B00] focus:bg-white"
          />
        </div>

        {savedToast && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-800">
            <CheckCircle2 className="h-4 w-4" />
            <span>تم حفظ بياناتك بنجاح.</span>
          </div>
        )}

        <button
          type="submit"
          className="min-h-[48px] w-full rounded-xl bg-[#0A192F] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#132847]"
        >
          حفظ التعديلات
        </button>
      </form>

      {/* Live Notifications & PWA Settings */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF7B00]/10 text-[#FF7B00]">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#0A192F]">إشعارات الطلبات المباشرة</p>
              <p className="text-xs text-slate-500">
                {browserNotifPermission === 'granted'
                  ? 'مفعلة — ستصلك تنبيهات فورية عند تحرك المندوب'
                  : 'استلم إشعارات فورية عند تغيير حالة طلبك'}
              </p>
            </div>
          </div>

          {browserNotifPermission === 'default' && (
            <button
              type="button"
              onClick={onRequestBrowserPermission}
              className="min-h-[40px] rounded-xl bg-[#FF7B00] px-4 py-2 text-xs font-bold text-white hover:bg-[#E56E00] whitespace-nowrap shrink-0"
            >
              تفعيل
            </button>
          )}
        </div>

        <div className="border-t border-slate-100 pt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-[#0A192F]">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#0A192F]">تثبيت تطبيق هاتلي (PWA)</p>
              <p className="text-xs text-slate-500">افتح التطبيق من الشاشة الرئيسية مثل تطبيقات الموبايل</p>
            </div>
          </div>
          <PWAInstallButton variant="card" />
        </div>
      </section>

      {/* Sign out */}
      <button
        type="button"
        onClick={onLogout}
        className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-5 py-3 text-sm font-bold text-red-600 transition-colors hover:bg-red-50"
      >
        <LogOut className="h-4 w-4" />
        <span>تسجيل الخروج</span>
      </button>
    </div>
  );
};
