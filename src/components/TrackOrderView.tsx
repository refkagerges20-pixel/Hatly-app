import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  MapPin,
  Package,
  Phone,
  Truck,
  UserCheck,
} from 'lucide-react';
import { LeafletMap } from './LeafletMap';
import { InlineAdBanner } from './GlobalAdBanner';
import {
  fetchCourierById,
  fetchOrderById,
  parseCoord,
  supabase,
  type Advertisement,
  type Courier,
  type OrderRecord,
  type OrderStatus,
  type Zone,
} from '../lib/supabase';

interface TrackOrderViewProps {
  order: OrderRecord;
  zones?: Zone[];
  inlineAd?: Advertisement | null;
  onSelectAd?: (ad: Advertisement) => void;
  onBack: () => void;
  onOrderStatusUpdated?: (orderId: string, nextStatus: OrderStatus, courier?: Courier | null) => void;
}

const STEPS: { key: OrderStatus; label: string; desc: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'new', label: 'تم استلام الطلب', desc: 'طلبك مسجل وجاري تعيين المندوب', icon: Clock },
  { key: 'assigned', label: 'تم تعيين مندوب', desc: 'المندوب في طريقه لاستلام الطلب', icon: UserCheck },
  { key: 'picked_up', label: 'جاري التوصيل', desc: 'المندوب استلم الطلب وفي طريقه إليك', icon: Truck },
  { key: 'delivered', label: 'تم التوصيل', desc: 'تم تسليم الطلب بنجاح', icon: CheckCircle2 },
];

function getStepIndex(status: OrderStatus): number {
  const idx = STEPS.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : 0;
}

export const TrackOrderView: React.FC<TrackOrderViewProps> = ({
  order,
  zones = [],
  inlineAd,
  onSelectAd,
  onBack,
  onOrderStatusUpdated,
}) => {
  const [courier, setCourier] = useState<Courier | null>(order.courier ?? null);

  // Sync courier details & live location via Realtime + fallback interval
  useEffect(() => {
    setCourier(order.courier ?? null);
    if (!order.courier_id) return;

    let active = true;
    fetchCourierById(order.courier_id).then((c) => {
      if (active && c) setCourier(c);
    });

    const courierChannel = supabase
      .channel(`courier-loc-${order.courier_id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'couriers',
          filter: `id=eq.${order.courier_id}`,
        },
        (payload) => {
          const nextRow = payload.new as Record<string, unknown>;
          const nextLat =
            parseCoord(nextRow.current_lat) ?? parseCoord(nextRow.latitude) ?? undefined;
          const nextLng =
            parseCoord(nextRow.current_lng) ?? parseCoord(nextRow.longitude) ?? undefined;

          setCourier((prev) => ({
            ...(prev ?? { id: String(nextRow.id ?? order.courier_id) }),
            id: String(nextRow.id ?? prev?.id ?? order.courier_id),
            current_lat: nextLat ?? prev?.current_lat ?? null,
            current_lng: nextLng ?? prev?.current_lng ?? null,
            latitude: nextLat ?? prev?.latitude ?? null,
            longitude: nextLng ?? prev?.longitude ?? null,
            status: nextRow.status ? String(nextRow.status) : prev?.status ?? null,
          }));
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(courierChannel);
    };
  }, [order.courier_id, order.courier]);

  // Subscribe to this order's live status & courier assignment + safety-net polling
  useEffect(() => {
    if (order.status === 'delivered' || order.status === 'cancelled') return;

    const orderChannel = supabase
      .channel(`track-order-${order.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${order.id}`,
        },
        async (payload) => {
          const updatedRow = payload.new as Record<string, unknown>;
          const nextStatus = updatedRow.status as OrderStatus;
          const nextCourierId = updatedRow.courier_id ? String(updatedRow.courier_id) : null;
          let fetchedCourier: Courier | null = null;
          if (nextCourierId) {
            fetchedCourier = await fetchCourierById(nextCourierId);
            if (fetchedCourier) setCourier(fetchedCourier);
          }
          onOrderStatusUpdated?.(order.id, nextStatus, fetchedCourier);
        }
      )
      .subscribe();

    const pollInterval = window.setInterval(async () => {
      const latestOrder = await fetchOrderById(order.id, zones);
      if (latestOrder) {
        if (latestOrder.courier_id) {
          const latestCourier = await fetchCourierById(latestOrder.courier_id);
          if (latestCourier) setCourier(latestCourier);
          if (
            latestOrder.status !== order.status ||
            latestOrder.courier_id !== order.courier_id
          ) {
            onOrderStatusUpdated?.(order.id, latestOrder.status, latestCourier);
          }
        } else if (latestOrder.status !== order.status) {
          onOrderStatusUpdated?.(order.id, latestOrder.status, null);
        }
      }
    }, 8000);

    return () => {
      supabase.removeChannel(orderChannel);
      window.clearInterval(pollInterval);
    };
  }, [order.id, order.status, order.courier_id, zones, onOrderStatusUpdated]);

  const isCancelled = order.status === 'cancelled';
  const activeIdx = getStepIndex(order.status);
  const progressPercent = isCancelled ? 0 : Math.round(((activeIdx + 1) / STEPS.length) * 100);

  const courierLat = courier?.current_lat ?? courier?.latitude ?? null;
  const courierLng = courier?.current_lng ?? courier?.longitude ?? null;

  const courierPhone = courier?.phone || '';
  const courierName = courier?.full_name || courier?.name || 'كابتن التوصيل';

  const handleAdvanceStatus = () => {
    const nextOrder: OrderStatus[] = ['new', 'assigned', 'picked_up', 'delivered'];
    const nextIdx = Math.min(activeIdx + 1, nextOrder.length - 1);
    const nextStatus = nextOrder[nextIdx];
    onOrderStatusUpdated?.(order.id, nextStatus, courier);
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
          <span>رجوع لطلباتي</span>
        </button>

        <div className="text-left">
          <span className="tabular-nums text-sm font-extrabold text-[#0A192F]">
            {order.order_number || order.id.slice(0, 8)}
          </span>
        </div>
      </div>

      {/* Live Status Progress Bar */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-slate-500">حالة الطلب الحالية</p>
            <h2 className={`mt-0.5 text-xl font-extrabold ${isCancelled ? 'text-red-600' : 'text-[#0A192F]'}`}>
              {isCancelled ? 'تم إلغاء الطلب' : STEPS[activeIdx]?.label}
            </h2>
          </div>
          <span className={`tabular-nums text-sm font-extrabold ${isCancelled ? 'text-red-600' : 'text-[#FF7B00]'}`}>
            {isCancelled ? 'ملغي' : `${progressPercent}%`}
          </span>
        </div>

        <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all duration-500 ${isCancelled ? 'bg-red-500' : 'bg-[#FF7B00]'}`}
            style={{ width: `${isCancelled ? 100 : progressPercent}%` }}
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-4">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const completed = idx <= activeIdx;
            const current = idx === activeIdx;
            return (
              <div
                key={step.key}
                className={`flex items-start gap-3 rounded-2xl border p-3 sm:flex-col ${
                  current
                    ? 'border-[#FF7B00] bg-[#FF7B00]/5'
                    : completed
                    ? 'border-slate-200 bg-slate-50'
                    : 'border-slate-100 bg-white opacity-60'
                }`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    completed ? 'bg-[#0A192F] text-[#FF7B00]' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#0A192F]">{step.label}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Interactive test progression button for local/guest testing */}
        {order.status !== 'delivered' && order.is_local_fallback && (
          <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5 text-xs">
            <span className="text-slate-600">معاينة تحديث الحالة والإشعار المباشر (وضع التجربة):</span>
            <button
              type="button"
              onClick={handleAdvanceStatus}
              className="min-h-[36px] rounded-lg bg-[#0A192F] px-3 py-1.5 font-bold text-white hover:bg-[#132847]"
            >
              تحديث للمرحلة التالية
            </button>
          </div>
        )}
      </section>

      {/* Live Map Tracking */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[#FF7B00]" />
            <h3 className="text-base font-extrabold text-[#0A192F]">تتبع الموقع المباشر</h3>
          </div>
          <span className="text-xs text-slate-500">
            {courierLat ? 'يتم عرض موقع المندوب ونقطة التسليم' : 'في انتظار تحرك المندوب'}
          </span>
        </div>

        <LeafletMap
          mode="tracker"
          lat={order.latitude}
          lng={order.longitude}
          courierLat={courierLat}
          courierLng={courierLng}
          heightClass="h-72"
        />
      </section>

      {inlineAd && onSelectAd && (
        <InlineAdBanner ad={inlineAd} onSelectAd={onSelectAd} />
      )}

      {/* Courier Info & Call Button */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0A192F] text-[#FF7B00]">
              <Truck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-slate-500">المندوب المسؤول عن التوصيل</p>
              <p className="text-base font-extrabold text-[#0A192F]">
                {order.status === 'new' && !order.courier_id ? 'جاري البحث عن أقرب مندوب...' : courierName}
              </p>
              <p className="tabular-nums text-xs text-slate-500">
                {courierPhone
                  ? `${courier?.vehicle_type || 'دراجة نارية'} · ${courierPhone}`
                  : order.courier_id
                  ? 'تم التعيين ومتاح للتتبع المباشر'
                  : 'سيتم إشعارك فور تعيين المندوب'}
              </p>
            </div>
          </div>

          {courierPhone ? (
            <a
              href={`tel:${courierPhone}`}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#FF7B00] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#E56E00] whitespace-nowrap shrink-0"
            >
              <Phone className="h-4 w-4" />
              <span>اتصال بالمندوب</span>
            </a>
          ) : (
            <span className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-500 whitespace-nowrap shrink-0">
              <Phone className="h-4 w-4 text-slate-400" />
              <span>{order.courier_id ? 'رقم المندوب غير مسجل' : 'في انتظار المندوب'}</span>
            </span>
          )}
        </div>
      </section>

      {/* Order Summary */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-3 text-sm">
        <div className="flex items-center gap-2 font-extrabold text-[#0A192F]">
          <Package className="h-4 w-4 text-[#FF7B00]" />
          <span>تفاصيل الطلب</span>
        </div>
        <div className="grid grid-cols-1 gap-2.5 border-t border-slate-100 pt-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-slate-500">العنوان</p>
            <p className="font-semibold text-[#0A192F]">{order.delivery_address}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">المنطقة</p>
            <p className="font-semibold text-[#0A192F]">
              {order.from_zone_name || 'المنيا'} ← {order.to_zone_name || 'المنيا'}
            </p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-slate-500">المحتوى والملاحظات</p>
            <p className="font-semibold text-[#0A192F]">{order.notes}</p>
          </div>
          {order.products_total > 0 && (
            <div>
              <p className="text-xs text-slate-500">قيمة الطلب</p>
              <p className="tabular-nums font-bold text-[#0A192F]">{order.products_total} ج.م</p>
            </div>
          )}
          <div>
            <p className="text-xs text-slate-500">رسوم التوصيل</p>
            <p className="tabular-nums font-bold text-[#0A192F]">
              {order.delivery_fee} ج.م
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">الإجمالي الكلي</p>
            <p className="tabular-nums font-extrabold text-[#FF7B00]">{order.total_fee} ج.م</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">طريقة الدفع</p>
            <p className="font-semibold text-[#0A192F]">
              {order.payment_method === 'card' ? 'بطاقة بنكية' : 'كاش عند الاستلام'}
              <span className="mx-1.5 text-slate-300">·</span>
              <span
                className={
                  order.payment_status === 'paid' ? 'text-emerald-700 font-bold' : 'text-slate-600'
                }
              >
                {order.payment_status === 'paid' ? 'تم الدفع' : 'غير مدفوع (عند الاستلام)'}
              </span>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
