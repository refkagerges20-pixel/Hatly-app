import { createClient } from '@supabase/supabase-js';

const FALLBACK_SUPABASE_URL = 'https://tvomnfmwrcpgoearuvfm.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'sb_publishable_WNFa_gog8y8I7fX_utKudQ_32QuQTKl';

const supabaseUrl =
  import.meta.env?.NEXT_PUBLIC_SUPABASE_URL ||
  import.meta.env?.VITE_SUPABASE_URL ||
  FALLBACK_SUPABASE_URL;

const supabaseAnonKey =
  import.meta.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  import.meta.env?.VITE_SUPABASE_ANON_KEY ||
  FALLBACK_SUPABASE_ANON_KEY;

const noCacheFetch: typeof fetch = (input, init = {}) => {
  const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
  const isSupabaseRest = url.includes('/rest/v1/');

  if (!isSupabaseRest) {
    return fetch(input, init);
  }

  const headers = new Headers(
    init.headers ?? (input instanceof Request ? input.headers : undefined)
  );
  headers.set('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
  headers.set('Pragma', 'no-cache');

  return fetch(input, {
    ...init,
    cache: 'no-store',
    headers,
  });
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: noCacheFetch,
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export interface Zone {
  id: string;
  name: string;
  city?: string | null;
  is_active: boolean;
  latitude?: number | null;
  longitude?: number | null;
  created_at?: string;
}

export interface Merchant {
  id: string;
  name: string;
  category?: string | null;
  zone_id?: string | null;
  zone_name?: string | null;
  logo_url?: string | null;
  cover_url?: string | null;
  description?: string | null;
  address?: string | null;
  phone?: string | null;
  delivery_time?: string | null;
  is_active: boolean;
  is_preview?: boolean;
}

export interface Advertisement {
  id: string;
  title: string;
  subtitle?: string | null;
  media_type: 'image' | 'video';
  media_url: string;
  image_url?: string | null;
  video_url?: string | null;
  link_url?: string | null;
  merchant_id?: string | null;
  merchant_name?: string | null;
  category?: string | null;
  end_date?: string | null;
  is_paid?: boolean;
  is_active: boolean;
  sort_order?: number | null;
}

export type OrderStatus = 'new' | 'assigned' | 'picked_up' | 'delivered' | 'cancelled';

export interface Courier {
  id: string;
  profile_id?: string | null;
  full_name?: string | null;
  name?: string | null;
  phone?: string | null;
  vehicle_type?: string | null;
  current_lat?: number | null;
  current_lng?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: string | null;
}

export interface OrderRecord {
  id: string;
  order_number?: string | null;
  customer_id?: string | null;
  customer_name: string;
  customer_phone: string;
  merchant_id?: string | null;
  merchant_name?: string | null;
  order_type: 'brand' | 'custom';
  from_zone_id: string;
  from_zone_name?: string | null;
  to_zone_id: string;
  to_zone_name?: string | null;
  pickup_details?: string | null;
  pickup_phone?: string | null;
  delivery_address: string;
  latitude: number;
  longitude: number;
  notes: string;
  payment_method: 'cash' | 'card';
  payment_status: 'paid' | 'unpaid';
  status: OrderStatus;
  delivery_fee: number;
  custom_fee: number;
  total_fee: number;
  products_total: number;
  amount_to_collect: number;
  courier_id?: string | null;
  courier?: Courier | null;
  created_at: string;
  is_local_fallback?: boolean;
}

export interface CustomerProfile {
  id: string;
  customer_record_id?: string | null;
  full_name: string;
  phone: string;
  email?: string | null;
  zone_id?: string | null;
  default_address?: string | null;
  is_guest: boolean;
}

export interface CustomerAddress {
  id: string;
  customer_id: string;
  address_label: string;
  address_details: string;
  latitude: number;
  longitude: number;
  is_default: boolean;
  created_at?: string;
  is_local_fallback?: boolean;
}

export interface PricingResult {
  delivery_fee: number;
  custom_fee: number;
  total_fee: number;
  source: 'supabase' | 'not_found';
}

export async function fetchActiveZones(): Promise<Zone[]> {
  try {
    const { data, error } = await supabase
      .from('zones')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error || !data) {
      return [];
    }
    return data as Zone[];
  } catch {
    return [];
  }
}

export async function fetchActiveAdvertisements(
  merchantsList: Merchant[] = []
): Promise<Advertisement[]> {
  const nowIso = new Date().toISOString();

  try {
    const { data, error } = await supabase
      .from('advertisements')
      .select('*')
      .eq('is_paid', true)
      .gte('end_date', nowIso)
      .order('created_at', { ascending: false });

    console.log('[Hatly] Fetched advertisements:', { count: data?.length ?? 0, data, error });

    if (error) {
      console.error('[Hatly] Advertisements fetch error:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    const merchantMap = new Map(merchantsList.map((m) => [m.id, m]));

    return (data as Record<string, unknown>[]).map((row, idx) => {
      const merchantId = row.merchant_id ? String(row.merchant_id) : null;
      const linkedMerchant = merchantId ? merchantMap.get(merchantId) : undefined;
      const rawMediaType = String(row.media_type ?? '').toLowerCase();
      const mediaType: 'image' | 'video' = rawMediaType === 'video' ? 'video' : 'image';
      const mediaUrl = String(row.media_url ?? row.image_url ?? row.video_url ?? '');

      return {
        id: String(row.id ?? `ad-${idx}`),
        title: String(row.title ?? 'عروض هاتلي'),
        subtitle: row.subtitle ? String(row.subtitle) : null,
        media_type: mediaType,
        media_url: mediaUrl,
        image_url: mediaType === 'image' ? mediaUrl : null,
        video_url: mediaType === 'video' ? mediaUrl : null,
        link_url: row.link_url ? String(row.link_url) : null,
        merchant_id: merchantId,
        merchant_name: linkedMerchant?.name ?? 'متجر شريك في هاتلي',
        category: linkedMerchant?.category ?? 'متاجر',
        end_date: row.end_date ? String(row.end_date) : null,
        is_paid: Boolean(row.is_paid ?? true),
        is_active: true,
      };
    });
  } catch (err) {
    console.error('[Hatly] Advertisements fetch exception:', err);
    return [];
  }
}

export async function fetchRandomActiveAd(
  merchantsList: Merchant[] = [],
  excludeAdId?: string
): Promise<Advertisement | null> {
  const activeAds = await fetchActiveAdvertisements(merchantsList);
  if (activeAds.length === 0) return null;
  const pool =
    activeAds.length > 1 && excludeAdId
      ? activeAds.filter((a) => a.id !== excludeAdId)
      : activeAds;
  const picked = pool[Math.floor(Math.random() * pool.length)];
  return picked ?? activeAds[0];
}

export function isMerchantSubscriptionValid(row: Record<string, unknown>): boolean {
  if (row.is_active !== true) return false;
  const accountStatus = String(row.account_status ?? '').trim().toLowerCase();
  if (accountStatus !== 'active') return false;

  const endDateRaw = row.subscription_end_date;
  if (endDateRaw === null || endDateRaw === undefined || String(endDateRaw).trim() === '') {
    return true;
  }

  const endDateStr = String(endDateRaw).trim();
  const parsedTime = /^\d{4}-\d{2}-\d{2}$/.test(endDateStr)
    ? Date.parse(`${endDateStr}T23:59:59.999Z`)
    : Date.parse(endDateStr);

  if (Number.isNaN(parsedTime)) return true;
  return parsedTime >= Date.now();
}

export async function verifyMerchantAvailability(
  merchantId: string
): Promise<{ available: boolean; error?: string }> {
  const UNAVAILABLE_MSG = 'عذراً، هذا المتجر غير متاح حالياً لاستقبال الطلبات.';
  if (!merchantId) {
    return { available: false, error: UNAVAILABLE_MSG };
  }

  try {
    const { data, error } = await supabase
      .from('merchants')
      .select('id,is_active,account_status,subscription_plan,subscription_end_date')
      .eq('id', merchantId)
      .maybeSingle();

    if (error || !data) {
      return { available: false, error: UNAVAILABLE_MSG };
    }

    if (!isMerchantSubscriptionValid(data as Record<string, unknown>)) {
      return { available: false, error: UNAVAILABLE_MSG };
    }

    return { available: true };
  } catch {
    return { available: false, error: UNAVAILABLE_MSG };
  }
}

export async function fetchActiveMerchants(zones: Zone[]): Promise<{ merchants: Merchant[]; isLive: boolean }> {
  const nowIso = new Date().toISOString();

  try {
    const { data, error } = await supabase
      .from('merchants')
      .select('*')
      .eq('is_active', true)
      .eq('account_status', 'active')
      .or(`subscription_end_date.is.null,subscription_end_date.gte.${nowIso}`)
      .order('created_at', { ascending: false });

    console.log('[Hatly] Fetched fresh merchants from Supabase:', {
      fetchedAt: nowIso,
      count: data?.length ?? 0,
      ids: (data as Record<string, unknown>[] | null)?.map((m) => m.id) ?? [],
      error,
    });

    if (error) {
      console.error('[Hatly] Merchants fetch error:', error);
      return { merchants: [], isLive: false };
    }

    if (!data) {
      return { merchants: [], isLive: true };
    }

    const rows = (data as Record<string, unknown>[]).filter(isMerchantSubscriptionValid);
    const profileIds = Array.from(
      new Set(rows.map((r) => (r.profile_id ? String(r.profile_id) : null)).filter(Boolean) as string[])
    );

    const phoneByProfileId = new Map<string, string>();
    if (profileIds.length > 0) {
      try {
        const { data: sessionRes } = await supabase.auth.getSession();
        if (sessionRes?.session) {
          const { data: profData } = await supabase
            .from('profiles')
            .select('id,phone')
            .in('id', profileIds);
          if (profData) {
            (profData as Record<string, unknown>[]).forEach((p) => {
              if (p.id && p.phone) phoneByProfileId.set(String(p.id), String(p.phone));
            });
          }
        }
      } catch {
        // ignore if profiles RLS restricts reading merchant phones
      }
    }

    const zoneMap = new Map(zones.map((z) => [z.id, z.name]));
    const mapped: Merchant[] = rows.map((row) => {
      const zoneId = row.zone_id ? String(row.zone_id) : null;
      const profileId = row.profile_id ? String(row.profile_id) : null;
      const fallbackImg =
        String(row.category ?? '').includes('مطاع') || String(row.store_name ?? '').includes('مطعم')
          ? '/src/assets/images/hatly_merchant_grill_1794860407320.jpg'
          : '/src/assets/images/hatly_merchant_market_1794860406955.jpg';

      return {
        id: String(row.id),
        name: String(row.store_name ?? row.name ?? 'متجر شريك'),
        category: row.category ? String(row.category) : 'متاجر',
        zone_id: zoneId,
        zone_name: zoneId && zoneMap.has(zoneId) ? zoneMap.get(zoneId)! : 'المنيا',
        logo_url: row.logo_url ? String(row.logo_url) : null,
        cover_url: row.cover_url ? String(row.cover_url) : fallbackImg,
        description: row.address ? `العنوان: ${String(row.address)}` : null,
        address: row.address ? String(row.address) : null,
        phone: profileId ? phoneByProfileId.get(profileId) ?? null : null,
        delivery_time: '25 - 35 دقيقة',
        is_active: true,
        is_preview: false,
      };
    });

    return { merchants: mapped, isLive: true };
  } catch (err) {
    console.error('[Hatly] Merchants fetch exception:', err);
    return { merchants: [], isLive: false };
  }
}

export async function calculateOrderPricing(
  orderType: 'brand' | 'custom',
  fromZoneId: string,
  toZoneId: string
): Promise<PricingResult> {
  if (!fromZoneId || !toZoneId) {
    return {
      delivery_fee: 0,
      custom_fee: 0,
      total_fee: 0,
      source: 'not_found',
    };
  }

  const tableName = orderType === 'custom' ? 'custom_delivery_pricing' : 'delivery_pricing';

  const pickActivePrice = (rows: unknown[] | null | undefined): number | null => {
    if (!rows || rows.length === 0) return null;
    const typedRows = rows as Record<string, unknown>[];
    const activeRow = typedRows.find((r) => r.is_active !== false) ?? typedRows[0];
    if (!activeRow || activeRow.price === null || activeRow.price === undefined) return null;
    const numeric = Number(activeRow.price);
    return Number.isNaN(numeric) ? null : numeric;
  };

  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('from_zone_id', fromZoneId)
      .eq('to_zone_id', toZoneId);

    if (!error) {
      const exactPrice = pickActivePrice(data);
      if (exactPrice !== null) {
        return {
          delivery_fee: exactPrice,
          custom_fee: 0,
          total_fee: exactPrice,
          source: 'supabase',
        };
      }
    }

    // Check reverse route only if exact (from_zone_id -> to_zone_id) row does not exist
    const { data: revData, error: revError } = await supabase
      .from(tableName)
      .select('*')
      .eq('from_zone_id', toZoneId)
      .eq('to_zone_id', fromZoneId);

    if (!revError) {
      const reversePrice = pickActivePrice(revData);
      if (reversePrice !== null) {
        return {
          delivery_fee: reversePrice,
          custom_fee: 0,
          total_fee: reversePrice,
          source: 'supabase',
        };
      }
    }
  } catch {
    // Query error returns not_found with 0 fee rather than any hardcoded price
  }

  return {
    delivery_fee: 0,
    custom_fee: 0,
    total_fee: 0,
    source: 'not_found',
  };
}

export async function syncProfileAndCustomer(profile: CustomerProfile): Promise<void> {
  if (profile.is_guest || !profile.id || profile.id.startsWith('guest-')) {
    return;
  }
  try {
    const { error: profErr } = await supabase.from('profiles').upsert(
      {
        id: profile.id,
        full_name: profile.full_name,
        phone: profile.phone || null,
        ...(profile.email ? { email: profile.email } : {}),
        role: 'customer',
        status: 'active',
      },
      { onConflict: 'id' }
    );
    if (profErr) {
      console.error('[Hatly Auth] Error syncing profiles table:', profErr);
    }
  } catch (err) {
    console.error('[Hatly Auth] Exception syncing profiles table:', err);
  }

  try {
    const { data: existingCust, error: custLookupErr } = await supabase
      .from('customers')
      .select('id')
      .eq('profile_id', profile.id)
      .maybeSingle();

    if (custLookupErr) {
      console.error('[Hatly Auth] Error checking customers table:', custLookupErr);
    }

    if (existingCust?.id) {
      const { error: custUpdateErr } = await supabase
        .from('customers')
        .update({
          default_address: profile.default_address ?? null,
          ...(profile.zone_id ? { default_zone_id: profile.zone_id } : {}),
        })
        .eq('id', String(existingCust.id));
      if (custUpdateErr) {
        console.error('[Hatly Auth] Error updating customers table:', custUpdateErr);
      }
    } else {
      const { error: custInsertErr } = await supabase.from('customers').insert({
        profile_id: profile.id,
        default_zone_id: profile.zone_id ?? null,
        default_address: profile.default_address ?? null,
      });
      if (custInsertErr) {
        console.error('[Hatly Auth] Error inserting into customers table:', custInsertErr);
      }
    }
  } catch (err) {
    console.error('[Hatly Auth] Exception syncing customers table:', err);
  }
}

export async function fetchAuthenticatedProfile(userId: string, fallbackPhone = ''): Promise<CustomerProfile | null> {
  try {
    const [{ data: prof, error: profErr }, { data: cust, error: custErr }, { data: authData }] = await Promise.all([
      supabase.from('profiles').select('id,full_name,phone,email,role,status').eq('id', userId).maybeSingle(),
      supabase.from('customers').select('id,profile_id,default_address,default_zone_id').eq('profile_id', userId).maybeSingle(),
      supabase.auth.getUser(),
    ]);

    if (profErr) console.error('[Hatly Auth] Error reading profile:', profErr);
    if (custErr) console.error('[Hatly Auth] Error reading customer:', custErr);

    const custRow = cust as Record<string, unknown> | null;
    const profRow = prof as Record<string, unknown> | null;
    const meta = (authData?.user?.user_metadata ?? {}) as Record<string, unknown>;

    const fullName =
      profRow?.full_name ||
      meta?.full_name ||
      meta?.name ||
      'عميل هاتلي';
    const phone =
      profRow?.phone ||
      meta?.phone ||
      authData?.user?.phone ||
      fallbackPhone;

    return {
      id: userId,
      customer_record_id: custRow?.id ? String(custRow.id) : userId,
      full_name: String(fullName),
      phone: String(phone),
      email: profRow?.email ? String(profRow.email) : authData?.user?.email ?? null,
      zone_id: custRow?.default_zone_id ? String(custRow.default_zone_id) : null,
      default_address: custRow?.default_address ? String(custRow.default_address) : null,
      is_guest: false,
    };
  } catch (err) {
    console.error('[Hatly Auth] Exception fetching authenticated profile:', err);
    return null;
  }
}

export async function fetchOrCreateCustomerProfile(params: {
  userId: string;
  phone?: string;
  email?: string;
  fullName?: string;
  zoneId?: string | null;
}): Promise<CustomerProfile> {
  const { userId, phone = '', email = '', fullName, zoneId } = params;

  const { data: sessionRes } = await supabase.auth.getSession();
  if (!sessionRes?.session || sessionRes.session.user.id !== userId) {
    console.warn('[Hatly Auth] Missing or mismatched active session before profile/customer sync:', {
      expectedUserId: userId,
      sessionUserId: sessionRes?.session?.user?.id ?? null,
    });
  }

  // 1. Check if profiles record exists
  const { data: existingProfile, error: profSelectErr } = await supabase
    .from('profiles')
    .select('id,full_name,phone,email,role,status')
    .eq('id', userId)
    .maybeSingle();

  if (profSelectErr) {
    console.error('[Hatly Auth] Failed to check profiles table:', profSelectErr);
  }

  let profRow = existingProfile as Record<string, unknown> | null;

  const emailFallbackName = email ? email.split('@')[0] : '';
  const resolvedName =
    fullName?.trim() ||
    (profRow?.full_name ? String(profRow.full_name) : '') ||
    emailFallbackName ||
    'عميل هاتلي';

  const resolvedPhone =
    phone.trim() ||
    (profRow?.phone ? String(profRow.phone) : '');

  // 2. If not, insert into profiles (id, full_name, phone, role='customer', status='active')
  if (!profRow) {
    const profileInsertPayload: Record<string, unknown> = {
      id: userId,
      full_name: resolvedName,
      phone: resolvedPhone || null,
      role: 'customer',
      status: 'active',
    };
    if (email) {
      profileInsertPayload.email = email;
    }

    const { error: profInsertErr } = await supabase
      .from('profiles')
      .insert(profileInsertPayload);

    if (profInsertErr) {
      console.error('[Hatly Auth] Failed to insert into profiles:', profInsertErr);
      if (profInsertErr.code !== '23505') {
        const msgLower = (profInsertErr.message || '').toLowerCase();
        if (msgLower.includes('row-level security') || profInsertErr.code === '42501') {
          throw new Error(
            'تعذر إنشاء ملف التعريف بسبب صلاحيات الأمان (RLS) لجدول profiles. تأكد من تفعيل الحساب أو سياسة الإدراج.'
          );
        }
        throw new Error(`تعذر إنشاء ملف التعريف (profiles): ${profInsertErr.message}`);
      }
    } else {
      console.log('[Hatly Auth] Created new profiles record for user:', userId);
    }

    const { data: refetchedProf, error: refetchProfErr } = await supabase
      .from('profiles')
      .select('id,full_name,phone,email,role,status')
      .eq('id', userId)
      .maybeSingle();

    if (refetchProfErr) {
      console.error('[Hatly Auth] Post-insert profile fetch warning:', refetchProfErr);
    }
    profRow = (refetchedProf as Record<string, unknown> | null) ?? profileInsertPayload;
  } else if (fullName?.trim() || phone.trim()) {
    const updateFields: Record<string, unknown> = {};
    if (fullName?.trim()) updateFields.full_name = resolvedName;
    if (phone.trim()) updateFields.phone = resolvedPhone;
    const { error: profUpdateErr } = await supabase
      .from('profiles')
      .update(updateFields)
      .eq('id', userId);
    if (profUpdateErr) {
      console.error('[Hatly Auth] Failed to update profiles record:', profUpdateErr);
    }
  }

  // 3. Ensure customers record exists (profile_id: user.id, default_zone_id)
  const { data: existingCustomer, error: custSelectErr } = await supabase
    .from('customers')
    .select('id,profile_id,default_address,default_zone_id')
    .eq('profile_id', userId)
    .maybeSingle();

  if (custSelectErr) {
    console.error('[Hatly Auth] Failed to check customers table:', custSelectErr);
  }

  let custRow = existingCustomer as Record<string, unknown> | null;
  let resolvedCustomerRecordId = custRow?.id ? String(custRow.id) : userId;

  if (!custRow) {
    const { data: insertedCust, error: custInsertErr } = await supabase
      .from('customers')
      .insert({
        profile_id: userId,
        default_zone_id: zoneId || null,
        default_address: '',
      })
      .select('id,profile_id,default_address,default_zone_id')
      .maybeSingle();

    if (custInsertErr) {
      console.error('[Hatly Auth] Failed to insert into customers:', custInsertErr);
      if (custInsertErr.code !== '23505') {
        const msgLower = (custInsertErr.message || '').toLowerCase();
        if (msgLower.includes('row-level security') || custInsertErr.code === '42501') {
          throw new Error(
            'تعذر إنشاء سجل العميل بسبب صلاحيات الأمان (RLS) لجدول customers.'
          );
        }
        throw new Error(`تعذر إنشاء سجل العميل (customers): ${custInsertErr.message}`);
      }
      const { data: refetchedCust } = await supabase
        .from('customers')
        .select('id,profile_id,default_address,default_zone_id')
        .eq('profile_id', userId)
        .maybeSingle();
      custRow = refetchedCust as Record<string, unknown> | null;
      if (custRow?.id) resolvedCustomerRecordId = String(custRow.id);
    } else {
      console.log('[Hatly Auth] Created new customers record:', insertedCust);
      custRow = insertedCust as Record<string, unknown> | null;
      if (custRow?.id) {
        resolvedCustomerRecordId = String(custRow.id);
      }
    }
  } else if (zoneId && !custRow.default_zone_id) {
    const { error: custUpdateErr } = await supabase
      .from('customers')
      .update({ default_zone_id: zoneId })
      .eq('id', resolvedCustomerRecordId);
    if (custUpdateErr) {
      console.error('[Hatly Auth] Failed to update customers default_zone_id:', custUpdateErr);
    }
  }

  return {
    id: userId,
    customer_record_id: resolvedCustomerRecordId,
    full_name: resolvedName,
    phone: resolvedPhone || email,
    email: email || (profRow?.email ? String(profRow.email) : null),
    zone_id: custRow?.default_zone_id ? String(custRow.default_zone_id) : zoneId ?? null,
    default_address: custRow?.default_address ? String(custRow.default_address) : '',
    is_guest: false,
  };
}

const LOCAL_ORDERS_KEY = 'hatly_customer_orders_v1';

export function getLocalOrders(): OrderRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_ORDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalOrder(order: OrderRecord): void {
  try {
    const existing = getLocalOrders().filter((o) => o.id !== order.id);
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify([order, ...existing]));
  } catch {
    // ignore storage errors
  }
}

export function updateLocalOrder(orderId: string, patch: Partial<OrderRecord>): OrderRecord[] {
  const updated = getLocalOrders().map((o) => (o.id === orderId ? { ...o, ...patch } : o));
  try {
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
  return updated;
}

export function parseCoord(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string' && val.trim() !== '') {
    const n = Number(val);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function mapRemoteOrderRow(
  row: Record<string, unknown>,
  zoneMap: Map<string, string>,
  merchantMap: Map<string, string>
): OrderRecord {
  const totalAmount = Number(row.total ?? row.total_fee ?? 0);
  const productsTotal = Number(row.products_total ?? 0);
  const customFee = Number(row.custom_fee ?? 0);
  const derivedDeliveryFee =
    row.delivery_fee_net !== undefined && row.delivery_fee_net !== null
      ? Number(row.delivery_fee_net)
      : row.delivery_fee_base !== undefined && row.delivery_fee_base !== null
      ? Number(row.delivery_fee_base)
      : typeof row.delivery_fee === 'number'
      ? Number(row.delivery_fee)
      : Math.max(0, Math.round((totalAmount - productsTotal - customFee) * 100) / 100);

  const merchantId = row.merchant_id ? String(row.merchant_id) : null;
  const serviceType = row.service_type ? String(row.service_type) : null;
  const orderType: 'brand' | 'custom' =
    serviceType === 'custom' || (!serviceType && !merchantId) ? 'custom' : 'brand';

  return {
    id: String(row.id),
    order_number: row.order_number
      ? String(row.order_number)
      : `HTL-${String(row.id).slice(0, 6).toUpperCase()}`,
    customer_id: row.customer_id ? String(row.customer_id) : null,
    customer_name: String(row.customer_name ?? 'عميل هاتلي'),
    customer_phone: String(row.customer_phone ?? ''),
    merchant_id: merchantId,
    merchant_name: merchantId ? merchantMap.get(merchantId) ?? null : null,
    order_type: orderType,
    from_zone_id: String(row.from_zone_id ?? ''),
    from_zone_name: zoneMap.get(String(row.from_zone_id ?? '')) ?? 'المنيا',
    to_zone_id: String(row.to_zone_id ?? ''),
    to_zone_name: zoneMap.get(String(row.to_zone_id ?? '')) ?? 'المنيا',
    pickup_details: null,
    pickup_phone: row.pickup_phone ? String(row.pickup_phone) : null,
    delivery_address: String(row.delivery_address ?? ''),
    latitude: Number(row.latitude ?? 28.1099),
    longitude: Number(row.longitude ?? 30.7503),
    notes: String(row.customer_notes ?? row.notes ?? ''),
    payment_method: row.payment_method === 'card' ? 'card' : 'cash',
    payment_status:
      row.payment_status === 'paid' || row.payment_status === 'unpaid'
        ? row.payment_status
        : row.payment_method === 'card'
        ? 'paid'
        : 'unpaid',
    status: (row.status as OrderStatus) ?? 'new',
    delivery_fee: derivedDeliveryFee,
    custom_fee: customFee,
    total_fee: totalAmount,
    products_total: productsTotal,
    amount_to_collect: Number(row.amount_to_collect ?? 0),
    courier_id: row.courier_id ? String(row.courier_id) : null,
    created_at: row.created_at ? String(row.created_at) : new Date().toISOString(),
    is_local_fallback: false,
  };
}

export async function createOrderWithAutoDispatch(input: {
  customerId: string;
  customerRecordId?: string | null;
  customerName: string;
  customerPhone: string;
  merchantId?: string | null;
  merchantName?: string | null;
  orderType: 'brand' | 'custom';
  fromZoneId: string;
  fromZoneName: string;
  toZoneId: string;
  toZoneName: string;
  pickupDetails?: string;
  pickupPhone?: string;
  deliveryAddress: string;
  latitude: number;
  longitude: number;
  notes: string;
  paymentMethod: 'cash' | 'card';
  paymentStatus?: 'paid' | 'unpaid';
  productsTotal?: number;
  deliveryFee: number;
  customFee?: number;
  totalFee: number;
  isGuest: boolean;
}): Promise<OrderRecord> {
  const orderNumber = `HTL-${Math.floor(100000 + Math.random() * 900000)}`;
  const productsTotal =
    typeof input.productsTotal === 'number' && !Number.isNaN(input.productsTotal) && input.productsTotal > 0
      ? Math.round(input.productsTotal * 100) / 100
      : 0;
  const deliveryFeeBase =
    typeof input.deliveryFee === 'number' && Number.isFinite(input.deliveryFee) && input.deliveryFee >= 0
      ? Math.round(input.deliveryFee * 100) / 100
      : 0;
  const customFee =
    typeof input.customFee === 'number' && Number.isFinite(input.customFee) && input.customFee >= 0
      ? Math.round(input.customFee * 100) / 100
      : 0;
  const deliveryFeeNet = Math.round((deliveryFeeBase + customFee) * 100) / 100;
  const computedTotal = Math.round((productsTotal + deliveryFeeNet) * 100) / 100;
  const totalFee =
    typeof input.totalFee === 'number' && Number.isFinite(input.totalFee) && input.totalFee > 0
      ? Math.round(input.totalFee * 100) / 100
      : computedTotal;
  const paymentStatus: 'paid' | 'unpaid' =
    input.paymentStatus ?? (input.paymentMethod === 'card' ? 'paid' : 'unpaid');
  const amountToCollect =
    paymentStatus === 'paid' || input.paymentMethod === 'card' ? 0 : totalFee;

  const combinedCustomerNotes =
    input.orderType === 'custom' && input.pickupDetails
      ? `تفاصيل الاستلام: ${input.pickupDetails}${input.notes ? `\nملاحظات: ${input.notes}` : ''}`
      : input.notes;

  const effectiveCustomerId = input.customerRecordId || input.customerId;

  // Ensure customer row exists before order insert if FK references customers(id)
  if (!input.isGuest && effectiveCustomerId) {
    try {
      const { data: custCheck } = await supabase
        .from('customers')
        .select('id')
        .or(`id.eq.${effectiveCustomerId},profile_id.eq.${input.customerId}`)
        .maybeSingle();

      if (!custCheck) {
        await supabase.from('customers').insert({
          id: input.customerId,
          profile_id: input.customerId,
          default_address: input.deliveryAddress,
        });
      }
    } catch {
      // ignore if already exists or RLS-handled
    }
  }

  const validLat = parseCoord(input.latitude);
  const validLng = parseCoord(input.longitude);
  if (validLat === null || validLng === null || (validLat === 0 && validLng === 0)) {
    throw new Error('يرجى تحديد موقع التوصيل (الإحداثيات) على الخريطة قبل تأكيد الطلب.');
  }

  const dbPayload: Record<string, unknown> = {
    order_number: orderNumber,
    customer_id: input.isGuest ? null : effectiveCustomerId,
    customer_name: input.customerName,
    customer_phone: input.customerPhone,
    merchant_id: input.merchantId || null,
    service_type: input.orderType,
    from_zone_id: input.fromZoneId,
    to_zone_id: input.toZoneId,
    pickup_phone: input.pickupPhone || null,
    delivery_address: input.deliveryAddress,
    latitude: validLat,
    longitude: validLng,
    customer_notes: combinedCustomerNotes,
    payment_method: input.paymentMethod,
    payment_status: paymentStatus,
    order_source: 'customer_app',
    status: 'new',
    delivery_fee_base: deliveryFeeBase,
    delivery_fee_net: deliveryFeeNet,
    custom_fee: customFee,
    products_total: productsTotal,
    total: totalFee,
    amount_to_collect: amountToCollect,
  };

  console.log('[Hatly] Creating order payload:', {
    orderType: input.orderType,
    merchantId: input.merchantId,
    delivery_fee_base: deliveryFeeBase,
    delivery_fee_net: deliveryFeeNet,
    products_total: productsTotal,
    total: totalFee,
    payment_method: input.paymentMethod,
    payment_status: paymentStatus,
    latitude: validLat,
    longitude: validLng,
  });

  let { data: inserted, error } = await supabase
    .from('orders')
    .insert(dbPayload)
    .select('*')
    .single();

  // If service_type has an incompatible check constraint on the DB, retry without service_type
  if (error && (error.message?.includes('service_type') || error.code === '23514')) {
    const { service_type: _omit, ...fallbackPayload } = dbPayload;
    const retry = await supabase
      .from('orders')
      .insert(fallbackPayload)
      .select('*')
      .single();
    inserted = retry.data;
    error = retry.error;
  }

  if (error || !inserted) {
    console.error('Supabase orders insert error:', error);
    throw new Error(error?.message || 'تعذر حفظ الطلب في قاعدة البيانات');
  }

  const row = inserted as Record<string, unknown>;
  const createdRecord: OrderRecord = {
    id: String(row.id),
    order_number: row.order_number ? String(row.order_number) : orderNumber,
    customer_id: row.customer_id ? String(row.customer_id) : effectiveCustomerId,
    customer_name: String(row.customer_name ?? input.customerName),
    customer_phone: String(row.customer_phone ?? input.customerPhone),
    merchant_id: input.merchantId ?? null,
    merchant_name: input.merchantName ?? null,
    order_type: input.orderType,
    from_zone_id: input.fromZoneId,
    from_zone_name: input.fromZoneName,
    to_zone_id: input.toZoneId,
    to_zone_name: input.toZoneName,
    pickup_details: input.pickupDetails ?? null,
    pickup_phone: input.pickupPhone ?? null,
    delivery_address: String(row.delivery_address ?? input.deliveryAddress),
    latitude: Number(row.latitude ?? input.latitude),
    longitude: Number(row.longitude ?? input.longitude),
    notes: String(row.customer_notes ?? combinedCustomerNotes),
    payment_method: row.payment_method === 'card' ? 'card' : input.paymentMethod,
    payment_status:
      row.payment_status === 'paid' || row.payment_status === 'unpaid'
        ? row.payment_status
        : paymentStatus,
    status: (row.status as OrderStatus) || 'new',
    delivery_fee:
      row.delivery_fee_net !== undefined && row.delivery_fee_net !== null
        ? Number(row.delivery_fee_net)
        : row.delivery_fee_base !== undefined && row.delivery_fee_base !== null
        ? Number(row.delivery_fee_base)
        : deliveryFeeNet,
    custom_fee: Number(row.custom_fee ?? customFee),
    total_fee: Number(row.total ?? totalFee),
    products_total: Number(row.products_total ?? productsTotal),
    amount_to_collect: Number(row.amount_to_collect ?? amountToCollect),
    courier_id: row.courier_id ? String(row.courier_id) : null,
    created_at: row.created_at ? String(row.created_at) : new Date().toISOString(),
    is_local_fallback: false,
  };

  // If DB trigger didn't auto-assign a courier yet, trigger Auto-Dispatch from couriers table
  if (createdRecord.courier_id) {
    createdRecord.courier = await fetchCourierById(createdRecord.courier_id);
  } else {
    try {
      const { data: couriers } = await supabase
        .from('couriers')
        .select('id,profile_id,current_lat,current_lng,status')
        .limit(30);

      if (couriers && couriers.length > 0) {
        const rows = couriers as Record<string, unknown>[];
        const available = rows.filter((c) => {
          const st = String(c.status ?? '').toLowerCase();
          return st === 'available' || st === 'online' || st === 'active' || st === 'idle' || st === '';
        });

        const pool = available.length > 0 ? available : [];
        if (pool.length > 0) {
          // Pick closest courier by coordinates if available
          pool.sort((a, b) => {
            const aLat = parseCoord(a.current_lat);
            const aLng = parseCoord(a.current_lng);
            const bLat = parseCoord(b.current_lat);
            const bLng = parseCoord(b.current_lng);
            if (aLat === null || aLng === null) return 1;
            if (bLat === null || bLng === null) return -1;
            const distA = Math.hypot(aLat - input.latitude, aLng - input.longitude);
            const distB = Math.hypot(bLat - input.latitude, bLng - input.longitude);
            return distA - distB;
          });

          const chosen = pool[0];
          const chosenId = String(chosen.id);

          const { error: assignErr } = await supabase
            .from('orders')
            .update({ courier_id: chosenId, status: 'assigned' })
            .eq('id', createdRecord.id);

          if (!assignErr) {
            createdRecord.courier_id = chosenId;
            createdRecord.status = 'assigned';
            createdRecord.courier = await fetchCourierById(chosenId);
          }
        }
      }
    } catch {
      // Auto-dispatch attempted; status remains 'new' if no courier available or RLS restricted
    }
  }

  saveLocalOrder(createdRecord);
  return createdRecord;
}

export function buildPhoneVariants(rawPhone?: string | null): string[] {
  if (!rawPhone) return [];
  const trimmed = rawPhone.trim();
  if (!trimmed || trimmed.includes('@')) return [];

  // Strip spaces, dashes, and parentheses while preserving leading '+'
  const compact = trimmed.replace(/[\s\-().,]/g, '');
  if (!compact || compact.replace(/\D/g, '').length < 7) return [];

  const variants = new Set<string>();
  const sanitize = (v: string) => v.replace(/[,()]/g, '');

  variants.add(sanitize(trimmed));
  variants.add(sanitize(compact));

  const digitsOnly = compact.replace(/\D/g, '');
  if (digitsOnly.length >= 7) {
    variants.add(digitsOnly);
  }

  // Egyptian mobile normalization: 01xxxxxxxxx <-> +201xxxxxxxxx <-> 201xxxxxxxxx
  if (/^01\d{9}$/.test(digitsOnly)) {
    variants.add(`+2${digitsOnly}`);
    variants.add(`2${digitsOnly}`);
  } else if (/^201\d{9}$/.test(digitsOnly)) {
    variants.add(`+${digitsOnly}`);
    variants.add(`0${digitsOnly.slice(2)}`);
  } else if (/^1\d{9}$/.test(digitsOnly)) {
    variants.add(`0${digitsOnly}`);
    variants.add(`+20${digitsOnly}`);
    variants.add(`20${digitsOnly}`);
  }

  return Array.from(variants).filter(Boolean);
}

export async function fetchOrdersForCustomer(
  customerId: string,
  customerRecordId: string | null | undefined,
  isGuest: boolean,
  zones: Zone[],
  merchants: Merchant[] = [],
  customerPhone?: string | null
): Promise<{ orders: OrderRecord[]; error: string | null }> {
  if (isGuest || !customerId || customerId.startsWith('guest-')) {
    return { orders: [], error: null };
  }

  try {
    const [{ data: sessionRes }, { data: authRes, error: authErr }] = await Promise.all([
      supabase.auth.getSession(),
      supabase.auth.getUser(),
    ]);

    if (authErr) {
      console.warn('[Hatly Orders] auth.getUser warning:', authErr);
    }

    const activeSession = sessionRes?.session ?? null;
    const authUser = authRes?.user ?? activeSession?.user ?? null;
    const effectiveProfileId = authUser?.id || customerId;

    if (!activeSession?.access_token) {
      console.warn('[Hatly Orders] No active Supabase Auth session! RLS will return empty orders.', {
        customerId,
        effectiveProfileId,
      });
    }

    // Fetch ALL matching customers rows (avoid maybeSingle error if >1 row) & profiles.phone
    const [{ data: custRows, error: custErr }, { data: profRow, error: profErr }] = await Promise.all([
      supabase
        .from('customers')
        .select('id,profile_id')
        .eq('profile_id', effectiveProfileId),
      supabase
        .from('profiles')
        .select('id,phone')
        .eq('id', effectiveProfileId)
        .maybeSingle(),
    ]);

    if (custErr) {
      console.warn('[Hatly Orders] customers lookup warning:', custErr);
    }
    if (profErr) {
      console.warn('[Hatly Orders] profiles phone lookup warning:', profErr);
    }

    const idSet = new Set<string>();
    const addId = (val?: string | null) => {
      const cleaned = val?.trim();
      if (cleaned && !cleaned.startsWith('guest-') && !/[,()"']/.test(cleaned)) {
        idSet.add(cleaned);
      }
    };

    addId(authUser?.id);
    addId(effectiveProfileId);
    addId(customerId);
    addId(customerRecordId);
    if (Array.isArray(custRows)) {
      custRows.forEach((row) => {
        if (row && typeof row === 'object' && 'id' in row && row.id) {
          addId(String(row.id));
        }
      });
    }

    const phoneSet = new Set<string>();
    const digitSuffixSet = new Set<string>();
    const metaPhone = (authUser?.user_metadata as Record<string, unknown> | undefined)?.phone;
    [
      customerPhone,
      profRow?.phone ? String(profRow.phone) : null,
      authUser?.phone,
      metaPhone ? String(metaPhone) : null,
    ].forEach((candidate) => {
      buildPhoneVariants(candidate).forEach((v) => {
        phoneSet.add(v);
        const digits = v.replace(/\D/g, '');
        if (digits.length >= 10) {
          digitSuffixSet.add(digits.slice(-10));
        }
      });
    });

    const candidateCustomerIds = Array.from(idSet);
    const phoneVariants = Array.from(phoneSet);
    const phoneSuffixes = Array.from(digitSuffixSet);

    const quoteOrValue = (val: string) =>
      /[+\s"()]/.test(val) ? `"${val.replace(/"/g, '')}"` : val;

    const orClauses = [
      ...candidateCustomerIds.map((id) => `customer_id.eq.${id}`),
      ...phoneVariants.map((ph) => `customer_phone.eq.${quoteOrValue(ph)}`),
      ...phoneSuffixes.map((suffix) => `customer_phone.ilike.*${suffix}`),
    ];

    if (orClauses.length === 0) {
      return { orders: [], error: null };
    }

    const orFilter = orClauses.join(',');

    console.log('[Hatly Orders] Fetching orders from Supabase:', {
      hasActiveSession: Boolean(activeSession?.access_token),
      authUserId: authUser?.id ?? null,
      profileId: effectiveProfileId,
      customerIdsInTable: Array.isArray(custRows) ? custRows.map((r) => r.id) : [],
      candidateCustomerIds,
      phoneVariants,
      phoneSuffixes,
      query: `orders?select=*&or=(${orFilter})&order=created_at.desc`,
    });

    let { data, error } = await supabase
      .from('orders')
      .select('*')
      .or(orFilter)
      .order('created_at', { ascending: false });

    console.log('[Hatly Orders] Primary orders query result:', {
      count: data?.length ?? 0,
      data,
      error,
    });

    // Dedicated customer_id fallback (avoids any .or() parsing issues)
    if ((error || !data || data.length === 0) && candidateCustomerIds.length > 0) {
      const { data: idData, error: idErr } = await supabase
        .from('orders')
        .select('*')
        .in('customer_id', candidateCustomerIds)
        .order('created_at', { ascending: false });

      console.log('[Hatly Orders] Customer ID fallback result:', {
        candidateCustomerIds,
        count: idData?.length ?? 0,
        data: idData,
        error: idErr,
      });

      if (!idErr && idData && idData.length > 0) {
        data = idData;
        error = null;
      }
    }

    // Dedicated customer_phone fallback (exact variants + suffix ilike)
    if ((error || !data || data.length === 0) && (phoneVariants.length > 0 || phoneSuffixes.length > 0)) {
      if (phoneVariants.length > 0) {
        const { data: phoneData, error: phoneErr } = await supabase
          .from('orders')
          .select('*')
          .in('customer_phone', phoneVariants)
          .order('created_at', { ascending: false });

        console.log('[Hatly Orders] Phone exact fallback result:', {
          phoneVariants,
          count: phoneData?.length ?? 0,
          data: phoneData,
          error: phoneErr,
        });

        if (!phoneErr && phoneData && phoneData.length > 0) {
          data = phoneData;
          error = null;
        }
      }

      if ((error || !data || data.length === 0) && phoneSuffixes.length > 0) {
        const suffix = phoneSuffixes[0];
        const { data: fuzzyData, error: fuzzyErr } = await supabase
          .from('orders')
          .select('*')
          .ilike('customer_phone', `%${suffix}`)
          .order('created_at', { ascending: false });

        console.log('[Hatly Orders] Phone fuzzy fallback result:', {
          suffix,
          count: fuzzyData?.length ?? 0,
          data: fuzzyData,
          error: fuzzyErr,
        });

        if (!fuzzyErr && fuzzyData && fuzzyData.length > 0) {
          data = fuzzyData;
          error = null;
        }
      }
    }

    if (error) {
      console.error('[Hatly Orders] Error fetching orders:', error);
      return { orders: [], error: error.message || 'تعذر تحميل الطلبات من قاعدة البيانات.' };
    }

    if (!data) {
      return { orders: [], error: null };
    }

    const zoneMap = new Map(zones.map((z) => [z.id, z.name]));
    const merchantMap = new Map(merchants.map((m) => [m.id, m.name]));

    return {
      orders: (data as Record<string, unknown>[]).map((row) =>
        mapRemoteOrderRow(row, zoneMap, merchantMap)
      ),
      error: null,
    };
  } catch (err) {
    console.error('[Hatly Orders] Exception fetching orders:', err);
    return {
      orders: [],
      error: err instanceof Error ? err.message : 'حدث خطأ أثناء تحميل الطلبات.',
    };
  }
}

export async function fetchOrderById(
  orderId: string,
  zones: Zone[],
  merchants: Merchant[] = []
): Promise<OrderRecord | null> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();

    if (error || !data) return null;
    const zoneMap = new Map(zones.map((z) => [z.id, z.name]));
    const merchantMap = new Map(merchants.map((m) => [m.id, m.name]));
    return mapRemoteOrderRow(data as Record<string, unknown>, zoneMap, merchantMap);
  } catch {
    return null;
  }
}

export async function fetchCourierById(courierId: string): Promise<Courier | null> {
  try {
    const { data, error } = await supabase
      .from('couriers')
      .select('id,profile_id,current_lat,current_lng,status')
      .eq('id', courierId)
      .maybeSingle();

    if (error || !data) return null;
    const row = data as Record<string, unknown>;
    const profileId = row.profile_id ? String(row.profile_id) : null;

    let fullName: string | null = null;
    let phone: string | null = null;

    if (profileId) {
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name,phone')
          .eq('id', profileId)
          .maybeSingle();
        if (prof) {
          fullName = prof.full_name ? String(prof.full_name) : null;
          phone = prof.phone ? String(prof.phone) : null;
        }
      } catch {
        // ignore if profiles RLS blocks reading courier profile
      }
    }

    const lat = parseCoord(row.current_lat);
    const lng = parseCoord(row.current_lng);

    return {
      id: String(row.id),
      profile_id: profileId,
      full_name: fullName,
      name: fullName,
      phone,
      current_lat: lat,
      current_lng: lng,
      latitude: lat,
      longitude: lng,
      status: row.status ? String(row.status) : null,
    };
  } catch {
    return null;
  }
}

const LOCAL_ADDRESSES_PREFIX = 'hatly_customer_addresses_v1_';

function getLocalAddresses(customerId: string): CustomerAddress[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_ADDRESSES_PREFIX}${customerId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalAddresses(customerId: string, list: CustomerAddress[]): void {
  try {
    localStorage.setItem(`${LOCAL_ADDRESSES_PREFIX}${customerId}`, JSON.stringify(list));
  } catch {
    // ignore storage errors
  }
}

function mapAddressRow(row: Record<string, unknown>, fallbackCustomerId: string): CustomerAddress {
  return {
    id: String(row.id),
    customer_id: String(row.customer_id ?? fallbackCustomerId),
    address_label: String(row.address_label ?? 'موقعي'),
    address_details: String(row.address_details ?? ''),
    latitude: Number(row.latitude ?? 28.1099),
    longitude: Number(row.longitude ?? 30.7503),
    is_default: Boolean(row.is_default),
    created_at: row.created_at ? String(row.created_at) : undefined,
    is_local_fallback: false,
  };
}

export async function fetchCustomerAddresses(customerId: string): Promise<CustomerAddress[]> {
  if (!customerId) return [];
  const local = getLocalAddresses(customerId);

  try {
    const { data, error } = await supabase
      .from('customer_addresses')
      .select('id,customer_id,address_label,address_details,latitude,longitude,is_default,created_at')
      .eq('customer_id', customerId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });

    if (error || !data) {
      return local;
    }

    const remote = (data as Record<string, unknown>[]).map((row) => mapAddressRow(row, customerId));
    // Preserve any unsynced local-only fallback items if remote is temporarily empty due to RLS insert failure
    const localOnly = local.filter((a) => a.is_local_fallback);
    if (remote.length === 0 && localOnly.length > 0) {
      return localOnly;
    }

    saveLocalAddresses(customerId, remote);
    return remote;
  } catch {
    return local;
  }
}

export async function createCustomerAddress(input: {
  customerId: string;
  addressLabel: string;
  addressDetails: string;
  latitude: number;
  longitude: number;
  isDefault: boolean;
}): Promise<CustomerAddress[]> {
  const { customerId, addressLabel, addressDetails, latitude, longitude, isDefault } = input;
  const existing = await fetchCustomerAddresses(customerId);
  const shouldBeDefault = isDefault || existing.length === 0;

  let created: CustomerAddress | null = null;

  try {
    if (shouldBeDefault && existing.length > 0) {
      await supabase
        .from('customer_addresses')
        .update({ is_default: false })
        .eq('customer_id', customerId);
    }

    const { data, error } = await supabase
      .from('customer_addresses')
      .insert({
        customer_id: customerId,
        address_label: addressLabel.trim(),
        address_details: addressDetails.trim(),
        latitude,
        longitude,
        is_default: shouldBeDefault,
      })
      .select('id,customer_id,address_label,address_details,latitude,longitude,is_default,created_at')
      .single();

    if (!error && data) {
      created = mapAddressRow(data as Record<string, unknown>, customerId);
    }
  } catch {
    // Fallback below if RLS restricts write
  }

  if (!created) {
    created = {
      id: `local-addr-${Date.now()}`,
      customer_id: customerId,
      address_label: addressLabel.trim(),
      address_details: addressDetails.trim(),
      latitude,
      longitude,
      is_default: shouldBeDefault,
      created_at: new Date().toISOString(),
      is_local_fallback: true,
    };
  }

  if (shouldBeDefault) {
    try {
      await supabase
        .from('customers')
        .update({ default_address: addressDetails.trim() })
        .or(`id.eq.${customerId},profile_id.eq.${customerId}`);
    } catch {
      // ignore optional profile default_address sync error
    }
  }

  const nextList = [
    ...(shouldBeDefault ? existing.map((a) => ({ ...a, is_default: false })) : existing),
    created,
  ].sort((a, b) => Number(b.is_default) - Number(a.is_default));

  saveLocalAddresses(customerId, nextList);
  return nextList;
}

export async function updateCustomerAddress(input: {
  id: string;
  customerId: string;
  addressLabel: string;
  addressDetails: string;
  latitude: number;
  longitude: number;
  isDefault: boolean;
}): Promise<CustomerAddress[]> {
  const { id, customerId, addressLabel, addressDetails, latitude, longitude, isDefault } = input;
  const existing = await fetchCustomerAddresses(customerId);

  try {
    if (isDefault) {
      await supabase
        .from('customer_addresses')
        .update({ is_default: false })
        .eq('customer_id', customerId);
    }

    if (!id.startsWith('local-addr-')) {
      await supabase
        .from('customer_addresses')
        .update({
          address_label: addressLabel.trim(),
          address_details: addressDetails.trim(),
          latitude,
          longitude,
          is_default: isDefault,
        })
        .eq('id', id)
        .eq('customer_id', customerId);
    }
  } catch {
    // keep local update resilient
  }

  if (isDefault) {
    try {
      await supabase
        .from('customers')
        .update({ default_address: addressDetails.trim() })
        .or(`id.eq.${customerId},profile_id.eq.${customerId}`);
    } catch {
      // ignore
    }
  }

  const nextList = existing
    .map((addr) => {
      if (addr.id === id) {
        return {
          ...addr,
          address_label: addressLabel.trim(),
          address_details: addressDetails.trim(),
          latitude,
          longitude,
          is_default: isDefault,
        };
      }
      return isDefault ? { ...addr, is_default: false } : addr;
    })
    .sort((a, b) => Number(b.is_default) - Number(a.is_default));

  saveLocalAddresses(customerId, nextList);
  return nextList;
}

export async function setDefaultCustomerAddress(
  addressId: string,
  customerId: string
): Promise<CustomerAddress[]> {
  const existing = await fetchCustomerAddresses(customerId);
  const target = existing.find((a) => a.id === addressId);

  try {
    await supabase
      .from('customer_addresses')
      .update({ is_default: false })
      .eq('customer_id', customerId);

    if (!addressId.startsWith('local-addr-')) {
      await supabase
        .from('customer_addresses')
        .update({ is_default: true })
        .eq('id', addressId)
        .eq('customer_id', customerId);
    }

    if (target) {
      await supabase
        .from('customers')
        .update({ default_address: target.address_details })
        .or(`id.eq.${customerId},profile_id.eq.${customerId}`);
    }
  } catch {
    // ignore RLS errors
  }

  const nextList = existing
    .map((a) => ({ ...a, is_default: a.id === addressId }))
    .sort((a, b) => Number(b.is_default) - Number(a.is_default));

  saveLocalAddresses(customerId, nextList);
  return nextList;
}

export async function deleteCustomerAddress(
  addressId: string,
  customerId: string
): Promise<CustomerAddress[]> {
  const existing = await fetchCustomerAddresses(customerId);
  const target = existing.find((a) => a.id === addressId);

  try {
    if (!addressId.startsWith('local-addr-')) {
      await supabase
        .from('customer_addresses')
        .delete()
        .eq('id', addressId)
        .eq('customer_id', customerId);
    }
  } catch {
    // ignore RLS errors
  }

  let nextList = existing.filter((a) => a.id !== addressId);
  if (target?.is_default && nextList.length > 0) {
    const promoted = nextList[0];
    nextList = nextList.map((a, idx) => ({ ...a, is_default: idx === 0 }));
    try {
      if (!promoted.id.startsWith('local-addr-')) {
        await supabase
          .from('customer_addresses')
          .update({ is_default: true })
          .eq('id', promoted.id)
          .eq('customer_id', customerId);
      }
    } catch {
      // ignore
    }
  }

  saveLocalAddresses(customerId, nextList);
  return nextList;
}

export const SUPPORT_WHATSAPP_NUMBER = '201012345678';
export const SUPPORT_WHATSAPP_PREFILL = 'مرحباً، أحتاج مساعدة في تطبيق هاتلي.';

export function getSupportWhatsAppUrl(customMessage?: string): string {
  const text = encodeURIComponent(customMessage || SUPPORT_WHATSAPP_PREFILL);
  return `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${text}`;
}

export interface ComplaintRecord {
  id: string;
  customer_id: string;
  order_id?: string | null;
  subject: string;
  message: string;
  status: string;
  created_at: string;
}

function mapComplaintRow(row: Record<string, unknown>, fallbackCustomerId: string): ComplaintRecord {
  return {
    id: String(row.id),
    customer_id: String(row.customer_id ?? fallbackCustomerId),
    order_id: row.order_id ? String(row.order_id) : null,
    subject: String(row.subject ?? ''),
    message: String(row.message ?? ''),
    status: String(row.status ?? 'open'),
    created_at: row.created_at ? String(row.created_at) : new Date().toISOString(),
  };
}

export async function fetchCustomerComplaints(
  customerId: string,
  customerRecordId?: string | null
): Promise<ComplaintRecord[]> {
  if (!customerId || customerId.startsWith('guest-')) return [];

  try {
    const filterExpr =
      customerRecordId && customerRecordId !== customerId
        ? `customer_id.eq.${customerId},customer_id.eq.${customerRecordId}`
        : `customer_id.eq.${customerId}`;

    const { data, error } = await supabase
      .from('complaints')
      .select('id,customer_id,order_id,subject,message,status,created_at')
      .or(filterExpr)
      .order('created_at', { ascending: false });

    if (error || !data) {
      return [];
    }

    return (data as Record<string, unknown>[]).map((row) => mapComplaintRow(row, customerId));
  } catch {
    return [];
  }
}

export async function createCustomerComplaint(input: {
  customerId: string;
  customerRecordId?: string | null;
  orderId?: string | null;
  subject: string;
  message: string;
}): Promise<ComplaintRecord> {
  const effectiveCustomerId = input.customerRecordId || input.customerId;
  const payload = {
    customer_id: effectiveCustomerId,
    order_id: input.orderId ? input.orderId : null,
    subject: input.subject.trim(),
    message: input.message.trim(),
    status: 'open',
  };

  let { data, error } = await supabase
    .from('complaints')
    .insert(payload)
    .select('id,customer_id,order_id,subject,message,status,created_at')
    .single();

  if (
    error &&
    error.code === '23503' &&
    input.customerRecordId &&
    input.customerRecordId !== input.customerId
  ) {
    const retry = await supabase
      .from('complaints')
      .insert({ ...payload, customer_id: input.customerId })
      .select('id,customer_id,order_id,subject,message,status,created_at')
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error || !data) {
    throw new Error(error?.message || 'تعذر إرسال الشكوى حالياً، يرجى المحاولة مرة أخرى.');
  }

  return mapComplaintRow(data as Record<string, unknown>, effectiveCustomerId);
}

export interface RemoteNotificationRow {
  id: string;
  user_id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export async function fetchUserNotifications(userId: string): Promise<RemoteNotificationRow[]> {
  if (!userId || userId.startsWith('guest-')) return [];

  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('id,user_id,title,message,is_read,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(25);

    if (error || !data) {
      if (error) {
        console.warn('[Hatly Notifications] Fetch notifications warning:', error);
      }
      return [];
    }

    return (data as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      user_id: String(row.user_id ?? userId),
      title: String(row.title ?? 'إشعار جديد من هاتلي'),
      message: String(row.message ?? ''),
      is_read: Boolean(row.is_read),
      created_at: row.created_at ? String(row.created_at) : new Date().toISOString(),
    }));
  } catch (err) {
    console.warn('[Hatly Notifications] Exception fetching notifications:', err);
    return [];
  }
}

export async function markNotificationAsReadInDb(notificationId: string): Promise<void> {
  if (!notificationId || notificationId.includes(':')) return;
  try {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);
  } catch {
    // ignore optional read-sync errors
  }
}

export async function markAllNotificationsAsReadInDb(userId: string): Promise<void> {
  if (!userId || userId.startsWith('guest-')) return;
  try {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
  } catch {
    // ignore optional read-sync errors
  }
}

