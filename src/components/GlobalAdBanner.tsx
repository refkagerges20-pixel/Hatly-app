import React from 'react';
import { ChevronLeft, Megaphone, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { AdMedia } from './AdMedia';
import type { Advertisement } from '../lib/supabase';

interface GlobalAdBannerProps {
  ad: Advertisement | null;
  dismissed: boolean;
  onDismiss: () => void;
  onSelectAd: (ad: Advertisement) => void;
}

export const GlobalAdBanner: React.FC<GlobalAdBannerProps> = ({
  ad,
  dismissed,
  onDismiss,
  onSelectAd,
}) => {
  return (
    <AnimatePresence>
      {ad && !dismissed && (
        <motion.div
          key={ad.id}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 18 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="fixed right-3 bottom-[68px] left-3 z-35 mx-auto max-w-2xl md:bottom-4"
        >
          <div className="flex h-13 items-center gap-2.5 overflow-hidden rounded-2xl border border-[#0A192F]/15 bg-[#0A192F]/95 px-2.5 text-white shadow-xl backdrop-blur-md">
            <button
              type="button"
              onClick={() => onSelectAd(ad)}
              className="flex min-w-0 flex-1 items-center gap-2.5 text-right"
            >
              <div className="h-9 w-12 shrink-0 overflow-hidden rounded-xl bg-[#132847]">
                <AdMedia ad={ad} className="h-full w-full object-cover" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#FF7B00]">
                  <span>إعلان</span>
                  <span aria-hidden="true">·</span>
                  <span className="truncate text-slate-300">
                    {ad.merchant_name || 'عروض هاتلي'}
                  </span>
                </div>
                <p className="truncate text-xs font-bold text-white">{ad.title}</p>
              </div>

              <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-[#FF7B00] whitespace-nowrap shrink-0">
                <span>اطلب</span>
                <ChevronLeft className="h-3.5 w-3.5" />
              </span>
            </button>

            <button
              type="button"
              onClick={onDismiss}
              aria-label="إغلاق الإعلان"
              className="flex min-h-[36px] min-w-[36px] shrink-0 items-center justify-center rounded-xl text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface InlineAdBannerProps {
  ad: Advertisement | null;
  onSelectAd: (ad: Advertisement) => void;
}

export const InlineAdBanner: React.FC<InlineAdBannerProps> = ({ ad, onSelectAd }) => {
  if (!ad) return null;

  return (
    <button
      type="button"
      onClick={() => onSelectAd(ad)}
      className="flex w-full items-center gap-3 rounded-2xl border border-[#FF7B00]/30 bg-white p-3 text-right shadow-sm transition-colors hover:border-[#FF7B00]"
    >
      <div className="h-14 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100">
        <AdMedia ad={ad} className="h-full w-full object-cover" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <Megaphone className="h-3.5 w-3.5 text-[#FF7B00]" />
          <span className="font-bold text-[#FF7B00]">عرض مميز</span>
          <span aria-hidden="true">·</span>
          <span className="truncate font-semibold text-[#0A192F]">
            {ad.merchant_name || 'متاجر هاتلي'}
          </span>
        </div>
        <p className="mt-0.5 truncate text-sm font-bold text-[#0A192F]">{ad.title}</p>
        {ad.subtitle && (
          <p className="truncate text-xs text-slate-500">{ad.subtitle}</p>
        )}
      </div>

      <ChevronLeft className="h-4 w-4 shrink-0 text-[#0A192F]" />
    </button>
  );
};
