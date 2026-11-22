import React, { useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  Edit3,
  Home,
  MapPin,
  Plus,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { LeafletMap } from './LeafletMap';
import { DEFAULT_MINYA_CENTER, detectNearestZone, getZoneCenter } from '../lib/geo';
import {
  createCustomerAddress,
  deleteCustomerAddress,
  setDefaultCustomerAddress,
  updateCustomerAddress,
  type CustomerAddress,
  type CustomerProfile,
  type Zone,
} from '../lib/supabase';

interface MyAddressesSectionProps {
  profile: CustomerProfile;
  zones: Zone[];
  addresses: CustomerAddress[];
  onAddressesChange: (nextAddresses: CustomerAddress[]) => void;
}

export const MyAddressesSection: React.FC<MyAddressesSectionProps> = ({
  profile,
  zones,
  addresses,
  onAddressesChange,
}) => {
  const defaultZone = zones.find((z) => z.id === profile.zone_id) ?? zones[0];
  const defaultCenter = defaultZone ? getZoneCenter(defaultZone) : DEFAULT_MINYA_CENTER;

  const [modalOpen, setModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<CustomerAddress | null>(null);
  const [addressLabel, setAddressLabel] = useState('');
  const [addressDetails, setAddressDetails] = useState('');
  const [lat, setLat] = useState(defaultCenter.lat);
  const [lng, setLng] = useState(defaultCenter.lng);
  const [isDefault, setIsDefault] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const openAddModal = () => {
    setEditingAddress(null);
    setAddressLabel('');
    setAddressDetails('');
    setLat(defaultCenter.lat);
    setLng(defaultCenter.lng);
    setIsDefault(addresses.length === 0);
    setErrorMsg(null);
    setModalOpen(true);
  };

  const openEditModal = (addr: CustomerAddress) => {
    setEditingAddress(addr);
    setAddressLabel(addr.address_label);
    setAddressDetails(addr.address_details);
    setLat(addr.latitude);
    setLng(addr.longitude);
    setIsDefault(addr.is_default);
    setErrorMsg(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!addressLabel.trim()) {
      setErrorMsg('يرجى كتابة اسم الموقع (مثال: البيت، الشغل).');
      return;
    }

    if (!addressDetails.trim()) {
      setErrorMsg('يرجى كتابة تفاصيل العنوان.');
      return;
    }

    setSaving(true);
    try {
      if (editingAddress) {
        const next = await updateCustomerAddress({
          id: editingAddress.id,
          customerId: profile.id,
          addressLabel: addressLabel.trim(),
          addressDetails: addressDetails.trim(),
          latitude: lat,
          longitude: lng,
          isDefault: editingAddress.is_default ? true : isDefault,
        });
        onAddressesChange(next);
      } else {
        const next = await createCustomerAddress({
          customerId: profile.id,
          addressLabel: addressLabel.trim(),
          addressDetails: addressDetails.trim(),
          latitude: lat,
          longitude: lng,
          isDefault,
        });
        onAddressesChange(next);
      }
      setModalOpen(false);
    } catch {
      setErrorMsg('حدث خطأ أثناء حفظ العنوان. يرجى المحاولة مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (addressId: string) => {
    setBusyId(addressId);
    try {
      const next = await setDefaultCustomerAddress(addressId, profile.id);
      onAddressesChange(next);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (addressId: string) => {
    setBusyId(addressId);
    try {
      const next = await deleteCustomerAddress(addressId, profile.id);
      onAddressesChange(next);
      setConfirmDeleteId(null);
    } finally {
      setBusyId(null);
    }
  };

  const modalZone = detectNearestZone(lat, lng, zones);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-extrabold text-[#0A192F]">مواقعي</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            إدارة عناوين التوصيل المحفوظة وتعيين الموقع الافتراضي
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-[#FF7B00] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#E56E00] whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>إضافة موقع جديد</span>
        </button>
      </div>

      {addresses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
          <p className="text-sm font-bold text-[#0A192F]">لا توجد مواقع محفوظة حالياً</p>
          <p className="mt-1 text-xs text-slate-500">أضف عنوانك الأول لتسهيل الطلب.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map((addr) => {
            const zoneInfo = detectNearestZone(addr.latitude, addr.longitude, zones);
            const isBusy = busyId === addr.id;
            const confirming = confirmDeleteId === addr.id;

            return (
              <div
                key={addr.id}
                className={`rounded-2xl border p-4 transition-colors ${
                  addr.is_default
                    ? 'border-[#FF7B00]/50 bg-[#FF7B00]/5'
                    : 'border-slate-200 bg-slate-50/70'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        addr.is_default
                          ? 'bg-[#FF7B00] text-white'
                          : 'bg-[#0A192F] text-[#FF7B00]'
                      }`}
                    >
                      <MapPin className="h-5 w-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-extrabold text-[#0A192F]">
                          {addr.address_label}
                        </h4>
                        {addr.is_default && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#FF7B00]">
                            <Star className="h-3 w-3 fill-[#FF7B00]" />
                            <span>الافتراضي</span>
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-xs leading-relaxed text-slate-700">
                        {addr.address_details}
                      </p>

                      {zoneInfo && (
                        <p className="mt-1 text-[11px] text-slate-500">
                          المنطقة: {zoneInfo.zone.name}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions Row */}
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200/70 pt-3">
                  {!addr.is_default && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleSetDefault(addr.id)}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-[#0A192F] hover:border-[#FF7B00] hover:text-[#FF7B00] disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>تعيين كافتراضي</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => openEditModal(addr)}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-[#0A192F] hover:bg-slate-100 disabled:opacity-50"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span>تعديل</span>
                  </button>

                  {confirming ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleDelete(addr.id)}
                        className="inline-flex min-h-[38px] items-center gap-1 rounded-xl bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        تأكيد الحذف
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="inline-flex min-h-[38px] items-center rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100"
                      >
                        إلغاء
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => setConfirmDeleteId(addr.id)}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>حذف</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Address Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#0A192F]/60 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-lg font-extrabold text-[#0A192F]">
                {editingAddress ? 'تعديل الموقع' : 'إضافة موقع جديد'}
              </h4>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="إغلاق"
                className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-bold text-[#0A192F]">
                    المنطقة المكتشفة: {modalZone?.zone.name ?? 'مدينة المنيا'}
                  </span>
                  <span className="tabular-nums text-slate-400" dir="ltr">
                    {lat.toFixed(5)}, {lng.toFixed(5)}
                  </span>
                </div>
                <LeafletMap
                  mode="picker"
                  lat={lat}
                  lng={lng}
                  onPinChange={(nextLat, nextLng) => {
                    setLat(nextLat);
                    setLng(nextLng);
                  }}
                  heightClass="h-60"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-bold text-[#0A192F]">اسم الموقع</label>
                <input
                  type="text"
                  required
                  value={addressLabel}
                  onChange={(e) => setAddressLabel(e.target.value)}
                  placeholder="مثال: البيت، الشغل"
                  className="min-h-[48px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-[#0A192F] outline-none focus:border-[#FF7B00] focus:bg-white"
                />
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAddressLabel('البيت')}
                    className={`inline-flex min-h-[34px] items-center gap-1 rounded-lg border px-3 py-1 text-xs font-bold ${
                      addressLabel === 'البيت'
                        ? 'border-[#FF7B00] bg-[#FF7B00]/10 text-[#0A192F]'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <Home className="h-3.5 w-3.5 text-[#FF7B00]" />
                    <span>البيت</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddressLabel('الشغل')}
                    className={`inline-flex min-h-[34px] items-center gap-1 rounded-lg border px-3 py-1 text-xs font-bold ${
                      addressLabel === 'الشغل'
                        ? 'border-[#FF7B00] bg-[#FF7B00]/10 text-[#0A192F]'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <Briefcase className="h-3.5 w-3.5 text-[#0A192F]" />
                    <span>الشغل</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-bold text-[#0A192F]">تفاصيل العنوان</label>
                <textarea
                  required
                  rows={2}
                  value={addressDetails}
                  onChange={(e) => setAddressDetails(e.target.value)}
                  placeholder="مثال: شارع الجمهورية، برج السلام، الدور الرابع"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm text-[#0A192F] outline-none focus:border-[#FF7B00] focus:bg-white"
                />
              </div>

              {(!editingAddress || !editingAddress.is_default) && addresses.length > 0 && (
                <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-[#0A192F]">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                    className="h-4 w-4 accent-[#FF7B00]"
                  />
                  <span>تعيين كعنوان افتراضي</span>
                </label>
              )}

              {errorMsg && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
                  {errorMsg}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex min-h-[48px] flex-1 items-center justify-center rounded-xl bg-[#FF7B00] px-5 py-3 text-sm font-extrabold text-white hover:bg-[#E56E00] disabled:opacity-60"
                >
                  {saving ? 'جاري الحفظ...' : 'حفظ الموقع'}
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex min-h-[48px] items-center justify-center rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-[#0A192F] hover:bg-slate-50"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
