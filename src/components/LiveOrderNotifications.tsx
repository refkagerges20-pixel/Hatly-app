import React from 'react';
import {
  Bell,
  BellRing,
  CheckCheck,
  ChevronLeft,
  PackageCheck,
  Truck,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { OrderStatus } from '../lib/supabase';

export interface LiveNotificationItem {
  id: string;
  orderId?: string | null;
  orderNumber?: string | null;
  status?: OrderStatus | null;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
}

interface LiveOrderNotificationsProps {
  notifications: LiveNotificationItem[];
  activeToast: LiveNotificationItem | null;
  drawerOpen: boolean;
  browserNotifPermission: NotificationPermission | 'unsupported';
  soundEnabled: boolean;
  soundAutoplayBlocked: boolean;
  onEnableSound: () => void;
  onToggleSound: () => void;
  onDismissAutoplayPrompt: () => void;
  onRequestBrowserPermission: () => void;
  onDismissToast: () => void;
  onCloseDrawer: () => void;
  onMarkAllRead: () => void;
  onSelectNotification: (item: LiveNotificationItem) => void;
}

function getStatusIcon(status?: OrderStatus | null) {
  switch (status) {
    case 'delivered':
      return PackageCheck;
    case 'picked_up':
    case 'assigned':
      return Truck;
    default:
      return BellRing;
  }
}

export const LiveOrderNotifications: React.FC<LiveOrderNotificationsProps> = ({
  notifications,
  activeToast,
  drawerOpen,
  browserNotifPermission,
  soundEnabled,
  soundAutoplayBlocked,
  onEnableSound,
  onToggleSound,
  onDismissAutoplayPrompt,
  onRequestBrowserPermission,
  onDismissToast,
  onCloseDrawer,
  onMarkAllRead,
  onSelectNotification,
}) => {
  return (
    <>
      {/* Autoplay Blocked Prompt (Graceful browser restriction handler) */}
      {soundAutoplayBlocked && !drawerOpen && (
        <div
          className={`fixed ${
            activeToast ? 'top-40' : 'top-16'
          } right-4 left-4 z-50 mx-auto max-w-md`}
        >
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#FF7B00]/40 bg-white p-3.5 text-[#0A192F] shadow-xl">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FF7B00]/15 text-[#FF7B00]">
                <Volume2 className="h-4 w-4" />
              </div>
              <p className="text-xs font-bold leading-snug text-[#0A192F]">
                المتصفح حظر الصوت التلقائي. اضغط لتفعيل صوت تنبيهات الطلبات.
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={onEnableSound}
                className="min-h-[36px] rounded-xl bg-[#FF7B00] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#E56E00] whitespace-nowrap"
              >
                تفعيل الصوت
              </button>
              <button
                type="button"
                onClick={onDismissAutoplayPrompt}
                aria-label="إغلاق تنبيه الصوت"
                className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-[#0A192F]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Floating Notification Toast */}
      {activeToast && (
        <div className="fixed top-16 right-4 left-4 z-50 mx-auto max-w-md animate-[fadeIn_180ms_ease-out]">
          <div className="flex items-start gap-3 rounded-2xl border border-[#FF7B00]/40 bg-[#0A192F] p-4 text-white shadow-2xl">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FF7B00] text-white">
              {React.createElement(getStatusIcon(activeToast.status), { className: 'h-5 w-5' })}
            </div>
            <button
              type="button"
              onClick={() => {
                onSelectNotification(activeToast);
                onDismissToast();
              }}
              className="flex-1 text-right"
            >
              <p className="text-sm font-bold text-white">{activeToast.title}</p>
              <p className="mt-0.5 text-xs text-slate-300">{activeToast.body}</p>
              <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-[#FF7B00]">
                <span>{activeToast.orderId ? 'تتبع الطلب الآن' : 'عرض الإشعارات'}</span>
                <ChevronLeft className="h-3.5 w-3.5" />
              </p>
            </button>
            <button
              type="button"
              onClick={onDismissToast}
              aria-label="إغلاق الإشعار"
              className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Notifications Drawer Modal */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#0A192F]/60 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={onCloseDrawer}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden" />

            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <Bell className="h-5 w-5 text-[#FF7B00]" />
                <h3 className="text-lg font-extrabold text-[#0A192F]">إشعارات الطلبات المباشرة</h3>
              </div>
              <div className="flex items-center gap-2">
                {notifications.some((n) => !n.read) && (
                  <button
                    type="button"
                    onClick={onMarkAllRead}
                    className="inline-flex min-h-[36px] items-center gap-1 rounded-lg px-2.5 text-xs font-bold text-[#FF7B00] hover:bg-[#FF7B00]/10"
                  >
                    <CheckCheck className="h-4 w-4" />
                    <span>تحديد كمقروء</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onCloseDrawer}
                  aria-label="إغلاق"
                  className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Sound Alert Controls + Autoplay Enable */}
            <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-700">
                {soundEnabled ? (
                  <Volume2 className="h-4 w-4 shrink-0 text-[#FF7B00]" />
                ) : (
                  <VolumeX className="h-4 w-4 shrink-0 text-slate-400" />
                )}
                <span className="font-semibold">
                  {soundAutoplayBlocked
                    ? 'الصوت بانتظار التفعيل من المتصفح'
                    : soundEnabled
                    ? 'صوت التنبيهات مفعل'
                    : 'صوت التنبيهات مكتوم'}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onEnableSound}
                  className="min-h-[36px] rounded-lg bg-[#FF7B00] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#E56E00] whitespace-nowrap"
                >
                  {soundAutoplayBlocked ? 'تفعيل الصوت الآن' : 'تجربة الصوت'}
                </button>
                <button
                  type="button"
                  onClick={onToggleSound}
                  className="min-h-[36px] rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-[#0A192F] hover:bg-slate-100 whitespace-nowrap"
                >
                  {soundEnabled ? 'كتم' : 'تشغيل'}
                </button>
              </div>
            </div>

            {browserNotifPermission === 'default' && (
              <div className="border-b border-slate-100 bg-slate-50 px-5 py-3 flex items-center justify-between gap-3">
                <p className="text-xs text-slate-600">
                  فعّل إشعارات المتصفح لتصلك تحديثات المندوب لحظة بلحظة.
                </p>
                <button
                  type="button"
                  onClick={onRequestBrowserPermission}
                  className="min-h-[36px] rounded-lg bg-[#0A192F] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#132847] whitespace-nowrap shrink-0"
                >
                  تفعيل التنبيهات
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {notifications.length === 0 ? (
                <div className="py-10 text-center">
                  <Bell className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-3 text-sm font-bold text-[#0A192F]">لا توجد إشعارات بعد</p>
                  <p className="mt-1 text-xs text-slate-500">
                    ستظهر هنا التحديثات المباشرة لحالة طلباتك وحركة المندوب.
                  </p>
                </div>
              ) : (
                notifications.map((item) => {
                  const Icon = getStatusIcon(item.status);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onSelectNotification(item);
                        onCloseDrawer();
                      }}
                      className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-right transition-colors ${
                        item.read
                          ? 'border-slate-200 bg-white hover:bg-slate-50'
                          : 'border-[#FF7B00]/40 bg-[#FF7B00]/5 hover:bg-[#FF7B00]/10'
                      }`}
                    >
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          item.read ? 'bg-slate-100 text-[#0A192F]' : 'bg-[#FF7B00] text-white'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-bold text-[#0A192F] truncate">{item.title}</p>
                          <span className="tabular-nums text-[11px] text-slate-400 shrink-0">
                            {new Date(item.timestamp).toLocaleTimeString('ar-EG', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-600">{item.body}</p>
                        {item.orderNumber && (
                          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-500">
                            <span className="tabular-nums font-semibold text-[#0A192F]">
                              {item.orderNumber}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-bold text-[#FF7B00]">اضغط للتتبع</span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
