import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Headset,
  MessageSquareWarning,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  createCustomerComplaint,
  fetchCustomerComplaints,
  getSupportWhatsAppUrl,
  supabase,
  type ComplaintRecord,
  type CustomerProfile,
  type OrderRecord,
} from '../lib/supabase';

export const WhatsAppIcon: React.FC<{ className?: string }> = ({ className = 'h-5 w-5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={className}
  >
    <path d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.46 0 .1 5.36.1 11.96c0 2.11.55 4.17 1.6 5.98L0 24l6.23-1.63a11.94 11.94 0 0 0 5.83 1.49h.01c6.6 0 11.96-5.36 11.96-11.96 0-3.19-1.24-6.19-3.51-8.42ZM12.07 21.84h-.01a9.9 9.9 0 0 1-5.05-1.38l-.36-.21-3.7.97.99-3.61-.24-.37a9.89 9.89 0 0 1-1.52-5.28c0-5.46 4.44-9.9 9.91-9.9 2.64 0 5.13 1.03 7 2.9a9.84 9.84 0 0 1 2.9 7c0 5.46-4.44 9.88-9.92 9.88Zm5.43-7.41c-.3-.15-1.76-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.21 5.09 4.5.71.31 1.27.49 1.7.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35Z" />
  </svg>
);

function getComplaintStatusMeta(status: string): {
  label: string;
  colorClass: string;
  Icon: React.ComponentType<{ className?: string }>;
} {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'resolved' || normalized === 'closed' || normalized === 'تم الحل') {
    return {
      label: 'تم الحل',
      colorClass: 'text-emerald-700',
      Icon: CheckCircle2,
    };
  }
  if (normalized === 'in_review' || normalized === 'reviewing' || normalized === 'قيد المراجعة') {
    return {
      label: 'قيد المراجعة',
      colorClass: 'text-[#FF7B00]',
      Icon: Clock,
    };
  }
  return {
    label: 'مفتوحة',
    colorClass: 'text-[#FF7B00]',
    Icon: AlertCircle,
  };
}

interface ComplaintModalProps {
  open: boolean;
  onClose: () => void;
  profile: CustomerProfile;
  orders: OrderRecord[];
  onSubmitted?: (complaint: ComplaintRecord) => void;
}

export const ComplaintModal: React.FC<ComplaintModalProps> = ({
  open,
  onClose,
  profile,
  orders,
  onSubmitted,
}) => {
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setErrorMsg(null);
    }
  }, [open]);

  const recentOrders = useMemo(() => orders.slice(0, 20), [orders]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      setErrorMsg('يرجى إدخال عنوان الشكوى.');
      return;
    }
    if (!message.trim()) {
      setErrorMsg('يرجى كتابة تفاصيل الشكوى لمساعدتك بشكل أسرع.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const created = await createCustomerComplaint({
        customerId: profile.id,
        customerRecordId: profile.customer_record_id,
        orderId: selectedOrderId || null,
        subject,
        message,
      });
      setSelectedOrderId('');
      setSubject('');
      setMessage('');
      onSubmitted?.(created);
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'تعذر إرسال الشكوى حالياً، يرجى المحاولة مرة أخرى.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#0A192F]/60 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 48, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 48, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 pb-7 shadow-2xl sm:rounded-3xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden" />

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FF7B00]/12 text-[#FF7B00]">
                  <MessageSquareWarning className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-[#0A192F]">تقديم شكوى</h3>
                  <p className="text-xs text-slate-500">
                    سيتواصل معك فريق خدمة العملاء لمتابعة شكواك وحلها
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="إغلاق"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label htmlFor="complaint-order" className="mb-1.5 block text-sm font-bold text-[#0A192F]">
                  اختر الطلب <span className="text-xs font-normal text-slate-500">(اختياري)</span>
                </label>
                <select
                  id="complaint-order"
                  value={selectedOrderId}
                  onChange={(e) => setSelectedOrderId(e.target.value)}
                  className="min-h-[48px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-semibold text-[#0A192F] outline-none focus:border-[#FF7B00] focus:bg-white"
                >
                  <option value="">بدون طلب محدد (شكوى عامة)</option>
                  {recentOrders.map((ord) => (
                    <option key={ord.id} value={ord.id}>
                      {ord.order_number || ord.id.slice(0, 8)} —{' '}
                      {ord.order_type === 'custom'
                        ? 'أوردر مخصوص'
                        : ord.merchant_name || 'طلب من متجر'}{' '}
                      ({ord.total_fee} ج.م)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="complaint-subject" className="mb-1.5 block text-sm font-bold text-[#0A192F]">
                  عنوان الشكوى
                </label>
                <input
                  id="complaint-subject"
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="مثال: تأخير في التوصيل أو مشكلة في الطلب"
                  className="min-h-[48px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-[#0A192F] placeholder:text-slate-400 outline-none focus:border-[#FF7B00] focus:bg-white"
                />
              </div>

              <div>
                <label htmlFor="complaint-message" className="mb-1.5 block text-sm font-bold text-[#0A192F]">
                  تفاصيل الشكوى
                </label>
                <textarea
                  id="complaint-message"
                  rows={4}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="اشرح تفاصيل المشكلة لمساعدتنا في حلها بأسرع وقت..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm text-[#0A192F] placeholder:text-slate-400 outline-none focus:border-[#FF7B00] focus:bg-white"
                />
              </div>

              {errorMsg && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
                  {errorMsg}
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={submitting}
                  className="min-h-[48px] flex-1 rounded-xl bg-[#FF7B00] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#E56E00] disabled:opacity-60 whitespace-nowrap"
                >
                  {submitting ? 'جاري إرسال الشكوى...' : 'إرسال الشكوى'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[48px] rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-[#0A192F] hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface CustomerSupportSectionProps {
  profile: CustomerProfile;
  orders: OrderRecord[];
}

export const CustomerSupportSection: React.FC<CustomerSupportSectionProps> = ({
  profile,
  orders,
}) => {
  const [complaints, setComplaints] = useState<ComplaintRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [successToast, setSuccessToast] = useState(false);

  const loadComplaints = useCallback(async () => {
    const list = await fetchCustomerComplaints(profile.id, profile.customer_record_id);
    setComplaints(list);
    setLoading(false);
  }, [profile.id, profile.customer_record_id]);

  useEffect(() => {
    loadComplaints();

    const channel = supabase
      .channel(`hatly-complaints-${profile.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'complaints' },
        () => {
          loadComplaints();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile.id, loadComplaints]);

  const orderNumberMap = useMemo(() => {
    const map = new Map<string, string>();
    orders.forEach((o) => {
      map.set(o.id, o.order_number || o.id.slice(0, 8));
    });
    return map;
  }, [orders]);

  return (
    <>
      {/* Customer Support Actions Card */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0A192F] text-[#FF7B00]">
            <Headset className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-[#0A192F]">خدمة العملاء والدعم</h3>
            <p className="text-xs text-slate-500">
              تواصل معنا مباشرة عبر واتساب أو قدّم شكوى وسنتابعها معك فوراً
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
            onClick={() => setModalOpen(true)}
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[#FF7B00] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#E56E00] whitespace-nowrap"
          >
            <MessageSquareWarning className="h-4 w-4 shrink-0" />
            <span>تقديم شكوى</span>
          </button>
        </div>

        {successToast && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>تم إرسال شكواك بنجاح، وسيتم مراجعتها من فريق خدمة العملاء.</span>
          </div>
        )}
      </section>

      {/* Previous Complaints List */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-extrabold text-[#0A192F]">شكاوى سابقة</h3>
            <p className="text-xs text-slate-500">متابعة حالة الشكاوى المقدمة لإدارة هاتلي</p>
          </div>
          {complaints.length > 0 && (
            <span className="tabular-nums text-xs font-bold text-slate-500">
              {complaints.length} شكوى
            </span>
          )}
        </div>

        {loading ? (
          <div className="space-y-3 py-2">
            <div className="h-16 w-full animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-16 w-full animate-pulse rounded-2xl bg-slate-100" />
          </div>
        ) : complaints.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 p-6 text-center">
            <p className="text-sm font-bold text-[#0A192F]">لا توجد شكاوى سابقة</p>
            <p className="mt-1 text-xs text-slate-500">
              إذا واجهت أي مشكلة في أي طلب، يمكنك تقديم شكوى وسنقوم بحلها سريعاً.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {complaints.map((item) => {
              const statusMeta = getComplaintStatusMeta(item.status);
              const StatusIcon = statusMeta.Icon;
              const linkedOrderNum = item.order_id ? orderNumberMap.get(item.order_id) : null;

              return (
                <div key={item.id} className="py-3.5 first:pt-1 last:pb-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-extrabold text-[#0A192F]">{item.subject}</h4>
                    <span className={`inline-flex items-center gap-1 text-xs font-bold ${statusMeta.colorClass}`}>
                      <StatusIcon className="h-3.5 w-3.5" />
                      <span>{statusMeta.label}</span>
                    </span>
                  </div>

                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.message}</p>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    <span className="tabular-nums">
                      {new Date(item.created_at).toLocaleDateString('ar-EG', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    {item.order_id && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums font-semibold text-[#0A192F]">
                          طلب {linkedOrderNum || item.order_id.slice(0, 8)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <ComplaintModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        profile={profile}
        orders={orders}
        onSubmitted={(created) => {
          setComplaints((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);
          setSuccessToast(true);
          window.setTimeout(() => setSuccessToast(false), 4500);
        }}
      />
    </>
  );
};
