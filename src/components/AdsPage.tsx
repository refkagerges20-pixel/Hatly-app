import React, { useState } from 'react';
import { ArrowRight, Calendar, ChevronLeft, Store, Tag } from 'lucide-react';
import { AdMedia } from './AdMedia';
import type { Advertisement } from '../lib/supabase';

interface AdsPageProps {
  ads: Advertisement[];
  onBack: () => void;
  onSelectAd: (ad: Advertisement) => void;
}

const AD_FILTER_CATEGORIES = ['الكل', 'مطاعم', 'متاجر', 'شحن'];

export const AdsPage: React.FC<AdsPageProps> = ({ ads, onBack, onSelectAd }) => {
  const [selectedCategory, setSelectedCategory] = useState('الكل');

  const filteredAds = ads.filter((ad) => {
    if (selectedCategory === 'الكل') return true;
    return (ad.category || '').includes(selectedCategory);
  });

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-[#0A192F] hover:bg-slate-50"
          >
            <ArrowRight className="h-4 w-4" />
            <span>رجوع</span>
          </button>
          <div>
            <h2 className="text-xl font-extrabold text-[#0A192F]">عروض وخصومات</h2>
            <p className="text-xs text-slate-500">
              أحدث الإعلانات النشطة من مطاعم ومتاجر المنيا
            </p>
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
        {AD_FILTER_CATEGORIES.map((cat) => {
          const active = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-bold transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? 'border-[#0A192F] bg-[#0A192F] text-white'
                  : 'border-slate-200 bg-white text-[#0A192F] hover:bg-slate-50'
              }`}
            >
              <Tag className={`h-3.5 w-3.5 ${active ? 'text-[#FF7B00]' : 'text-[#FF7B00]'}`} />
              <span>{cat}</span>
            </button>
          );
        })}
      </div>

      {filteredAds.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center">
          <Tag className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-base font-bold text-[#0A192F]">لا توجد عروض في هذا التصنيف حالياً</p>
          <button
            type="button"
            onClick={() => setSelectedCategory('الكل')}
            className="mt-4 inline-flex min-h-[44px] items-center rounded-xl bg-[#0A192F] px-5 py-2 text-xs font-bold text-white hover:bg-[#132847]"
          >
            عرض جميع الإعلانات
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAds.map((ad) => (
            <button
              key={ad.id}
              type="button"
              onClick={() => onSelectAd(ad)}
              className="group overflow-hidden rounded-3xl border border-slate-200 bg-white text-right shadow-sm transition-transform duration-150 hover:-translate-y-0.5"
            >
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#0A192F]">
                <AdMedia
                  ad={ad}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
              </div>

              <div className="p-4">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1 font-bold text-[#FF7B00]">
                    <Store className="h-3.5 w-3.5" />
                    {ad.merchant_name || 'متجر شريك'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{ad.category || 'عروض'}</span>
                </div>

                <h3 className="mt-1.5 text-base font-extrabold text-[#0A192F] line-clamp-1">
                  {ad.title}
                </h3>

                {ad.subtitle && (
                  <p className="mt-1 text-xs leading-relaxed text-slate-600 line-clamp-2">
                    {ad.subtitle}
                  </p>
                )}

                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                  <span className="inline-flex items-center gap-1 tabular-nums text-slate-500">
                    <Calendar className="h-3.5 w-3.5" />
                    {ad.end_date ? `ساري حتى ${ad.end_date}` : 'عرض نشط'}
                  </span>
                  <span className="inline-flex items-center gap-1 font-bold text-[#0A192F]">
                    <span>زيارة المتجر</span>
                    <ChevronLeft className="h-3.5 w-3.5 text-[#FF7B00]" />
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
