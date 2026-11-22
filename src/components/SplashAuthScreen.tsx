import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogIn,
  Mail,
  Phone,
  RefreshCw,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import {
  supabase,
  fetchOrCreateCustomerProfile,
  type CustomerProfile,
  type Zone,
} from '../lib/supabase';

interface SplashAuthScreenProps {
  zones: Zone[];
  onAuthenticated: (profile: CustomerProfile) => void;
}

export const SplashAuthScreen: React.FC<SplashAuthScreenProps> = ({ zones, onAuthenticated }) => {
  const [step, setStep] = useState<'welcome' | 'login' | 'verify_otp'>('welcome');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState(zones[0]?.id ?? '');

  // OTP Verification state
  const [pendingEmail, setPendingEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [needsConfirmationHint, setNeedsConfirmationHint] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedZoneId && zones.length > 0) {
      setSelectedZoneId(zones[0].id);
    }
  }, [zones, selectedZoneId]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  const formatAuthError = (rawMessage?: string | null): string => {
    const msg = (rawMessage || '').toLowerCase();
    if (msg.includes('invalid login credentials')) {
      return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
    }
    if (msg.includes('email not confirmed')) {
      return 'يرجى تأكيد بريدك الإلكتروني أولاً بإدخال كود التحقق المرسل إليك.';
    }
    if (msg.includes('user already registered') || msg.includes('already exists')) {
      return 'هذا البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول بكلمة المرور الصحيحة.';
    }
    if (msg.includes('token has expired') || (msg.includes('otp') && msg.includes('expired'))) {
      return 'انتهت صلاحية كود التحقق. يرجى الضغط على «إعادة إرسال الكود» للحصول على كود جديد.';
    }
    if (
      msg.includes('invalid token') ||
      msg.includes('otp_disabled') ||
      msg.includes('otp') ||
      msg.includes('token')
    ) {
      return 'كود التحقق غير صحيح أو منتهي الصلاحية. يرجى التأكد من الأرقام الستة والمحاولة مرة أخرى.';
    }
    if (msg.includes('password') && msg.includes('least')) {
      return 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.';
    }
    if (msg.includes('rate limit') || msg.includes('too many requests')) {
      return 'تم إرسال محاولات كثيرة متتالية. يرجى الانتظار قليلاً ثم المحاولة مرة أخرى.';
    }
    if (msg.includes('invalid email') || msg.includes('unable to validate email')) {
      return 'صيغة البريد الإلكتروني غير صحيحة.';
    }
    if (msg.includes('row-level security')) {
      return 'تعذر حفظ بيانات الحساب بسبب صلاحيات الأمان (RLS). يرجى المحاولة مرة أخرى.';
    }
    if (msg.includes('failed to fetch') || msg.includes('network')) {
      return 'تعذر الاتصال بالخادم. تحقق من اتصال الإنترنت وحاول مرة أخرى.';
    }
    return rawMessage || 'حدث خطأ أثناء العملية. يرجى المحاولة مرة أخرى.';
  };

  const completeProfileSync = async (
    user: {
      id: string;
      email?: string | null;
      phone?: string | null;
      user_metadata?: Record<string, unknown>;
    },
    session?: { access_token: string; refresh_token: string } | null,
    fallbackEmail?: string
  ) => {
    if (session?.access_token && session?.refresh_token) {
      await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
    }

    const resolvedZoneId = selectedZoneId || zones[0]?.id || null;
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const profile = await fetchOrCreateCustomerProfile({
      userId: user.id,
      email: user.email || fallbackEmail || email.trim(),
      phone: phone.trim() || String(meta.phone ?? '') || user.phone || '',
      fullName: fullName.trim() || (meta.full_name ? String(meta.full_name) : undefined),
      zoneId: resolvedZoneId || (meta.default_zone_id ? String(meta.default_zone_id) : null),
    });

    onAuthenticated(profile);
  };

  const enterOtpStep = (targetEmail: string, initialNotice?: string) => {
    setPendingEmail(targetEmail);
    setOtpCode('');
    setErrorMsg(null);
    setInfoMsg(initialNotice ?? null);
    setNeedsConfirmationHint(false);
    setResendCooldown(60);
    setStep('verify_otp');
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setNeedsConfirmationHint(false);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setErrorMsg('يرجى إدخال بريد إلكتروني صحيح.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.');
      return;
    }

    setLoading(true);
    const resolvedZoneId = selectedZoneId || zones[0]?.id || null;

    try {
      // Handle case where a user session is already active in Supabase Auth
      const { data: existingSessionData } = await supabase.auth.getSession();
      const activeUser = existingSessionData?.session?.user;
      if (activeUser) {
        if ((activeUser.email || '').toLowerCase() === trimmedEmail.toLowerCase()) {
          await completeProfileSync(activeUser, existingSessionData.session, trimmedEmail);
          return;
        }
        await supabase.auth.signOut().catch(() => {});
      }

      if (authMode === 'signin') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });

        if (error || !data.user) {
          console.error('[Hatly Auth] signInWithPassword error:', error);
          const isUnconfirmed = (error?.message || '').toLowerCase().includes('email not confirmed');
          setNeedsConfirmationHint(isUnconfirmed);
          setErrorMsg(formatAuthError(error?.message));
          return;
        }

        await completeProfileSync(data.user, data.session, trimmedEmail);
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            data: {
              full_name: fullName.trim() || undefined,
              phone: phone.trim() || undefined,
              default_zone_id: resolvedZoneId || undefined,
            },
          },
        });

        const isAlreadyRegisteredError =
          Boolean(error) &&
          ((error?.message || '').toLowerCase().includes('already registered') ||
            (error?.message || '').toLowerCase().includes('already exists') ||
            error?.status === 422);

        const isObfuscatedExistingUser =
          !error &&
          Boolean(data.user) &&
          Array.isArray(data.user?.identities) &&
          data.user.identities.length === 0;

        // If user already exists, attempt sign-in or prompt for OTP if unconfirmed
        if (isAlreadyRegisteredError || isObfuscatedExistingUser) {
          console.info('[Hatly Auth] User already registered; attempting sign-in instead of sign-up.');
          const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
            email: trimmedEmail,
            password,
          });

          if (!signInErr && signInData.user && signInData.session) {
            await completeProfileSync(signInData.user, signInData.session, trimmedEmail);
            return;
          }

          console.error('[Hatly Auth] Fallback signInWithPassword failed:', signInErr);
          const isUnconfirmed = (signInErr?.message || '').toLowerCase().includes('email not confirmed');
          if (isUnconfirmed) {
            await supabase.auth
              .resend({ type: 'signup', email: trimmedEmail })
              .catch(() => {});
            enterOtpStep(trimmedEmail);
            return;
          }

          setAuthMode('signin');
          setErrorMsg('هذا البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول بكلمة المرور الصحيحة.');
          return;
        }

        if (error) {
          console.error('[Hatly Auth] signUp error:', error);
          setErrorMsg(formatAuthError(error.message));
          return;
        }

        if (data.session && data.user) {
          await completeProfileSync(data.user, data.session, trimmedEmail);
        } else {
          // Session is null -> Confirm Email is enabled, require 6-digit OTP verification
          enterOtpStep(trimmedEmail);
        }
      }
    } catch (err) {
      console.error('[Hatly Auth] Authentication/Profile setup failed:', err);
      setErrorMsg(
        err instanceof Error
          ? formatAuthError(err.message)
          : 'حدث خطأ أثناء إعداد الحساب. يرجى المحاولة مرة أخرى.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleOpenOtpForExistingAccount = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setErrorMsg('يرجى إدخال البريد الإلكتروني أولاً.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: trimmedEmail,
      });
      if (error) {
        setErrorMsg(formatAuthError(error.message));
        return;
      }
      enterOtpStep(trimmedEmail);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    const token = otpCode.replace(/\D/g, '').trim();
    if (token.length !== 6) {
      setErrorMsg('يرجى إدخال كود التحقق المكون من 6 أرقام.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: pendingEmail,
        token,
        type: 'signup',
      });

      if (error) {
        console.error('[Hatly Auth] verifyOtp error:', error);
        setErrorMsg(formatAuthError(error.message));
        return;
      }

      let verifiedUser = data.user;
      let verifiedSession = data.session;

      if (!verifiedUser || !verifiedSession) {
        const { data: sessionFallback } = await supabase.auth.getSession();
        verifiedSession = verifiedSession ?? sessionFallback?.session ?? null;
        verifiedUser = verifiedUser ?? verifiedSession?.user ?? null;
      }

      if (!verifiedUser) {
        setErrorMsg('تعذر التحقق من الكود. يرجى التأكد من صحة الكود والمحاولة مرة أخرى.');
        return;
      }

      await completeProfileSync(verifiedUser, verifiedSession, pendingEmail);
    } catch (err) {
      console.error('[Hatly Auth] verifyOtp exception:', err);
      setErrorMsg(
        err instanceof Error
          ? formatAuthError(err.message)
          : 'كود التحقق غير صحيح أو حدث خطأ أثناء التفعيل.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || !pendingEmail) return;
    setResendingOtp(true);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: pendingEmail,
      });
      if (error) {
        setErrorMsg(formatAuthError(error.message));
        return;
      }
      setResendCooldown(60);
      setInfoMsg('تم إرسال كود تحقق جديد إلى بريدك الإلكتروني.');
    } catch {
      setErrorMsg('تعذر إعادة إرسال الكود. يرجى المحاولة مرة أخرى.');
    } finally {
      setResendingOtp(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A192F] text-white flex flex-col justify-between">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-10 lg:grid lg:grid-cols-12 lg:items-center lg:gap-12">
        {/* Brand Hero Column */}
        <div className="lg:col-span-6 flex flex-col items-center text-center">
          <div className="flex flex-col items-center">
            <div className="h-24 w-24 sm:h-28 sm:w-28 overflow-hidden rounded-3xl border border-white/20 bg-white p-1.5 shadow-xl">
              <img
                src="/src/assets/images/hatly_official_logo_1794860801844.jpg"
                alt="شعار هاتلي — Hatly"
                referrerPolicy="no-referrer"
                className="h-full w-full rounded-2xl object-contain"
              />
            </div>

            <h1 className="mt-5 text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              هاتلي
            </h1>

            <p
              dir="ltr"
              style={{ fontFamily: "'Roboto', sans-serif" }}
              className="mt-1.5 text-sm font-medium tracking-normal text-[#FF7B00]"
            >
              Hatly - Your Order. Our Mission.
            </p>
          </div>

          <h2 className="mt-10 sm:mt-12 max-w-xl text-2xl sm:text-3xl leading-snug font-bold text-white [text-wrap:balance]">
            كل طلباتك في المنيا.. توصلك لحد باب البيت بسرعة وأمان.
          </h2>
          <p className="mt-4 max-w-md text-sm sm:text-base leading-relaxed text-slate-300">
            اطلب من مطاعمك ومتاجرك المفضلة، أو ابعت أوردر مخصوص لأي مكان داخل مدينة المنيا والمنيا الجديدة والمراكز المجاورة مع تتبع لحظي للمندوب.
          </p>

          <div className="mt-10 hidden w-full max-w-lg lg:grid grid-cols-3 gap-6 border-t border-white/10 pt-6 text-sm">
            <div>
              <p className="font-bold text-[#FF7B00]">تغطية شاملة</p>
              <p className="mt-1 text-xs text-slate-300">المنيا والمنيا الجديدة والمراكز</p>
            </div>
            <div>
              <p className="font-bold text-[#FF7B00]">تحديد دقيق</p>
              <p className="mt-1 text-xs text-slate-300">خريطة تفاعلية وحساب تلقائي للسعر</p>
            </div>
            <div>
              <p className="font-bold text-[#FF7B00]">أوردر مخصوص</p>
              <p className="mt-1 text-xs text-slate-300">استلام وتوصيل أي غرض بسهولة</p>
            </div>
          </div>
        </div>

        {/* Auth Card Column */}
        <div className="mt-10 lg:mt-0 lg:col-span-6">
          <div className="rounded-3xl bg-white p-6 text-[#0A192F] shadow-2xl sm:p-8">
            {step === 'welcome' && (
              <div>
                <h3 className="text-xl font-bold text-[#0A192F]">أهلاً بك في هاتلي</h3>
                <p className="mt-1.5 text-sm text-slate-600">
                  سجل دخولك بالبريد الإلكتروني وكلمة المرور للبدء في الطلب وتتبع طلباتك لحظة بلحظة.
                </p>

                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => setStep('login')}
                    className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#FF7B00] px-5 py-3 text-base font-bold text-white transition-colors hover:bg-[#E56E00]"
                  >
                    <LogIn className="h-5 w-5" />
                    <span>تسجيل الدخول</span>
                  </button>
                </div>

                <div className="mt-6 flex items-center gap-2 text-xs text-slate-500">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-[#FF7B00]" />
                  <span>بياناتك محمية ومربوطة مباشرة مع خدمة عملاء هاتلي.</span>
                </div>
              </div>
            )}

            {step === 'login' && (
              <form onSubmit={handleAuthSubmit} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-[#0A192F]">
                    {authMode === 'signin' ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg(null);
                      setInfoMsg(null);
                      setNeedsConfirmationHint(false);
                      setStep('welcome');
                    }}
                    className="inline-flex min-h-[40px] items-center gap-1 text-sm font-semibold text-slate-500 hover:text-[#0A192F]"
                  >
                    <ArrowRight className="h-4 w-4" />
                    <span>رجوع</span>
                  </button>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-[#0A192F]">
                    الاسم الكامل
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="مثال: محمد أحمد"
                    className="min-h-[48px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-[#0A192F] outline-none focus:border-[#FF7B00] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-[#0A192F]">
                    رقم الهاتف <span className="text-xs font-normal text-slate-500">(اختياري عند الدخول)</span>
                  </label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute top-3.5 right-3.5 h-5 w-5 text-slate-400" />
                    <input
                      type="tel"
                      dir="ltr"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="010 1234 5678"
                      className="tabular-nums min-h-[48px] w-full rounded-xl border border-slate-200 bg-slate-50 pr-11 pl-4 text-left text-sm font-semibold text-[#0A192F] outline-none focus:border-[#FF7B00] focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-[#0A192F]">
                    البريد الإلكتروني
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute top-3.5 right-3.5 h-5 w-5 text-slate-400" />
                    <input
                      type="email"
                      dir="ltr"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="min-h-[48px] w-full rounded-xl border border-slate-200 bg-slate-50 pr-11 pl-4 text-left text-sm font-semibold text-[#0A192F] outline-none focus:border-[#FF7B00] focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-[#0A192F]">
                    كلمة المرور
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute top-3.5 right-3.5 h-5 w-5 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      dir="ltr"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="min-h-[48px] w-full rounded-xl border border-slate-200 bg-slate-50 pr-11 pl-11 text-left text-sm font-semibold text-[#0A192F] outline-none focus:border-[#FF7B00] focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                      className="absolute top-1.5 left-1.5 flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/60 hover:text-[#0A192F]"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {zones.length > 0 && (
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-[#0A192F]">
                      المنطقة الافتراضية
                    </label>
                    <select
                      value={selectedZoneId}
                      onChange={(e) => setSelectedZoneId(e.target.value)}
                      className="min-h-[48px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-[#0A192F] outline-none focus:border-[#FF7B00] focus:bg-white"
                    >
                      {zones.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {infoMsg && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">
                    {infoMsg}
                  </div>
                )}

                {errorMsg && (
                  <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
                    <p>{errorMsg}</p>
                    {needsConfirmationHint && (
                      <button
                        type="button"
                        onClick={handleOpenOtpForExistingAccount}
                        disabled={loading}
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-[#0A192F] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#132847]"
                      >
                        <KeyRound className="h-3.5 w-3.5 text-[#FF7B00]" />
                        <span>إرسال كود التحقق وتفعيل الحساب</span>
                      </button>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#FF7B00] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#E56E00] disabled:opacity-60"
                >
                  {authMode === 'signin' ? (
                    <LogIn className="h-4 w-4" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  <span>
                    {loading
                      ? 'جاري المعالجة...'
                      : authMode === 'signin'
                      ? 'تسجيل الدخول'
                      : 'إنشاء الحساب والدخول'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setInfoMsg(null);
                    setNeedsConfirmationHint(false);
                    setAuthMode((prev) => (prev === 'signin' ? 'signup' : 'signin'));
                  }}
                  className="flex min-h-[40px] w-full items-center justify-center text-xs font-bold text-[#0A192F] hover:text-[#FF7B00]"
                >
                  {authMode === 'signin'
                    ? 'ليس لديك حساب؟ إنشاء حساب جديد'
                    : 'لديك حساب بالفعل؟ تسجيل الدخول'}
                </button>
              </form>
            )}

            {step === 'verify_otp' && (
              <form onSubmit={handleVerifyOtp} className="space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF7B00]/12 text-[#FF7B00]">
                      <KeyRound className="h-5 w-5" />
                    </div>
                    <h3 className="text-xl font-extrabold text-[#0A192F]">تفعيل الحساب</h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg(null);
                      setInfoMsg(null);
                      setStep('login');
                    }}
                    className="inline-flex min-h-[40px] items-center gap-1 text-sm font-semibold text-slate-500 hover:text-[#0A192F]"
                  >
                    <ArrowRight className="h-4 w-4" />
                    <span>تعديل البيانات</span>
                  </button>
                </div>

                <div className="rounded-2xl border border-[#0A192F]/10 bg-slate-50 p-4 text-sm leading-relaxed text-[#0A192F]">
                  <p className="font-bold">
                    تم إرسال كود التحقق إلى بريدك الإلكتروني. يرجى إدخال الكود لتفعيل الحساب.
                  </p>
                  <p dir="ltr" className="mt-1.5 text-left text-xs font-bold text-[#FF7B00]">
                    {pendingEmail}
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="signup-otp-input"
                    className="mb-2 block text-sm font-bold text-[#0A192F]"
                  >
                    كود التحقق (6 أرقام)
                  </label>
                  <input
                    id="signup-otp-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    dir="ltr"
                    autoFocus
                    required
                    value={otpCode}
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setOtpCode(digitsOnly);
                      setErrorMsg(null);
                    }}
                    placeholder="000000"
                    className="tabular-nums min-h-[56px] w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 text-center text-2xl font-extrabold tracking-[0.45em] text-[#0A192F] outline-none transition-colors focus:border-[#FF7B00] focus:bg-white"
                  />
                </div>

                {infoMsg && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">
                    {infoMsg}
                  </div>
                )}

                {errorMsg && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
                    {errorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || otpCode.length !== 6}
                  className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[#FF7B00] px-5 py-3.5 text-base font-extrabold text-white shadow-lg shadow-[#FF7B00]/20 transition-colors hover:bg-[#E56E00] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckCircle2 className="h-5 w-5" />
                  <span>{loading ? 'جاري التحقق وتفعيل الحساب...' : 'تأكيد الحساب'}</span>
                </button>

                <div className="flex items-center justify-center pt-1">
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendCooldown > 0 || resendingOtp}
                    className="inline-flex min-h-[40px] items-center gap-1.5 text-xs font-bold text-[#0A192F] hover:text-[#FF7B00] disabled:cursor-not-allowed disabled:text-slate-400"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${resendingOtp ? 'animate-spin' : ''}`} />
                    <span>
                      {resendingOtp
                        ? 'جاري إعادة الإرسال...'
                        : resendCooldown > 0
                        ? `إعادة إرسال الكود بعد ${resendCooldown} ثانية`
                        : 'لم يصلك الكود؟ إعادة إرسال الكود'}
                    </span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
