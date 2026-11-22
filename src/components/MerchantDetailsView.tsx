import React, { useState } from 'react';
import { AlertCircle, ArrowRight, Clock, MapPin, Phone, ShoppingBag, Store } from 'lucide-react';
import { verifyMerchantAvailability, type Merchant } from '../lib/supabase';

interface MerchantDetailsViewProps {
  merchant: Merchant;
  onBack: () => void;
  onStartOrder: (merchant: Merchant) => void;
  onMerchantUnavailable?: () => void;
}

export const MerchantDetailsView: React.FC<MerchantDetailsViewProps> = ({
  merchant,
  onBack,
  onStartOrder,
  onMerchantUnavailable,
}) => {
  const [checking, setChecking] = useState(false);
  const [unavailableError, setUnavailableError] = useState<string | null>(null);

  const handleOrderClick = async () => {
    setChecking(true);
    setUnavailableError(null);
    const check = await verifyMerchantAvailability(merchant.id);
    setChecking(false);

    if (!check.available) {
      setUnavailableError(check.error || 'عذراً، هذا المتجر غير متاح حالياً لاستقبال الطلبات.');
      onMerchantUnavailable?.();
      return;
    }

    onStartOrder(merchant);
  };
  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-10">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-[#0A192F] hover:bg-slate-50"
        >
          <ArrowRight className="h-4 w-4" />
          <span>رجوع للرئيسية</span>
        </button>

        <div className="flex items-center gap-1.5 text-xs font-bold text-[#FF7B00]">
          <Store className="h-4 w-4" />
          <span>{merchant.category || 'متجر'}</span>
        </div>
      </div>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="relative aspect-[16/9] max-h-[300px] w-full overflow-hidden bg-slate-100">
          <img
            src={merchant.cover_url || '/src/assets/images/hatly_merchant_grill_1794860407320.jpg'}
            alt={merchant.name}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A192F]/80 via-transparent to-transparent" />
          <div className="absolute right-0 bottom-0 left-0 p-5 text-white sm:p-6">
            <div className="flex items-center gap-2 text-xs text-slate-200">
              <span className="font-bold text-[#FF7B00]">{merchant.category || 'متجر'}</span>
              <span aria-hidden="true">·</span>
              <span>{merchant.zone_name || 'مدينة المنيا'}</span>
            </div>
            <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">{merchant.name}</h1>
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          {merchant.description && (
            <p className="text-sm leading-relaxed text-slate-600">{merchant.description}</p>
          )}

          <div className="grid grid-cols-1 gap-3 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#FF7B00] border border-slate-200">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500">منطقة الاستلام التلقائية</p>
                <p className="font-bold text-[#0A192F]">{merchant.zone_name || 'مدينة المنيا'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#FF7B00] border border-slate-200">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500">وقت التوصيل المتوقع</p>
                <p className="tabular-nums font-bold text-[#0A192F]">
                  {merchant.delivery_time || '25 - 35 دقيقة'}
                </p>
              </div>
            </div>

            {merchant.address && (
              <div className="sm:col-span-2 flex items-center justify-between border-t border-slate-200/70 pt-3 text-xs">
                <span className="text-slate-500">عنوان المتجر</span>
                <span className="font-semibold text-[#0A192F]">{merchant.address}</span>
              </div>
            )}

            {merchant.phone && (
              <div className="sm:col-span-2 flex items-center justify-between border-t border-slate-200/70 pt-3 text-xs">
                <span className="text-slate-500">هاتف المتجر</span>
                <a
                  href={`tel:${merchant.phone}`}
                  dir="ltr"
                  className="inline-flex items-center gap-1 tabular-nums font-bold text-[#0A192F] hover:text-[#FF7B00]"
                >
                  <Phone className="h-3.5 w-3.5 text-[#FF7B00]" />
                  <span>{merchant.phone}</span>
                </a>
              </div>
            )}
          </div>

          {unavailableError && (
            <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{unavailableError}</span>
            </div>
          )}

          <button
            type="button"
            disabled={checking}
            onClick={handleOrderClick}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[#FF7B00] px-6 py-3.5 text-base font-extrabold text-white shadow-lg shadow-[#FF7B00]/20 transition-colors hover:bg-[#E56E00] active:scale-[0.99] disabled:opacity-60"
          >
            <ShoppingBag className="h-5 w-5" />
            <span>{checking ? 'جاري التحقق من توفر المتجر...' : 'اطلب من المتجر'}</span>
          </button>
        </div>
      </section>
    </div>
  );
};
