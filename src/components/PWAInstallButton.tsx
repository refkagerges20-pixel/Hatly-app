import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'card';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'compact' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className={
          variant === 'card'
            ? 'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#FF7B00] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#E56E00] whitespace-nowrap shrink-0'
            : 'inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#FF7B00] px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-[#E56E00] whitespace-nowrap shrink-0'
        }
      >
        <Download className="h-4 w-4 shrink-0" />
        <span>تثبيت التطبيق</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={
            variant === 'card'
              ? 'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#0A192F] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#132847] whitespace-nowrap shrink-0'
              : 'inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#0A192F] transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0'
          }
        >
          <Share className="h-3.5 w-3.5 shrink-0 text-[#FF7B00]" />
          <span>تثبيت على iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A192F]/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-[#0A192F]">تثبيت تطبيق هاتلي</h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="إغلاق"
                  className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <ol className="mt-4 space-y-2.5 text-sm leading-relaxed text-slate-600">
                <li>1. اضغط على زر المشاركة (Share) في شريط سفاري بالأسفل.</li>
                <li>2. مرر للأسفل واختر "إضافة إلى الشاشة الرئيسية" (Add to Home Screen).</li>
                <li>3. اضغط "إضافة" ليظهر تطبيق هاتلي مثل التطبيقات الأصلية.</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 min-h-[44px] w-full rounded-xl bg-[#0A192F] py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#132847]"
              >
                فهمت
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  if (variant === 'card') {
    return (
      <div className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">
        يمكنك تثبيت تطبيق هاتلي من قائمة المتصفح (إضافة إلى الشاشة الرئيسية) للوصول السريع.
      </div>
    );
  }

  return null;
};
