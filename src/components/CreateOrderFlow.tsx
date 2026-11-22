import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  Bike,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  Lock,
  MapPin,
  Navigation,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Store,
  UtensilsCrossed,
} from 'lucide-react';
import { LeafletMap } from './LeafletMap';
import { InlineAdBanner } from './GlobalAdBanner';
import { DEFAULT_MINYA_CENTER, detectNearestZone, getZoneCenter } from '../lib/geo';
import {
  calculateOrderPricing,
  createCustomerAddress,
  createOrderWithAutoDispatch,
  verifyMerchantAvailability,
  type Advertisement,
  type CustomerAddress,
  type CustomerProfile,
  type Merchant,
  type OrderRecord,
  type PricingResult,
  type Zone,
} from '../lib/supabase';

export type OrderFlowInitialStep = 'choose_type' | 'brand_select' | 'brand_checkout' | 'custom_details';

interface CreateOrderFlowProps {
  initialStep?: OrderFlowInitialStep;
  initialMerchant?: Merchant | null;
  merchants: Merchant[];
  zones: Zone[];
  profile: CustomerProfile;
  savedAddresses: CustomerAddress[];
  onAddressesChange: (nextAddresses: CustomerAddress[]) => void;
  defaultZoneId: string;
  inlineAd?: Advertisement | null;
  onSelectAd?: (ad: Advertisement) => void;
  onRefreshMerchants?: () => void;
  isRefreshingMerchants?: boolean;
  onCancel: () => void;
  onOrderCreated: (order: OrderRecord) => void;
  onTrackOrder: (order: OrderRecord) => void;
  onMerchantUnavailable?: () => void;
}

type FlowStep = 'choose_type' | 'brand_select' | 'custom_details' | 'checkout';

const FALLBACK_ZONE_ID = '7dbfe2fb-eaf1-4657-9662-c352bc7051a5';

export const CreateOrderFlow: React.FC<CreateOrderFlowProps> = ({
  initialStep = 'choose_type',
  initialMerchant = null,
  merchants,
  zones,
  profile,
  savedAddresses,
  onAddressesChange,
  defaultZoneId,
  inlineAd,
  onSelectAd,
  onRefreshMerchants,
  isRefreshingMerchants = false,
  onCancel,
  onOrderCreated,
  onTrackOrder,
  onMerchantUnavailable,
}) => {
  const resolveStartStep = (): FlowStep => {
    if (initialStep === 'brand_checkout' && initialMerchant) return 'checkout';
    if (initialStep === 'brand_select') return 'brand_select';
    if (initialStep === 'custom_details') return 'custom_details';
    return 'choose_type';
  };

  const resolveInitialMode = (): 'brand' | 'custom' => {
    if (initialStep === 'custom_details') return 'custom';
    return 'brand';
  };

  const [step, setStep] = useState<FlowStep>(resolveStartStep);
  const [mode, setMode] = useState<'brand' | 'custom'>(resolveInitialMode);
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(initialMerchant);

  // Brand Selection state
  const [merchantSearch, setMerchantSearch] = useState('');
  const [checkingMerchantId, setCheckingMerchantId] = useState<string | null>(null);
  const [merchantSelectError, setMerchantSelectError] = useState<string | null>(null);

  // Custom Order 3-field state
  const [customWhatToPickup, setCustomWhatToPickup] = useState('');
  const [customPickupFrom, setCustomPickupFrom] = useState('');
  const [pickupPhone, setPickupPhone] = useState('');
  const [customFormError, setCustomFormError] = useState<string | null>(null);

  // Resolved pickup zone (automatic for brands, default zone for custom)
  const resolveZoneForMerchant = (m: Merchant | null): string =>
    m?.zone_id ||
    zones.find((z) => z.name === m?.zone_name)?.id ||
    defaultZoneId ||
    zones[0]?.id ||
    FALLBACK_ZONE_ID;

  const fromZoneId =
    mode === 'brand'
      ? resolveZoneForMerchant(selectedMerchant)
      : defaultZoneId || zones[0]?.id || FALLBACK_ZONE_ID;

  // Delivery location & map state
  const defaultSavedAddress = useMemo(
    () =>
      savedAddresses.find(
        (a) =>
          a.is_default &&
          Number.isFinite(a.latitude) &&
          Number.isFinite(a.longitude) &&
          !(a.latitude === 0 && a.longitude === 0)
      ) ??
      savedAddresses.find(
        (a) =>
          Number.isFinite(a.latitude) &&
          Number.isFinite(a.longitude) &&
          !(a.latitude === 0 && a.longitude === 0)
      ) ??
      null,
    [savedAddresses]
  );

  const initialZoneObj = zones.find((z) => z.id === defaultZoneId) ?? zones[0];
  const initialCenter = defaultSavedAddress
    ? { lat: defaultSavedAddress.latitude, lng: defaultSavedAddress.longitude }
    : initialZoneObj
    ? getZoneCenter(initialZoneObj)
    : DEFAULT_MINYA_CENTER;

  const [selectedAddressId, setSelectedAddressId] = useState<string>(
    defaultSavedAddress ? defaultSavedAddress.id : 'custom'
  );
  const [lat, setLat] = useState<number>(initialCenter.lat);
  const [lng, setLng] = useState<number>(initialCenter.lng);
  const [pinConfirmed, setPinConfirmed] = useState<boolean>(Boolean(defaultSavedAddress));
  const [saveNewAddress, setSaveNewAddress] = useState(false);
  const [newAddressLabel, setNewAddressLabel] = useState('');

  // Haversine auto-detected delivery zone
  const detected = detectNearestZone(lat, lng, zones);
  const toZoneId = detected?.zone.id ?? fromZoneId;
  const toZoneName = detected?.zone.name ?? 'مدينة المنيا';

  const [deliveryAddress, setDeliveryAddress] = useState(
    defaultSavedAddress?.address_details || profile.default_address || ''
  );
  const [brandOrderItems, setBrandOrderItems] = useState('');
  const [extraCustomNotes, setExtraCustomNotes] = useState('');
  const [customerName, setCustomerName] = useState(profile.full_name || '');
  const [customerPhone, setCustomerPhone] = useState(
    profile.phone && profile.phone !== '01000000000' ? profile.phone : ''
  );
  const [orderAmountInput, setOrderAmountInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');

  // Simulated card fields & payment status
  const [cardHolderName, setCardHolderName] = useState(profile.full_name || '');
  const [cardNumber, setCardNumber] = useState('4532 1234 5678 8891');
  const [cardExpiry, setCardExpiry] = useState('09/28');
  const [cardCvv, setCardCvv] = useState('412');
  const [cardPaymentStatus, setCardPaymentStatus] = useState<'idle' | 'processing' | 'paid'>('idle');
  const [paidAmount, setPaidAmount] = useState<number | null>(null);
  const [cardPaymentError, setCardPaymentError] = useState<string | null>(null);

  // Exact pricing fetched from Supabase tables
  const [pricing, setPricing] = useState<PricingResult>({
    delivery_fee: 0,
    custom_fee: 0,
    total_fee: 0,
    source: 'not_found',
  });
  const [pricingLoading, setPricingLoading] = useState(true);

  const parsedRawAmount = Number(orderAmountInput.replace(/,/g, '.').trim());
  const orderAmount =
    orderAmountInput.trim() !== '' && !Number.isNaN(parsedRawAmount) && parsedRawAmount > 0
      ? Math.round(parsedRawAmount * 100) / 100
      : 0;
  const grandTotal = Math.round((orderAmount + pricing.delivery_fee) * 100) / 100;
  const isCardPaid =
    paymentMethod === 'card' && cardPaymentStatus === 'paid' && paidAmount === grandTotal;
  const isPaymentReady = paymentMethod === 'cash' || isCardPaid;

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<OrderRecord | null>(null);

  useEffect(() => {
    if (step !== 'checkout') return;
    let cancelled = false;
    setPricingLoading(true);
    calculateOrderPricing(mode, fromZoneId, toZoneId).then((res) => {
      if (!cancelled) {
        setPricing(res);
        setPricingLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [step, mode, fromZoneId, toZoneId]);

  const filteredMerchants = useMemo(() => {
    const q = merchantSearch.trim().toLowerCase();
    if (!q) return merchants;
    return merchants.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.category || '').toLowerCase().includes(q) ||
        (m.zone_name || '').toLowerCase().includes(q)
    );
  }, [merchants, merchantSearch]);

  const handleChooseBrandType = () => {
    setMode('brand');
    setMerchantSelectError(null);
    setErrorMsg(null);
    setStep('brand_select');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleChooseCustomType = () => {
    setMode('custom');
    setSelectedMerchant(null);
    setCustomFormError(null);
    setErrorMsg(null);
    setStep('custom_details');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectMerchant = async (merchantItem: Merchant) => {
    setMerchantSelectError(null);
    setCheckingMerchantId(merchantItem.id);
    const check = await verifyMerchantAvailability(merchantItem.id);
    setCheckingMerchantId(null);

    if (!check.available) {
      setMerchantSelectError(
        check.error || 'عذراً، هذا المتجر غير متاح حالياً لاستقبال الطلبات.'
      );
      onMerchantUnavailable?.();
      return;
    }

    setMode('brand');
    setSelectedMerchant(merchantItem);
    setErrorMsg(null);
    setStep('checkout');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCustomDetailsNext = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomFormError(null);

    if (!customWhatToPickup.trim()) {
      setCustomFormError('يرجى كتابة ما تريد أن نستلمه أو نشتريه لك.');
      return;
    }
    if (!customPickupFrom.trim()) {
      setCustomFormError('يرجى كتابة عنوان أو مكان الاستلام.');
      return;
    }

    setMode('custom');
    setErrorMsg(null);
    setStep('checkout');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    setErrorMsg(null);
    if (step === 'choose_type') {
      onCancel();
      return;
    }
    if (step === 'brand_select') {
      if (initialStep === 'brand_select') {
        onCancel();
      } else {
        setStep('choose_type');
      }
      return;
    }
    if (step === 'custom_details') {
      if (initialStep === 'custom_details') {
        onCancel();
      } else {
        setStep('choose_type');
      }
      return;
    }
    // step === 'checkout'
    if (mode === 'brand') {
      if (initialStep === 'brand_checkout') {
        onCancel();
      } else {
        setStep('brand_select');
      }
    } else {
      setStep('custom_details');
    }
  };

  const handleSelectSavedAddress = (value: string) => {
    setSelectedAddressId(value);
    setErrorMsg(null);
    if (value === 'custom') {
      setPinConfirmed(false);
      return;
    }
    const chosen = savedAddresses.find((a) => a.id === value);
    if (
      chosen &&
      Number.isFinite(chosen.latitude) &&
      Number.isFinite(chosen.longitude) &&
      !(chosen.latitude === 0 && chosen.longitude === 0)
    ) {
      setLat(chosen.latitude);
      setLng(chosen.longitude);
      setDeliveryAddress(chosen.address_details);
      setPinConfirmed(true);
      setSaveNewAddress(false);
    } else {
      setPinConfirmed(false);
    }
  };

  const handlePinChange = (nextLat: number, nextLng: number) => {
    if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) return;
    setLat(nextLat);
    setLng(nextLng);
    setSelectedAddressId('custom');
    setPinConfirmed(true);
    setErrorMsg(null);
  };

  const hasValidCoordinates =
    pinConfirmed &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0);

  const handleSelectPaymentMethod = (nextMethod: 'cash' | 'card') => {
    setPaymentMethod(nextMethod);
    setErrorMsg(null);
    setCardPaymentError(null);
    if (nextMethod === 'cash') {
      setCardPaymentStatus('idle');
      setPaidAmount(null);
    }
  };

  const resetCardPaymentIfPaid = () => {
    if (cardPaymentStatus !== 'idle') {
      setCardPaymentStatus('idle');
      setPaidAmount(null);
    }
    setCardPaymentError(null);
  };

  const handleSimulateCardPay = async () => {
    setCardPaymentError(null);
    setErrorMsg(null);

    const digits = cardNumber.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) {
      setCardPaymentError('يرجى إدخال رقم بطاقة صحيح مكوّن من 13 إلى 19 رقماً.');
      return;
    }

    const expiryClean = cardExpiry.trim();
    if (!/^(0[1-9]|1[0-2])\/?(\d{2}|\d{4})$/.test(expiryClean)) {
      setCardPaymentError('يرجى إدخال تاريخ انتهاء صحيح بصيغة MM/YY (مثال: 09/28).');
      return;
    }

    const cvvDigits = cardCvv.replace(/\D/g, '');
    if (cvvDigits.length < 3 || cvvDigits.length > 4) {
      setCardPaymentError('يرجى إدخال رمز الأمان (CVV) المكوّن من 3 أو 4 أرقام.');
      return;
    }

    if (pricingLoading) {
      setCardPaymentError('يرجى الانتظار لحين انتهاء حساب رسوم التوصيل.');
      return;
    }

    setCardPaymentStatus('processing');
    await new Promise((resolve) => window.setTimeout(resolve, 800));
    setCardPaymentStatus('paid');
    setPaidAmount(grandTotal);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!hasValidCoordinates) {
      setErrorMsg('يرجى تحديد موقع التوصيل على الخريطة (اضغط على الخريطة أو اسحب الدبوس) قبل تأكيد الطلب.');
      return;
    }

    if (mode === 'brand' && !selectedMerchant) {
      setErrorMsg('يرجى اختيار المطعم أو المتجر أولاً.');
      setStep('brand_select');
      return;
    }

    if (mode === 'brand' && !brandOrderItems.trim()) {
      setErrorMsg('يرجى كتابة الأصناف أو الطلبات المطلوبة من المتجر.');
      return;
    }

    if (mode === 'custom' && (!customWhatToPickup.trim() || !customPickupFrom.trim())) {
      setErrorMsg('يرجى استكمال تفاصيل الأوردر المخصوص.');
      setStep('custom_details');
      return;
    }

    if (!deliveryAddress.trim()) {
      setErrorMsg('يرجى كتابة تفاصيل عنوان التوصيل (الشارع، رقم العقار، الدور).');
      return;
    }

    if (!customerPhone.trim() || customerPhone.replace(/\D/g, '').length < 10) {
      setErrorMsg('يرجى إدخال رقم هاتف صحيح للتواصل عند الوصول.');
      return;
    }

    if (paymentMethod === 'card' && !isCardPaid) {
      setErrorMsg('يرجى الضغط على زر «ادفع الآن» لإتمام الدفع بالبطاقة قبل تأكيد الطلب.');
      return;
    }

    setSubmitting(true);
    const fromZoneName =
      zones.find((z) => z.id === fromZoneId)?.name || selectedMerchant?.zone_name || 'مدينة المنيا';

    try {
      if (mode === 'brand' && selectedMerchant?.id) {
        const availability = await verifyMerchantAvailability(selectedMerchant.id);
        if (!availability.available) {
          setErrorMsg(
            availability.error || 'عذراً، هذا المتجر غير متاح حالياً لاستقبال الطلبات.'
          );
          setSubmitting(false);
          onMerchantUnavailable?.();
          return;
        }
      }

      if (selectedAddressId === 'custom' && saveNewAddress && newAddressLabel.trim()) {
        const nextList = await createCustomerAddress({
          customerId: profile.id,
          addressLabel: newAddressLabel.trim(),
          addressDetails: deliveryAddress.trim(),
          latitude: lat,
          longitude: lng,
          isDefault: savedAddresses.length === 0,
        });
        onAddressesChange(nextList);
      }

      const finalNotes =
        mode === 'brand'
          ? brandOrderItems.trim()
          : `${customWhatToPickup.trim()}${extraCustomNotes.trim() ? ` — ${extraCustomNotes.trim()}` : ''}`;

      const order = await createOrderWithAutoDispatch({
        customerId: profile.id,
        customerRecordId: profile.customer_record_id,
        customerName: customerName.trim() || 'عميل هاتلي',
        customerPhone: customerPhone.trim(),
        merchantId: mode === 'brand' ? selectedMerchant?.id ?? null : null,
        merchantName: mode === 'brand' ? selectedMerchant?.name ?? null : null,
        orderType: mode,
        fromZoneId,
        fromZoneName,
        toZoneId,
        toZoneName,
        pickupDetails: mode === 'custom' ? customPickupFrom.trim() : undefined,
        pickupPhone: mode === 'custom' ? pickupPhone.trim() : undefined,
        deliveryAddress: deliveryAddress.trim(),
        latitude: lat,
        longitude: lng,
        notes: finalNotes,
        paymentMethod,
        paymentStatus: paymentMethod === 'card' ? 'paid' : 'unpaid',
        productsTotal: orderAmount,
        deliveryFee: pricing.delivery_fee,
        customFee: 0,
        totalFee: grandTotal,
        isGuest: profile.is_guest,
      });

      setCreatedOrder(order);
      onOrderCreated(order);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setErrorMsg(
        msg
          ? `تعذر إرسال الطلب إلى قاعدة البيانات: ${msg}`
          : 'حدث خطأ أثناء إرسال الطلب. يرجى المحاولة مرة أخرى.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Order Confirmation Screen
  if (createdOrder) {
    return (
      <div className="mx-auto max-w-xl py-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-9 w-9" />
          </div>

          <h2 className="mt-5 text-2xl font-extrabold text-[#0A192F]">
            تم استلام طلبك بنجاح!
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            طلبك رقم{' '}
            <span className="tabular-nums font-bold text-[#0A192F]">
              {createdOrder.order_number || createdOrder.id.slice(0, 8)}
            </span>{' '}
            {createdOrder.status === 'assigned'
              ? 'تم توجيهه إلى أقرب مندوب متاح وجاري التحضير.'
              : 'وصل إلى نظام هاتلي وجاري تعيين أقرب مندوب لك.'}
          </p>

          <div className="mt-6 space-y-2.5 rounded-2xl bg-slate-50 p-4 text-right text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">نوع الطلب</span>
              <span className="font-bold text-[#0A192F]">
                {createdOrder.order_type === 'custom'
                  ? 'أوردر مخصوص'
                  : createdOrder.merchant_name || 'طلب من متجر'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">منطقة التوصيل</span>
              <span className="font-bold text-[#0A192F]">{createdOrder.to_zone_name}</span>
            </div>
            {createdOrder.products_total > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-slate-500">قيمة الطلب</span>
                <span className="tabular-nums font-bold text-[#0A192F]">
                  {createdOrder.products_total} ج.م
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-slate-500">رسوم التوصيل</span>
              <span className="tabular-nums font-bold text-[#0A192F]">
                {createdOrder.delivery_fee} ج.م
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200/80 pt-2">
              <span className="font-bold text-[#0A192F]">الإجمالي الكلي</span>
              <span className="tabular-nums font-extrabold text-[#FF7B00]">
                {createdOrder.total_fee} ج.م
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">طريقة الدفع</span>
              <span className="font-bold text-[#0A192F]">
                {createdOrder.payment_method === 'card' ? 'بطاقة بنكية' : 'كاش عند الاستلام'}
                <span className="mx-1.5 text-slate-300">·</span>
                <span
                  className={
                    createdOrder.payment_status === 'paid' ? 'text-emerald-700' : 'text-slate-600'
                  }
                >
                  {createdOrder.payment_status === 'paid' ? 'تم الدفع' : 'غير مدفوع'}
                </span>
              </span>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => onTrackOrder(createdOrder)}
              className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl bg-[#FF7B00] px-5 py-3 text-base font-extrabold text-white transition-colors hover:bg-[#E56E00]"
            >
              <Navigation className="h-5 w-5" />
              <span>تتبع الطلب الآن</span>
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex min-h-[52px] flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-base font-bold text-[#0A192F] transition-colors hover:bg-slate-50"
            >
              العودة للرئيسية
            </button>
          </div>
        </div>
      </div>
    );
  }

  const fromZoneName =
    zones.find((z) => z.id === fromZoneId)?.name || selectedMerchant?.zone_name || 'مدينة المنيا';

  const stepIndex =
    step === 'choose_type' ? 1 : step === 'brand_select' || step === 'custom_details' ? 2 : 3;

  const stepHeaderTitle =
    step === 'choose_type'
      ? 'إنشاء طلب جديد'
      : step === 'brand_select'
      ? 'اختر المطعم أو المتجر'
      : step === 'custom_details'
      ? 'أوردر مخصوص'
      : mode === 'brand' && selectedMerchant
      ? `تأكيد الطلب — ${selectedMerchant.name}`
      : 'تحديد موقع التوصيل والدفع';

  return (
    <div className="mx-auto max-w-3xl pb-12">
      {/* Top Step Header */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-[#0A192F] transition-colors hover:bg-slate-50 shrink-0"
        >
          <ArrowRight className="h-4 w-4" />
          <span>رجوع</span>
        </button>

        <div className="min-w-0 text-center">
          <p className="truncate text-sm font-extrabold text-[#0A192F] sm:text-base">
            {stepHeaderTitle}
          </p>
        </div>

        <span className="tabular-nums text-xs font-bold text-slate-500 shrink-0">
          خطوة {stepIndex} من 3
        </span>
      </div>

      {/* Subtle Progress Bar */}
      <div className="mb-6 grid grid-cols-3 gap-2" aria-hidden="true">
        {[1, 2, 3].map((idx) => (
          <div
            key={idx}
            className={`h-1.5 rounded-full transition-colors ${
              idx <= stepIndex ? 'bg-[#FF7B00]' : 'bg-slate-200'
            }`}
          />
        ))}
      </div>

      {/* STEP 1: Choose Order Type */}
      {step === 'choose_type' && (
        <div className="space-y-5">
          <div className="text-center sm:text-right">
            <h1 className="text-2xl font-extrabold text-[#0A192F] [text-wrap:balance]">
              عايز تطلب إيه النهاردة؟
            </h1>
            <p className="mt-1.5 text-sm text-slate-600">
              اختر نوع الطلب المناسب لك وسنوصل طلبك في أسرع وقت
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Card 1: Order from Brand */}
            <button
              type="button"
              onClick={handleChooseBrandType}
              className="group flex min-h-[210px] flex-col justify-between rounded-3xl border-2 border-slate-200 bg-white p-6 text-right shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#0A192F] active:scale-[0.99]"
            >
              <div>
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0A192F] text-[#FF7B00] shadow-sm transition-transform group-hover:scale-105">
                  <UtensilsCrossed className="h-8 w-8" />
                </div>
                <h2 className="mt-5 text-xl font-extrabold text-[#0A192F]">
                  اطلب من مطعم أو متجر
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  اختر من المطاعم والمتاجر المشتركة في المنيا وتوصل لحد باب بيتك
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-sm font-extrabold text-[#0A192F]">
                <span>عرض المطاعم والمتاجر</span>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-[#0A192F] transition-colors group-hover:bg-[#0A192F] group-hover:text-white">
                  <ArrowLeft className="h-4 w-4" />
                </span>
              </div>
            </button>

            {/* Card 2: Custom Order */}
            <button
              type="button"
              onClick={handleChooseCustomType}
              className="group flex min-h-[210px] flex-col justify-between rounded-3xl border-2 border-[#FF7B00]/40 bg-gradient-to-br from-[#FF7B00]/8 via-white to-white p-6 text-right shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#FF7B00] active:scale-[0.99]"
            >
              <div>
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FF7B00] text-white shadow-sm transition-transform group-hover:scale-105">
                  <div className="relative flex items-center justify-center">
                    <ShoppingBag className="h-7 w-7" />
                    <Bike className=" -mr-2 mt-4 h-4 w-4 text-[#0A192F]" />
                  </div>
                </div>
                <h2 className="mt-5 text-xl font-extrabold text-[#0A192F]">
                  أوردر مخصوص (اطلب أي حاجة)
                </h2>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-700">
                  المندوب هيشتريها أو يستلمها لك
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-[#FF7B00]/15 pt-4 text-sm font-extrabold text-[#FF7B00]">
                <span>ابدأ الأوردر المخصوص</span>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FF7B00] text-white transition-transform group-hover:-translate-x-0.5">
                  <ArrowLeft className="h-4 w-4" />
                </span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* STEP 2A: Brand Selection */}
      {step === 'brand_select' && (
        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-extrabold text-[#0A192F]">
                  اختر المطعم أو المتجر
                </h1>
                <p className="mt-1 text-xs text-slate-500">
                  بعد اختيار المتجر ستنتقل مباشرة لتحديد موقع التوصيل وتأكيد الطلب
                </p>
              </div>

              {onRefreshMerchants && (
                <button
                  type="button"
                  onClick={onRefreshMerchants}
                  disabled={isRefreshingMerchants}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-[#0A192F] hover:bg-slate-100 disabled:opacity-60"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 text-[#FF7B00] ${isRefreshingMerchants ? 'animate-spin' : ''}`}
                  />
                  <span>{isRefreshingMerchants ? 'جاري التحديث...' : 'تحديث المتاجر'}</span>
                </button>
              )}
            </div>

            <div className="relative mt-4">
              <Search className="pointer-events-none absolute top-3.5 right-3.5 h-5 w-5 text-slate-400" />
              <input
                type="search"
                value={merchantSearch}
                onChange={(e) => setMerchantSearch(e.target.value)}
                placeholder="ابحث باسم المطعم، السوبر ماركت، أو المنطقة..."
                className="min-h-[48px] w-full rounded-xl border border-slate-200 bg-slate-50 pr-11 pl-4 text-sm text-[#0A192F] outline-none focus:border-[#FF7B00] focus:bg-white"
              />
            </div>

            {merchantSelectError && (
              <div className="mt-4 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{merchantSelectError}</span>
              </div>
            )}
          </div>

          {filteredMerchants.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center">
              <p className="text-base font-bold text-[#0A192F]">
                {merchants.length === 0
                  ? 'لا توجد مطاعم أو متاجر نشطة متاحة حالياً'
                  : 'لم نجد متجراً مطابقاً لبحثك'}
              </p>
              <p className="mt-1.5 text-sm text-slate-500">
                يمكنك طلب أي شيء من أي مكان فوراً عبر الأوردر المخصوص.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                {merchantSearch.trim() && (
                  <button
                    type="button"
                    onClick={() => setMerchantSearch('')}
                    className="min-h-[48px] rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-[#0A192F] hover:bg-slate-50"
                  >
                    عرض كل المتاجر
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleChooseCustomType}
                  className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-[#FF7B00] px-6 py-2.5 text-sm font-extrabold text-white hover:bg-[#E56E00]"
                >
                  <ShoppingBag className="h-4 w-4" />
                  <span>اطلب أوردر مخصوص</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {filteredMerchants.map((m) => {
                const isChecking = checkingMerchantId === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={checkingMerchantId !== null}
                    onClick={() => handleSelectMerchant(m)}
                    className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-3.5 text-right shadow-sm transition-all hover:border-[#FF7B00] hover:shadow-md active:scale-[0.99] disabled:opacity-70"
                  >
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                      <img
                        src={
                          m.cover_url ||
                          '/src/assets/images/hatly_merchant_market_1794860406955.jpg'
                        }
                        alt={m.name}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-extrabold text-[#0A192F]">{m.name}</p>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                        <span className="font-bold text-[#FF7B00]">{m.category || 'متجر'}</span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{m.zone_name || 'مدينة المنيا'}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          {m.delivery_time || '25 - 35 دقيقة'}
                        </span>
                        <span className="font-bold text-[#0A192F]">
                          {isChecking ? 'جاري التحقق...' : 'اختر ←'}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* STEP 2B: Custom Order 3-Step Form */}
      {step === 'custom_details' && (
        <form
          onSubmit={handleCustomDetailsNext}
          className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7 space-y-6"
        >
          <div>
            <h1 className="text-xl font-extrabold text-[#0A192F]">
              تفاصيل الأوردر المخصوص
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              اكتب لنا 3 بيانات بسيطة وبعدها حدد مكان التوصيل على الخريطة
            </p>
          </div>

          <div className="space-y-5">
            {/* 1. What to pick up */}
            <div>
              <label
                htmlFor="custom-what-to-pickup"
                className="mb-2 flex items-center gap-2 text-sm font-extrabold text-[#0A192F]"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#FF7B00] text-xs font-extrabold text-white">
                  1
                </span>
                <span>ماذا تريد أن نستلم؟</span>
              </label>
              <textarea
                id="custom-what-to-pickup"
                required
                rows={3}
                value={customWhatToPickup}
                onChange={(e) => setCustomWhatToPickup(e.target.value)}
                placeholder="مثال: أوراق من مكتبة النيل، أو شراء علاج من الصيدلية..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-[#0A192F] outline-none transition-colors focus:border-[#FF7B00] focus:bg-white"
              />
            </div>

            {/* 2. From where */}
            <div>
              <label
                htmlFor="custom-pickup-from"
                className="mb-2 flex items-center gap-2 text-sm font-extrabold text-[#0A192F]"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#0A192F] text-xs font-extrabold text-white">
                  2
                </span>
                <span>من أين؟</span>
              </label>
              <input
                id="custom-pickup-from"
                type="text"
                required
                value={customPickupFrom}
                onChange={(e) => setCustomPickupFrom(e.target.value)}
                placeholder="مثال: مكتبة النيل - شارع طه حسين أمام الجامعة"
                className="min-h-[52px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-[#0A192F] outline-none transition-colors focus:border-[#FF7B00] focus:bg-white"
              />
            </div>

            {/* 3. Pickup phone (Optional) */}
            <div>
              <label
                htmlFor="custom-pickup-phone"
                className="mb-2 flex items-center justify-between text-sm font-extrabold text-[#0A192F]"
              >
                <span className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-200 text-xs font-extrabold text-[#0A192F]">
                    3
                  </span>
                  <span>رقم هاتف جهة الاستلام</span>
                </span>
                <span className="text-xs font-semibold text-slate-400">اختياري</span>
              </label>
              <input
                id="custom-pickup-phone"
                type="tel"
                dir="ltr"
                value={pickupPhone}
                onChange={(e) => setPickupPhone(e.target.value)}
                placeholder="010 xxxx xxxx"
                className="tabular-nums min-h-[52px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-left text-sm font-semibold text-[#0A192F] outline-none transition-colors focus:border-[#FF7B00] focus:bg-white"
              />
            </div>
          </div>

          {customFormError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">
              {customFormError}
            </div>
          )}

          <button
            type="submit"
            className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-[#FF7B00] px-6 py-3.5 text-base font-extrabold text-white shadow-lg shadow-[#FF7B00]/20 transition-colors hover:bg-[#E56E00] active:scale-[0.99]"
          >
            <span>التالي: تحديد موقع التوصيل على الخريطة</span>
            <ArrowLeft className="h-5 w-5" />
          </button>
        </form>
      )}

      {/* STEP 3: Final Checkout (Map + Payment + Total + Confirm) */}
      {step === 'checkout' && (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Compact Summary Strip (No Pickup Area/Details fields for Brand orders) */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                  mode === 'brand'
                    ? 'bg-[#0A192F] text-[#FF7B00]'
                    : 'bg-[#FF7B00]/15 text-[#FF7B00]'
                }`}
              >
                {mode === 'brand' ? (
                  <Store className="h-5 w-5" />
                ) : (
                  <ShoppingBag className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-[#0A192F]">
                  {mode === 'brand'
                    ? selectedMerchant?.name || 'متجر مختار'
                    : customWhatToPickup}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {mode === 'brand'
                    ? `${selectedMerchant?.category || 'متجر'} · ${fromZoneName}`
                    : `الاستلام من: ${customPickupFrom}`}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleBack}
              className="min-h-[36px] rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-[#0A192F] hover:bg-slate-50 shrink-0"
            >
              تغيير
            </button>
          </div>

          {/* 1. Delivery Location Map */}
          <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-extrabold text-[#0A192F]">
                  موقع التوصيل على الخريطة
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  اضغط على الخريطة أو اختر من مواقعك المحفوظة لتحديد مكان التسليم
                </p>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-bold">
                <MapPin className="h-4 w-4 text-[#FF7B00]" />
                <span className="text-[#0A192F]">المنطقة: {toZoneName}</span>
                {detected && (
                  <span className="tabular-nums text-slate-400">
                    ({detected.distanceKm} كم)
                  </span>
                )}
              </div>
            </div>

            {savedAddresses.length > 0 && (
              <div className="mt-4">
                <label
                  htmlFor="checkout-saved-address"
                  className="mb-1.5 block text-sm font-bold text-[#0A192F]"
                >
                  اختر موقع التسليم
                </label>
                <select
                  id="checkout-saved-address"
                  value={selectedAddressId}
                  onChange={(e) => handleSelectSavedAddress(e.target.value)}
                  className="min-h-[48px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-[#0A192F] outline-none focus:border-[#FF7B00] focus:bg-white"
                >
                  {savedAddresses.map((addr) => (
                    <option key={addr.id} value={addr.id}>
                      {addr.address_label}
                      {addr.is_default ? ' (الافتراضي)' : ''} — {addr.address_details}
                    </option>
                  ))}
                  <option value="custom">تحديد موقع جديد يدوياً على الخريطة</option>
                </select>
              </div>
            )}

            <div className="mt-4">
              <LeafletMap
                mode="picker"
                lat={lat}
                lng={lng}
                pinConfirmed={pinConfirmed}
                onPinChange={handlePinChange}
                heightClass="h-64 sm:h-72"
              />
            </div>

            <div
              className={`mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-2.5 text-xs ${
                hasValidCoordinates
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border border-amber-200 bg-amber-50 text-amber-900'
              }`}
            >
              <span className="font-bold">
                {selectedAddressId !== 'custom' && hasValidCoordinates
                  ? 'تم تحديد الموقع من عناوينك المحفوظة (يمكنك تحريك الدبوس لتعديله)'
                  : hasValidCoordinates
                  ? 'تم تأكيد موقع التوصيل على الخريطة'
                  : 'يرجى الضغط على الخريطة أو تثبيت الدبوس لتحديد موقع التوصيل'}
              </span>
              <span className="tabular-nums opacity-80" dir="ltr">
                {lat.toFixed(5)}, {lng.toFixed(5)}
              </span>
            </div>

            {selectedAddressId === 'custom' && (
              <div className="mt-3 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                <label className="flex min-h-[36px] cursor-pointer items-center gap-2.5 text-xs font-bold text-[#0A192F]">
                  <input
                    type="checkbox"
                    checked={saveNewAddress}
                    onChange={(e) => setSaveNewAddress(e.target.checked)}
                    className="h-4 w-4 accent-[#FF7B00]"
                  />
                  <span>حفظ هذا الموقع الجديد في «مواقعي» لاستخدامه لاحقاً</span>
                </label>

                {saveNewAddress && (
                  <input
                    type="text"
                    value={newAddressLabel}
                    onChange={(e) => setNewAddressLabel(e.target.value)}
                    placeholder="اسم الموقع (مثال: الشغل، منزل العائلة)"
                    className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-[#0A192F] outline-none focus:border-[#FF7B00]"
                  />
                )}
              </div>
            )}

            {!pinConfirmed && (
              <button
                type="button"
                onClick={() => {
                  setPinConfirmed(true);
                  setErrorMsg(null);
                }}
                className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#FF7B00] bg-[#FF7B00]/10 px-4 py-2 text-xs font-bold text-[#0A192F] hover:bg-[#FF7B00]/20"
              >
                <CheckCircle2 className="h-4 w-4 text-[#FF7B00]" />
                <span>تثبيت الدبوس في هذا الموقع ({toZoneName})</span>
              </button>
            )}

            {/* Delivery Address Details + Contact */}
            <div className="mt-5 space-y-4 border-t border-slate-100 pt-5">
              <div>
                <label className="mb-1.5 block text-sm font-bold text-[#0A192F]">
                  العنوان التفصيلي للتسليم
                </label>
                <input
                  type="text"
                  required
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="الشارع، رقم العقار، الدور، الشقة"
                  className="min-h-[48px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-[#0A192F] outline-none focus:border-[#FF7B00] focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-bold text-[#0A192F]">الاسم</label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="الاسم الكامل"
                    className="min-h-[48px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-[#0A192F] outline-none focus:border-[#FF7B00] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-bold text-[#0A192F]">
                    رقم الموبايل للتواصل
                  </label>
                  <input
                    type="tel"
                    dir="ltr"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="010 1234 5678"
                    className="tabular-nums min-h-[48px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-left text-sm font-semibold text-[#0A192F] outline-none focus:border-[#FF7B00] focus:bg-white"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* 2. Order Items (Brand) or Extra Notes (Custom) & Optional Value */}
          <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
            {mode === 'brand' ? (
              <div>
                <label className="mb-1.5 block text-sm font-extrabold text-[#0A192F]">
                  ما هي طلباتك من {selectedMerchant?.name}؟
                </label>
                <textarea
                  required
                  rows={3}
                  value={brandOrderItems}
                  onChange={(e) => setBrandOrderItems(e.target.value)}
                  placeholder="اكتب الأصناف والكميات المطلوبة بالتفصيل..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-[#0A192F] outline-none focus:border-[#FF7B00] focus:bg-white"
                />
              </div>
            ) : (
              <div>
                <label className="mb-1.5 flex items-center justify-between text-sm font-bold text-[#0A192F]">
                  <span>ملاحظات إضافية للمندوب</span>
                  <span className="text-xs font-semibold text-slate-400">اختياري</span>
                </label>
                <input
                  type="text"
                  value={extraCustomNotes}
                  onChange={(e) => setExtraCustomNotes(e.target.value)}
                  placeholder="أي تفاصيل أخرى تحب توضيحها للمندوب..."
                  className="min-h-[48px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-[#0A192F] outline-none focus:border-[#FF7B00] focus:bg-white"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="order-amount-input"
                className="mb-1.5 flex items-center justify-between text-sm font-bold text-[#0A192F]"
              >
                <span>قيمة المشتريات / الطلب</span>
                <span className="text-xs font-semibold text-slate-400">اختياري</span>
              </label>
              <div className="relative">
                <input
                  id="order-amount-input"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  dir="ltr"
                  value={orderAmountInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || Number(val) >= 0) {
                      setOrderAmountInput(val);
                    }
                  }}
                  placeholder="0"
                  className="tabular-nums min-h-[48px] w-full rounded-xl border border-slate-200 bg-slate-50 pr-4 pl-14 text-left text-base font-bold text-[#0A192F] outline-none focus:border-[#FF7B00] focus:bg-white"
                />
                <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-xs font-bold text-slate-500">
                  ج.م
                </span>
              </div>
            </div>
          </section>

          {/* 3. Total Calculation, Payment Method & Confirm */}
          <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 space-y-5">
            <h2 className="text-base font-extrabold text-[#0A192F]">
              ملخص التكلفة وطريقة الدفع
            </h2>

            {/* Total Calculation Box */}
            <div className="rounded-2xl bg-[#0A192F] p-5 text-white">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>مسار التوصيل</span>
                <span>
                  {fromZoneName} ← {toZoneName}
                </span>
              </div>

              <div className="mt-4 space-y-2.5 border-t border-white/10 pt-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">قيمة الطلب</span>
                  <span className="tabular-nums font-bold">
                    {orderAmount > 0 ? `${orderAmount} ج.م` : '0 ج.م'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-300">رسوم التوصيل</span>
                  <span className="tabular-nums font-bold">
                    {pricingLoading ? 'جاري الحساب...' : `${pricing.delivery_fee} ج.م`}
                  </span>
                </div>

                <div className="flex items-center justify-between border-t border-white/10 pt-3 text-base">
                  <span className="font-bold">الإجمالي الكلي</span>
                  <span className="tabular-nums text-2xl font-extrabold text-[#FF7B00]">
                    {pricingLoading ? '...' : `${grandTotal} ج.م`}
                  </span>
                </div>
              </div>
            </div>

            {/* Cash / Card Selection */}
            <div>
              <p className="mb-2.5 text-sm font-extrabold text-[#0A192F]">اختر طريقة الدفع</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label
                  className={`flex min-h-[60px] cursor-pointer items-center gap-3 rounded-2xl border-2 p-4 transition-colors ${
                    paymentMethod === 'cash'
                      ? 'border-[#FF7B00] bg-[#FF7B00]/6'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment_method"
                    value="cash"
                    checked={paymentMethod === 'cash'}
                    onChange={() => handleSelectPaymentMethod('cash')}
                    className="accent-[#FF7B00]"
                  />
                  <Banknote className="h-5 w-5 text-[#FF7B00]" />
                  <div>
                    <p className="text-sm font-extrabold text-[#0A192F]">كاش</p>
                    <p className="text-xs text-slate-500">الدفع نقداً عند الاستلام</p>
                  </div>
                </label>

                <label
                  className={`flex min-h-[60px] cursor-pointer items-center gap-3 rounded-2xl border-2 p-4 transition-colors ${
                    paymentMethod === 'card'
                      ? 'border-[#FF7B00] bg-[#FF7B00]/6'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment_method"
                    value="card"
                    checked={paymentMethod === 'card'}
                    onChange={() => handleSelectPaymentMethod('card')}
                    className="accent-[#FF7B00]"
                  />
                  <CreditCard className="h-5 w-5 text-[#0A192F]" />
                  <div>
                    <p className="text-sm font-extrabold text-[#0A192F]">بطاقة</p>
                    <p className="text-xs text-slate-500">دفع إلكتروني بالبطاقة البنكية</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Card Payment Simulation Panel */}
            {paymentMethod === 'card' && (
              <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-[#FF7B00]" />
                    <span className="text-sm font-extrabold text-[#0A192F]">
                      بيانات البطاقة البنكية
                    </span>
                  </div>
                  <span className="text-xs font-bold text-slate-500">VISA / Mastercard / Meeza</span>
                </div>

                <div>
                  <label
                    htmlFor="card-holder-input"
                    className="mb-1 block text-xs font-bold text-slate-600"
                  >
                    اسم حامل البطاقة
                  </label>
                  <input
                    id="card-holder-input"
                    type="text"
                    value={cardHolderName}
                    onChange={(e) => {
                      setCardHolderName(e.target.value);
                      resetCardPaymentIfPaid();
                    }}
                    placeholder="الاسم المدون على البطاقة"
                    className="min-h-[46px] w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-[#0A192F] outline-none focus:border-[#FF7B00]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="card-number-input"
                    className="mb-1 block text-xs font-bold text-slate-600"
                  >
                    رقم البطاقة
                  </label>
                  <input
                    id="card-number-input"
                    type="text"
                    inputMode="numeric"
                    dir="ltr"
                    maxLength={23}
                    value={cardNumber}
                    onChange={(e) => {
                      setCardNumber(e.target.value);
                      resetCardPaymentIfPaid();
                    }}
                    placeholder="4532 1234 5678 9012"
                    className="tabular-nums min-h-[46px] w-full rounded-xl border border-slate-200 bg-white px-3.5 text-left text-sm font-bold text-[#0A192F] outline-none focus:border-[#FF7B00]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="card-expiry-input"
                      className="mb-1 block text-xs font-bold text-slate-600"
                    >
                      تاريخ الانتهاء (MM/YY)
                    </label>
                    <input
                      id="card-expiry-input"
                      type="text"
                      dir="ltr"
                      maxLength={7}
                      value={cardExpiry}
                      onChange={(e) => {
                        setCardExpiry(e.target.value);
                        resetCardPaymentIfPaid();
                      }}
                      placeholder="09/28"
                      className="tabular-nums min-h-[46px] w-full rounded-xl border border-slate-200 bg-white px-3.5 text-left text-sm font-bold text-[#0A192F] outline-none focus:border-[#FF7B00]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="card-cvv-input"
                      className="mb-1 block text-xs font-bold text-slate-600"
                    >
                      رمز الأمان (CVV)
                    </label>
                    <input
                      id="card-cvv-input"
                      type="password"
                      inputMode="numeric"
                      dir="ltr"
                      maxLength={4}
                      value={cardCvv}
                      onChange={(e) => {
                        setCardCvv(e.target.value);
                        resetCardPaymentIfPaid();
                      }}
                      placeholder="123"
                      className="tabular-nums min-h-[46px] w-full rounded-xl border border-slate-200 bg-white px-3.5 text-left text-sm font-bold text-[#0A192F] outline-none focus:border-[#FF7B00]"
                    />
                  </div>
                </div>

                {cardPaymentStatus === 'paid' && paidAmount !== null && paidAmount !== grandTotal && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-bold text-amber-900">
                    تم تعديل إجمالي الطلب إلى {grandTotal} ج.م — يرجى الضغط على «ادفع الآن» لتأكيد المبلغ المحدث.
                  </div>
                )}

                {cardPaymentError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-bold text-red-700">
                    {cardPaymentError}
                  </div>
                )}

                {isCardPaid ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-4">
                    <div className="flex items-center gap-2.5 text-emerald-800">
                      <ShieldCheck className="h-6 w-6 shrink-0 text-emerald-600" />
                      <div>
                        <p className="text-sm font-extrabold">
                          تم الدفع بنجاح ({grandTotal} ج.م)
                        </p>
                        <p className="text-xs font-medium text-emerald-700">
                          يمكنك الآن الضغط على «تأكيد الطلب» لإتمام طلبك.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCardPaymentStatus('idle');
                        setPaidAmount(null);
                      }}
                      className="min-h-[36px] rounded-xl border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
                    >
                      تعديل البطاقة
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleSimulateCardPay}
                    disabled={cardPaymentStatus === 'processing' || pricingLoading}
                    className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-[#0A192F] px-5 py-3 text-sm font-extrabold text-white shadow-sm transition-colors hover:bg-[#132847] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {cardPaymentStatus === 'processing' ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-[#FF7B00]" />
                        <span>جاري معالجة الدفع...</span>
                      </>
                    ) : (
                      <>
                        <Lock className="h-4 w-4 text-[#FF7B00]" />
                        <span>
                          {pricingLoading
                            ? 'جاري حساب المبلغ...'
                            : `ادفع الآن (${grandTotal} ج.م)`}
                        </span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            {errorMsg && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
                {errorMsg}
              </div>
            )}

            {inlineAd && onSelectAd && (
              <div className="pt-1">
                <InlineAdBanner ad={inlineAd} onSelectAd={onSelectAd} />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || pricingLoading || !hasValidCoordinates || !isPaymentReady}
              className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-[#FF7B00] px-6 py-4 text-base font-extrabold text-white shadow-lg shadow-[#FF7B00]/25 transition-colors hover:bg-[#E56E00] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span>
                {submitting
                  ? 'جاري تأكيد الطلب وتعيين المندوب...'
                  : pricingLoading
                  ? 'جاري حساب رسوم التوصيل...'
                  : !hasValidCoordinates
                  ? 'حدد موقع التوصيل على الخريطة أولاً'
                  : paymentMethod === 'card' && !isCardPaid
                  ? 'اضغط «ادفع الآن» لإتمام الدفع بالبطاقة أولاً'
                  : `تأكيد الطلب (${grandTotal} ج.م)`}
              </span>
            </button>
          </section>
        </form>
      )}
    </div>
  );
};
