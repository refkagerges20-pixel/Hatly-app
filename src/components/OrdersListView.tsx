import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Package,
  PackagePlus,
  RefreshCw,
  Truck,
  UserCheck,
} from 'lucide-react';
import type { OrderRecord, OrderStatus } from '../lib/supabase';

interface OrdersListViewProps {
  orders: OrderRecord[];
  error?: string | null;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  onSelectOrder: (order: OrderRecord) => void;
  onStartOrderFlow: () => void;
}

const STATUS_META: Record<
  OrderStatus,
  { label: string; colorClass: string; icon: React.ComponentType<{ className?: string }> }
> = {
  new: { label: 'تم استلام الطلب', colorClass: 'text-[#0A192F]', icon: Clock },
  assigned: { label: 'تم تعيين مندوب', colorClass: 'text-[#FF7B00]', icon: UserCheck },
  picked_up: { label: 'جاري التوصيل', colorClass: 'text-[#FF7B00]', icon: Truck },
  delivered: { label: 'تم التوصيل', colorClass: 'text-emerald-700', icon: CheckCircle2 },
  cancelled: { label: 'ملغي', colorClass: 'text-red-600', icon: Clock },
};

export const OrdersListView: React.FC<OrdersListViewProps> = ({
  orders,
  error = null,
  isRefreshing = false,
  onRefresh,
  onSelectOrder,
  onStartOrderFlow,
}) => {
  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-[#0A192F]">طلباتي</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            تابع حالة طلباتك الحالية والسابقة لحظة بلحظة
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-[#0A192F] hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-[#FF7B00] ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'جاري التحديث...' : 'تحديث'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onStartOrderFlow}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#0A192F] px-4 py-2 text-xs font-bold text-white hover:bg-[#132847] whitespace-nowrap shrink-0"
          >
            <PackagePlus className="h-4 w-4 text-[#FF7B00]" />
            <span>طلب جديد</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>تعذر جلب الطلبات من الخادم: {error}</span>
        </div>
      )}

      {orders.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-[#0A192F]">
            <Package className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-base font-bold text-[#0A192F]">لا توجد طلبات حتى الآن</h3>
          <p className="mt-1 text-sm text-slate-500">
            ابدأ بطلب من أحد المتاجر أو اطلب أوردر مخصوص لأي مكان في المنيا.
          </p>
          <button
            type="button"
            onClick={onStartOrderFlow}
            className="mt-5 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#FF7B00] px-6 py-3 text-sm font-bold text-white hover:bg-[#E56E00]"
          >
            <PackagePlus className="h-4 w-4" />
            <span>اطلب الآن</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const meta = STATUS_META[order.status] ?? STATUS_META.new;
            const StatusIcon = meta.icon;
            return (
              <button
                key={order.id}
                type="button"
                onClick={() => onSelectOrder(order)}
                className="flex w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-right transition-colors hover:border-[#FF7B00]/60"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="tabular-nums font-bold text-[#0A192F]">
                      {order.order_number || order.id.slice(0, 8)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {order.order_type === 'custom'
                        ? 'أوردر مخصوص'
                        : order.merchant_name || 'طلب من متجر'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      {new Date(order.created_at).toLocaleDateString('ar-EG', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>

                  <p className="mt-1.5 truncate text-sm font-bold text-[#0A192F]">
                    {order.notes || order.delivery_address}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                    <span className={`inline-flex items-center gap-1 font-bold ${meta.colorClass}`}>
                      <StatusIcon className="h-3.5 w-3.5" />
                      {meta.label}
                    </span>
                    <span aria-hidden="true" className="text-slate-300">
                      ·
                    </span>
                    <span className="text-slate-600">{order.to_zone_name || 'المنيا'}</span>
                    <span aria-hidden="true" className="text-slate-300">
                      ·
                    </span>
                    <span className="tabular-nums font-extrabold text-[#0A192F]">
                      {order.products_total > 0
                        ? `الإجمالي ${order.total_fee} ج.م`
                        : `${order.total_fee} ج.م توصيل`}
                    </span>
                  </div>
                </div>

                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-[#0A192F]">
                  <ChevronLeft className="h-5 w-5" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
