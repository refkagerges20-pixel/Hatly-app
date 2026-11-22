import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Headset,
  MapPin,
  MessageSquareWarning,
  RefreshCw,
  Search,
  ShoppingBag,
  Sparkles,
  X,
} from 'lucide-react';
import { AdMedia } from './AdMedia';
import { ComplaintModal, WhatsAppIcon } from './CustomerSupportSection';
import {
  getSupportWhatsAppUrl,
  type Advertisement,
  type CustomerProfile,
  type Merchant,
  type OrderRecord,
  type Zone,
} from '../lib/supabase';

interface HomeDiscoveryProps {
  profile: CustomerProfile;
  zones: Zone[];
  selectedZoneId: string;
  onZoneChange: (zoneId: string) => void;
  ads: Advertisement[];
  merchants: Merchant[];
  merchantsAreLive: boolean;
  orders: OrderRecord[];
  merchantErrorBanner?: string | null;
  onDismissMerchantError?: () => void;
  onRefreshMerchants?: () => void;
  isRefreshingMerchants?: boolean;
  onSelectAd: (ad: Advertisement) => void;
  onOpenAdsPage: () => void;
  onSelectMerchant: (merchant: Merchant) => void;
  onStartOrderFlow: () => void;
  onStartCustomOrder: () => void;
}

export const HomeDiscovery: React.FC<HomeDiscoveryProps> = ({
  profile,
  zones,
  selectedZoneId,
  onZoneChange,
  ads,
  merchants,
  merchantsAreLive,
  orders,
  merchantErrorBanner,
  onDismissMerchantError,
  onRefreshMerchants,
  isRefreshingMerchants = false,
  onSelectAd,
  onOpenAdsPage,
  onSelectMerchant,
  onStartOrderFlow,
  onStartCustomOrder,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeAdIdx, setActiveAdIdx] = useState(0);
  const [complaintModalOpen, setComplaintModalOpen] = useState(false);
  const [complaintSentBanner, setComplaintSentBanner] = useState(false);

  useEffect(() => {
    if (ads.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveAdIdx((prev) => (prev + 1) % ads.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [ads.length]);

  const activeZone = zones.find((z) => z.id === selectedZoneId) ?? zones[0];

  const filteredMerchants = merchants.filter((m) => {
    const q = searchQuery.trim().toLowerCase();
    return (
      !q ||
      m.name.toLowerCase().includes(q) ||
      (m.category || '').toLowerCase().includes(q) ||
      (m.description || '').toLowerCase().includes(q) ||
      (m.zone_name || '').toLowerCase().includes(q)
    );
  });

  const currentAd = ads[activeAdIdx] ?? ads[0];
  const displayName = !profile.is_guest
    ? profile.full_name?.trim() || 'عميل هاتلي'
    : profile.full_name?.trim() || 'ضيف هاتلي';

  return (
    <div className="space-y-6 pb-8">
      {/* Search & Location Hero Strip */}
      <section className="rounded-3xl bg-[#0A192F] p-5 text-white sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-slate-300">أهلاً بك، {displayName}</p>
            <div className="mt-1 flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-[#FF7B00]" />
              <select
                aria-label="اختيار المنطقة"
                value={selectedZoneId}
                onChange={(e) => onZoneChange(e.target.value)}
                className="bg-transparent text-base font-bold text-white outline-none cursor-pointer"
              >
                {zones.map((z) => (
                  <option key={z.id} value={z.id} className="bg-[#0A192F] text-white">
                    {z.name} — {z.city || 'المنيا'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={onStartOrderFlow}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#FF7B00] px-5 py-2 text-sm font-extrabold text-white shadow-sm transition-colors hover:bg-[#E56E00] active:scale-[0.98] whitespace-nowrap shrink-0"
          >
            <ShoppingBag className="h-4 w-4" />
            <span>اطلب الآن</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute top-3.5 right-3.5 h-5 w-5 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`ابحث عن مطعم، سوبر ماركت، أو متجر في ${activeZone?.name ?? 'المنيا'}...`}
            className="min-h-[48px] w-full rounded-xl bg-white pr-11 pl-4 text-sm text-[#0A192F] placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-[#FF7B00]"
          />
        </div>
      </section>

      {/* Auto-Playing Ads Carousel (Below Header) */}
      {ads.length > 0 && currentAd ? (
        <section aria-label="الإعلانات والعروض المميزة">
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="text-base font-bold text-[#0A192F]">عروض هاتلي المميزة</h2>
            <button
              type="button"
              onClick={onOpenAdsPage}
              className="inline-flex items-center gap-1 text-xs font-bold text-[#FF7B00] hover:underline"
            >
              <span>كل العروض والخصومات</span>
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-[#0A192F] shadow-md">
            <button
              type="button"
              onClick={() => onSelectAd(currentAd)}
              className="relative block aspect-[16/9] max-h-[260px] w-full text-right sm:max-h-[310px]"
            >
              <AdMedia ad={currentAd} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0A192F]/90 via-[#0A192F]/35 to-transparent" />
              <div className="absolute right-0 bottom-0 left-0 p-5 text-white sm:p-6">
                <p className="text-xs font-bold text-[#FF7B00]">
                  {currentAd.merchant_name || 'متاجر هاتلي'}
                  {currentAd.category ? ` · ${currentAd.category}` : ''}
                </p>
                <h3 className="mt-1 text-lg font-extrabold sm:text-2xl [text-wrap:balance]">
                  {currentAd.title}
                </h3>
                {currentAd.subtitle && (
                  <p className="mt-1 max-w-xl text-xs text-slate-200 sm:text-sm line-clamp-2">
                    {currentAd.subtitle}
                  </p>
                )}
              </div>
            </button>

            {ads.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="الإعلان السابق"
                  onClick={() => setActiveAdIdx((prev) => (prev - 1 + ads.length) % ads.length)}
                  className="hidden sm:flex absolute top-1/2 right-3 -translate-y-1/2 h-9 w-9 items-center justify-center rounded-full bg-[#0A192F]/70 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[#0A192F]"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  aria-label="الإعلان التالي"
                  onClick={() => setActiveAdIdx((prev) => (prev + 1) % ads.length)}
                  className="hidden sm:flex absolute top-1/2 left-3 -translate-y-1/2 h-9 w-9 items-center justify-center rounded-full bg-[#0A192F]/70 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[#0A192F]"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                {/* Hatly Navy & Orange Carousel Indicators */}
                <div className="absolute bottom-4 left-5 flex items-center gap-1.5 rounded-full bg-[#0A192F]/70 px-2.5 py-1.5 backdrop-blur-sm">
                  {ads.map((ad, idx) => (
                    <button
                      key={ad.id}
                      type="button"
                      aria-label={`عرض الإعلان ${idx + 1}`}
                      onClick={() => setActiveAdIdx(idx)}
                      className={`h-2 rounded-full transition-all ${
                        idx === activeAdIdx ? 'w-6 bg-[#FF7B00]' : 'w-2 bg-white/60 hover:bg-white'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      ) : (
        <section aria-label="العروض المتاحة">
          <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-[#0A192F] p-5 text-white sm:p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-bold text-[#FF7B00]">توصيل هاتلي في المنيا</p>
                <h2 className="mt-1 text-lg font-extrabold sm:text-xl">
                  لا توجد إعلانات نشطة حالياً — اطلب من أي متجر أو أوردر مخصوص
                </h2>
                <p className="mt-1 text-xs text-slate-300">
                  يتم تحديث العروض والإعلانات تلقائياً فور إضافتها من المتاجر الشريكة.
                </p>
              </div>
              <button
                type="button"
                onClick={onStartOrderFlow}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#FF7B00] px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#E56E00] whitespace-nowrap shrink-0"
              >
                <ShoppingBag className="h-4 w-4" />
                <span>اطلب الآن</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Dedicated Custom Order Banner */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:flex sm:items-center sm:justify-between sm:gap-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FF7B00]/12 text-[#FF7B00]">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#0A192F]">عايز تطلب حاجة من بره المتاجر؟</h3>
            <p className="mt-1 text-sm text-slate-600">
              مع خدمة الأوردر المخصوص، ابعت المندوب يستلم أو يشتري أي غرض ويوصلّه لأي منطقة في المنيا.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onStartCustomOrder}
          className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#0A192F] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#132847] sm:mt-0 sm:w-auto whitespace-nowrap shrink-0"
        >
          <span>اطلب أوردر مخصوص</span>
          <ChevronLeft className="h-4 w-4" />
        </button>
      </section>

      {/* Merchants Grid */}
      <section aria-label="المتاجر والمطاعم" className="scroll-mt-20">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-[#0A192F]">المتاجر النشطة</h2>
          {onRefreshMerchants && (
            <button
              type="button"
              onClick={onRefreshMerchants}
              disabled={isRefreshingMerchants}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-[#0A192F] transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-[#FF7B00] ${isRefreshingMerchants ? 'animate-spin' : ''}`} />
              <span>{isRefreshingMerchants ? 'جاري التحديث...' : 'تحديث'}</span>
            </button>
          )}
        </div>

        {merchantErrorBanner && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{merchantErrorBanner}</span>
            </div>
            {onDismissMerchantError && (
              <button
                type="button"
                onClick={onDismissMerchantError}
                aria-label="إغلاق التنبيه"
                className="flex min-h-[32px] min-w-[32px] items-center justify-center rounded-lg text-red-600 hover:bg-red-100"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {filteredMerchants.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-sm font-bold text-[#0A192F]">
              {merchants.length === 0
                ? 'لا توجد متاجر نشطة متاحة حالياً'
                : 'لا توجد متاجر مطابقة لبحثك'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {merchants.length === 0
                ? 'يمكنك طلب أي غرض الآن من خلال خدمة الأوردر المخصوص.'
                : 'جرب البحث باسم آخر أو اطلب أي غرض عبر خدمة الأوردر المخصوص.'}
            </p>
            {searchQuery.trim() ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="mt-4 inline-flex min-h-[44px] items-center rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-[#0A192F] hover:bg-slate-50"
              >
                إظهار كل المتاجر
              </button>
            ) : (
              <button
                type="button"
                onClick={onStartCustomOrder}
                className="mt-4 inline-flex min-h-[44px] items-center rounded-xl bg-[#FF7B00] px-5 py-2 text-xs font-bold text-white hover:bg-[#E56E00]"
              >
                اطلب أوردر مخصوص الآن
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredMerchants.map((merchant) => (
              <button
                key={merchant.id}
                type="button"
                onClick={() => onSelectMerchant(merchant)}
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white text-right transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-[#FF7B00]"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
                  <img
                    src={merchant.cover_url || '/src/assets/images/hatly_merchant_market_1794860406955.jpg'}
                    alt={merchant.name}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-[#FF7B00]">{merchant.category || 'متجر'}</span>
                    <span aria-hidden="true">·</span>
                    <span>{merchant.zone_name || 'مدينة المنيا'}</span>
                  </div>
                  <h3 className="mt-1 text-base font-bold text-[#0A192F] line-clamp-1">
                    {merchant.name}
                  </h3>
                  {merchant.description && (
                    <p className="mt-1 text-xs leading-relaxed text-slate-600 line-clamp-2">
                      {merchant.description}
                    </p>
                  )}
                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      {merchant.delivery_time || '25 - 35 دقيقة'}
                    </span>
                    <span className="font-bold text-[#0A192F]">عرض التفاصيل</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Customer Support Section */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0A192F] text-[#FF7B00]">
            <Headset className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-[#0A192F]">خدمة عملاء هاتلي</h3>
            <p className="text-xs text-slate-500">
              محتاج مساعدة؟ تواصل معنا على واتساب أو قدّم شكوى وسنرد عليك فوراً
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <a
            href={getSupportWhatsAppUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[48px] items-center justify-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm font-bold text-[#0A192F] transition-colors hover:border-[#25D366] hover:bg-emerald-50 whitespace-nowrap"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white">
              <WhatsAppIcon className="h-4 w-4" />
            </span>
            <span>تواصل مع خدمة العملاء</span>
          </a>

          <button
            type="button"
            onClick={() => setComplaintModalOpen(true)}
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[#0A192F] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#132847] whitespace-nowrap"
          >
            <MessageSquareWarning className="h-4 w-4 shrink-0 text-[#FF7B00]" />
            <span>تقديم شكوى</span>
          </button>
        </div>

        {complaintSentBanner && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>تم إرسال شكواك بنجاح، ويمكنك متابعة حالتها من قسم حسابي.</span>
          </div>
        )}
      </section>

      <ComplaintModal
        open={complaintModalOpen}
        onClose={() => setComplaintModalOpen(false)}
        profile={profile}
        orders={orders}
        onSubmitted={() => {
          setComplaintSentBanner(true);
          window.setTimeout(() => setComplaintSentBanner(false), 5000);
        }}
      />

    </div>
  );
};
