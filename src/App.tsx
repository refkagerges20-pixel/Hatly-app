import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, ClipboardList, Home, UserRound } from 'lucide-react';
import { SplashAuthScreen } from './components/SplashAuthScreen';
import { ForcedLocationSetup } from './components/ForcedLocationSetup';
import { HomeDiscovery } from './components/HomeDiscovery';
import { MerchantDetailsView } from './components/MerchantDetailsView';
import { AdsPage } from './components/AdsPage';
import { CreateOrderFlow } from './components/CreateOrderFlow';
import { OrdersListView } from './components/OrdersListView';
import { TrackOrderView } from './components/TrackOrderView';
import { ProfileView } from './components/ProfileView';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { GlobalAdBanner } from './components/GlobalAdBanner';
import {
  LiveOrderNotifications,
  type LiveNotificationItem,
} from './components/LiveOrderNotifications';
import {
  buildPhoneVariants,
  fetchActiveAdvertisements,
  fetchActiveMerchants,
  fetchActiveZones,
  fetchCourierById,
  fetchCustomerAddresses,
  fetchOrCreateCustomerProfile,
  fetchOrdersForCustomer,
  fetchRandomActiveAd,
  fetchUserNotifications,
  mapRemoteOrderRow,
  markAllNotificationsAsReadInDb,
  markNotificationAsReadInDb,
  saveLocalOrder,
  supabase,
  updateLocalOrder,
  verifyMerchantAvailability,
  type Advertisement,
  type Courier,
  type CustomerAddress,
  type CustomerProfile,
  type Merchant,
  type OrderRecord,
  type OrderStatus,
  type Zone,
} from './lib/supabase';
import {
  enableAndTestNotificationSound,
  isNotificationSoundEnabled,
  playNotificationSound,
  setNotificationSoundEnabled,
} from './lib/notificationSound';

type ActiveTab = 'home' | 'ads' | 'orders' | 'profile';
type OrderFlowState =
  | { open: false }
  | { open: true; initialStep: 'choose_type' }
  | { open: true; initialStep: 'brand_checkout'; merchant: Merchant }
  | { open: true; initialStep: 'custom_details' };

const PROFILE_STORAGE_KEY = 'hatly_customer_profile_v1';

const STATUS_ARABIC_TITLES: Record<OrderStatus, { title: string; body: string }> = {
  new: {
    title: 'تم استلام طلبك',
    body: 'جاري البحث عن أقرب مندوب لتنفيذ الطلب.',
  },
  assigned: {
    title: 'تم تعيين مندوب لطلبك',
    body: 'المندوب استلم تفاصيل الطلب وهو في طريقه للاستلام.',
  },
  picked_up: {
    title: 'طلبك في الطريق إليك',
    body: 'المندوب استلم الطلب ويتحرك نحو موقعك الآن.',
  },
  delivered: {
    title: 'تم توصيل طلبك بنجاح',
    body: 'شكراً لاستخدامك هاتلي! نتمنى لك تجربة رائعة.',
  },
  cancelled: {
    title: 'تم إلغاء الطلب',
    body: 'تم تحديث حالة الطلب إلى ملغي.',
  },
};

export default function App() {
  const [profile, setProfile] = useState<CustomerProfile | null>(() => {
    try {
      const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (!saved) return null;
      const parsed = JSON.parse(saved) as CustomerProfile;
      if (parsed.is_guest || !parsed.id || parsed.id.startsWith('guest-')) {
        localStorage.removeItem(PROFILE_STORAGE_KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  });

  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [merchantsAreLive, setMerchantsAreLive] = useState(false);
  const [isRefreshingMerchants, setIsRefreshingMerchants] = useState(false);
  const discoveryReqSeqRef = useRef(0);

  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [orderFlow, setOrderFlow] = useState<OrderFlowState>({ open: false });
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [isRefreshingOrders, setIsRefreshingOrders] = useState(false);
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [merchantErrorBanner, setMerchantErrorBanner] = useState<string | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([]);
  const [addressesLoaded, setAddressesLoaded] = useState(false);

  // Global Floating Ad & Inline Ads state
  const [globalAd, setGlobalAd] = useState<Advertisement | null>(null);
  const [globalAdDismissed, setGlobalAdDismissed] = useState(false);

  // Live Order Notifications state
  const [notifications, setNotifications] = useState<LiveNotificationItem[]>([]);
  const [activeToast, setActiveToast] = useState<LiveNotificationItem | null>(null);
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => isNotificationSoundEnabled());
  const [soundAutoplayBlocked, setSoundAutoplayBlocked] = useState(false);
  const [browserNotifPermission, setBrowserNotifPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() =>
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported'
  );
  const seenStatusEventsRef = useRef<Set<string>>(new Set());

  const triggerNotificationAudio = useCallback(() => {
    playNotificationSound().then(({ blocked }) => {
      if (blocked) {
        setSoundAutoplayBlocked(true);
      } else {
        setSoundAutoplayBlocked(false);
      }
    });
  }, []);

  const handleEnableSound = useCallback(async () => {
    setSoundEnabled(true);
    const played = await enableAndTestNotificationSound();
    if (played) {
      setSoundAutoplayBlocked(false);
    }
  }, []);

  const handleToggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      setNotificationSoundEnabled(next);
      if (next) {
        enableAndTestNotificationSound().then((played) => {
          if (played) setSoundAutoplayBlocked(false);
        });
      } else {
        setSoundAutoplayBlocked(false);
      }
      return next;
    });
  }, []);

  const pushLiveNotification = useCallback(
    (orderId: string, orderNumber: string, status: OrderStatus) => {
      const dedupeKey = `${orderId}:${status}`;
      if (seenStatusEventsRef.current.has(dedupeKey)) return;
      seenStatusEventsRef.current.add(dedupeKey);

      const copy = STATUS_ARABIC_TITLES[status] ?? STATUS_ARABIC_TITLES.new;
      const item: LiveNotificationItem = {
        id: `${dedupeKey}-${Date.now()}`,
        orderId,
        orderNumber,
        status,
        title: `${copy.title} (${orderNumber})`,
        body: copy.body,
        timestamp: new Date().toISOString(),
        read: false,
      };

      setNotifications((prev) => [item, ...prev].slice(0, 25));
      setActiveToast(item);

      if (status !== 'new') {
        triggerNotificationAudio();
      }

      window.setTimeout(() => {
        setActiveToast((curr) => (curr?.id === item.id ? null : curr));
      }, 6000);

      if (
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        try {
          new Notification(item.title, {
            body: item.body,
            icon: '/pwa-192x192.png',
          });
        } catch {
          // ignore notification constructor errors on mobile browsers
        }
      }
    },
    [triggerNotificationAudio]
  );

  const loadDiscoveryData = useCallback(async () => {
    const reqId = ++discoveryReqSeqRef.current;
    setIsRefreshingMerchants(true);

    try {
      const loadedZones = await fetchActiveZones();
      if (reqId !== discoveryReqSeqRef.current) return loadedZones;

      setZones(loadedZones);
      if (loadedZones.length > 0) {
        setSelectedZoneId((prev) =>
          prev && loadedZones.some((z) => z.id === prev) ? prev : loadedZones[0].id
        );
      }

      const merchantRes = await fetchActiveMerchants(loadedZones);
      if (reqId !== discoveryReqSeqRef.current) return loadedZones;

      setMerchants(merchantRes.merchants);
      setMerchantsAreLive(merchantRes.isLive);

      const loadedAds = await fetchActiveAdvertisements(merchantRes.merchants);
      if (reqId !== discoveryReqSeqRef.current) return loadedZones;

      setAds(loadedAds);
      if (loadedAds.length > 0) {
        setGlobalAd((prev) =>
          prev && loadedAds.some((a) => a.id === prev.id)
            ? loadedAds.find((a) => a.id === prev.id) ?? loadedAds[0]
            : loadedAds[Math.floor(Math.random() * loadedAds.length)]
        );
      } else {
        setGlobalAd(null);
      }

      return loadedZones;
    } finally {
      if (reqId === discoveryReqSeqRef.current) {
        setIsRefreshingMerchants(false);
      }
    }
  }, []);

  // Check Supabase Auth Session + load Discovery Data + Realtime sync for Merchants/Zones/Ads
  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      const loadedZones = await loadDiscoveryData();
      if (!mounted) return;

      const { data: sessionData } = await supabase.auth.getSession();
      let authUser = sessionData?.session?.user ?? null;
      if (!authUser) {
        const { data: userData } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
        authUser = userData?.user ?? null;
      }

      if (authUser && mounted) {
        try {
          const meta = (authUser.user_metadata ?? {}) as Record<string, unknown>;
          const fetchedProf = await fetchOrCreateCustomerProfile({
            userId: authUser.id,
            email: authUser.email || '',
            phone: String(meta.phone ?? '') || authUser.phone || '',
            fullName: meta.full_name ? String(meta.full_name) : undefined,
            zoneId:
              (meta.default_zone_id ? String(meta.default_zone_id) : null) ||
              loadedZones[0]?.id ||
              null,
          });
          if (mounted) {
            setProfile(fetchedProf);
            localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(fetchedProf));
          }
        } catch (err) {
          console.error('[Hatly Auth] Bootstrap profile sync error:', err);
        }
      } else if (mounted) {
        // Prevent unauthenticated stale localStorage profile from sending anonymous RLS queries
        localStorage.removeItem(PROFILE_STORAGE_KEY);
        setProfile(null);
      }
    }

    bootstrap();

    const discoveryChannel = supabase
      .channel('hatly-discovery-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'merchants' }, (payload) => {
        if (payload.eventType === 'DELETE' && payload.old && 'id' in payload.old) {
          const deletedId = String(payload.old.id);
          setMerchants((prev) => prev.filter((m) => m.id !== deletedId));
        }
        loadDiscoveryData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'zones' }, () => {
        loadDiscoveryData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'advertisements' }, () => {
        loadDiscoveryData();
      })
      .subscribe();

    const handleWindowFocus = () => {
      loadDiscoveryData();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadDiscoveryData();
      }
    };
    const handlePageShow = () => {
      loadDiscoveryData();
    };

    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      mounted = false;
      supabase.removeChannel(discoveryChannel);
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [loadDiscoveryData]);

  const isHomeScreenVisible =
    Boolean(profile) &&
    addressesLoaded &&
    savedAddresses.length > 0 &&
    activeTab === 'home' &&
    !orderFlow.open &&
    !trackingOrderId &&
    !selectedMerchant;

  // Always fetch fresh merchants & discovery data on every Home Screen load
  useEffect(() => {
    if (!isHomeScreenVisible) return;
    loadDiscoveryData();
  }, [isHomeScreenVisible, loadDiscoveryData]);

  // Re-fetch zones, merchants & ads after user authenticates
  useEffect(() => {
    if (!profile?.id) return;
    loadDiscoveryData();
  }, [profile?.id, loadDiscoveryData]);

  // Rotate Global Ad dynamically on screen navigation
  useEffect(() => {
    if (ads.length === 0) return;
    fetchRandomActiveAd(merchants, globalAd?.id).then((picked) => {
      if (picked) setGlobalAd(picked);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, orderFlow.open, trackingOrderId, selectedMerchant?.id]);

  // Rotate Global Ad every 15 seconds
  useEffect(() => {
    if (ads.length <= 1 || globalAdDismissed) return;
    const interval = window.setInterval(() => {
      fetchRandomActiveAd(merchants, globalAd?.id).then((picked) => {
        if (picked) setGlobalAd(picked);
      });
    }, 15000);
    return () => window.clearInterval(interval);
  }, [ads.length, globalAdDismissed, merchants, globalAd?.id]);

  // Fetch customer addresses whenever profile changes
  useEffect(() => {
    if (!profile) {
      setSavedAddresses([]);
      setAddressesLoaded(false);
      return;
    }

    let cancelled = false;
    setAddressesLoaded(false);
    fetchCustomerAddresses(profile.id).then((list) => {
      if (!cancelled) {
        setSavedAddresses(list);
        setAddressesLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  const syncCustomerOrders = useCallback(
    async (notifyOnChanges = false) => {
      if (!profile) return;
      setIsRefreshingOrders(true);
      try {
        const { orders: loaded, error } = await fetchOrdersForCustomer(
          profile.id,
          profile.customer_record_id,
          profile.is_guest,
          zones,
          merchants,
          profile.phone
        );
        setOrdersError(error);
        if (error && loaded.length === 0) {
          return;
        }
        setOrders((prev) => {
          const prevMap = new Map(prev.map((o) => [o.id, o]));
          const merged = loaded.map((nextOrder) => {
            const existing = prevMap.get(nextOrder.id);
            if (notifyOnChanges && existing && existing.status !== nextOrder.status) {
              pushLiveNotification(
                nextOrder.id,
                nextOrder.order_number || nextOrder.id.slice(0, 8),
                nextOrder.status
              );
            } else {
              seenStatusEventsRef.current.add(`${nextOrder.id}:${nextOrder.status}`);
            }
            return {
              ...nextOrder,
              courier:
                existing?.courier && existing.courier.id === nextOrder.courier_id
                  ? existing.courier
                  : nextOrder.courier,
            };
          });
          return merged;
        });
      } finally {
        setIsRefreshingOrders(false);
      }
    },
    [profile, zones, merchants, pushLiveNotification]
  );

  // Fetch customer orders whenever profile, zones, or merchants load
  useEffect(() => {
    if (!profile) return;
    syncCustomerOrders(false);
  }, [profile, zones, merchants, syncCustomerOrders]);

  // Always fetch fresh orders whenever user navigates to the "طلباتي" tab
  useEffect(() => {
    if (!profile || activeTab !== 'orders') return;
    syncCustomerOrders(false);
  }, [profile, activeTab, syncCustomerOrders]);

  // Real-Time WebSocket Subscription + Safety-Net Sync for Live Order Status & Courier Assignment
  useEffect(() => {
    if (!profile) return;

    const customerPhoneVariants = new Set(buildPhoneVariants(profile.phone));

    const belongsToCustomer = (row: Record<string, unknown>) => {
      const cid = row.customer_id ? String(row.customer_id) : '';
      if (
        cid &&
        (cid === profile.id || (Boolean(profile.customer_record_id) && cid === profile.customer_record_id))
      ) {
        return true;
      }
      const rowPhone = row.customer_phone ? String(row.customer_phone) : '';
      if (rowPhone && customerPhoneVariants.size > 0) {
        return buildPhoneVariants(rowPhone).some((v) => customerPhoneVariants.has(v));
      }
      return false;
    };

    const channel = supabase
      .channel(`hatly-live-orders-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          const insertedRow = payload.new as Record<string, unknown>;
          if (!belongsToCustomer(insertedRow)) return;

          const zoneMap = new Map(zones.map((z) => [z.id, z.name]));
          const merchantMap = new Map(merchants.map((m) => [m.id, m.name]));
          const mapped = mapRemoteOrderRow(insertedRow, zoneMap, merchantMap);

          setOrders((prev) => {
            if (prev.some((o) => o.id === mapped.id)) return prev;
            return [mapped, ...prev];
          });

          pushLiveNotification(
            mapped.id,
            mapped.order_number || mapped.id.slice(0, 8),
            mapped.status
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          const updatedRow = payload.new as Record<string, unknown>;
          const orderId = String(updatedRow.id);
          const nextStatus = updatedRow.status as OrderStatus;
          const nextCourierId = updatedRow.courier_id ? String(updatedRow.courier_id) : null;
          const nextTotal =
            updatedRow.total !== undefined && updatedRow.total !== null
              ? Number(updatedRow.total)
              : undefined;
          const nextProductsTotal =
            updatedRow.products_total !== undefined && updatedRow.products_total !== null
              ? Number(updatedRow.products_total)
              : undefined;

          setOrders((prev) => {
            const exists = prev.some((o) => o.id === orderId);
            if (!exists && !belongsToCustomer(updatedRow)) {
              return prev;
            }

            if (!exists) {
              const zoneMap = new Map(zones.map((z) => [z.id, z.name]));
              const merchantMap = new Map(merchants.map((m) => [m.id, m.name]));
              const mapped = mapRemoteOrderRow(updatedRow, zoneMap, merchantMap);
              pushLiveNotification(
                mapped.id,
                mapped.order_number || mapped.id.slice(0, 8),
                mapped.status
              );
              return [mapped, ...prev];
            }

            const nextList = prev.map((o) => {
              if (o.id !== orderId) return o;
              const updatedProductsTotal = nextProductsTotal ?? o.products_total;
              const updatedTotal = nextTotal ?? o.total_fee;
              const updatedDeliveryFee =
                nextTotal !== undefined
                  ? Math.max(0, Math.round((updatedTotal - updatedProductsTotal - (o.custom_fee || 0)) * 100) / 100)
                  : o.delivery_fee;

              const nextOrder: OrderRecord = {
                ...o,
                status: nextStatus,
                courier_id: nextCourierId ?? o.courier_id,
                products_total: updatedProductsTotal,
                total_fee: updatedTotal,
                delivery_fee: updatedDeliveryFee,
              };
              saveLocalOrder(nextOrder);
              return nextOrder;
            });

            const target = nextList.find((o) => o.id === orderId);
            if (target) {
              pushLiveNotification(
                target.id,
                target.order_number || target.id.slice(0, 8),
                nextStatus
              );
            }
            return nextList;
          });

          if (nextCourierId) {
            fetchCourierById(nextCourierId).then((fetchedCourier) => {
              if (!fetchedCourier) return;
              setOrders((prev) =>
                prev.map((o) => (o.id === orderId ? { ...o, courier: fetchedCourier } : o))
              );
            });
          }
        }
      )
      .subscribe();

    const syncInterval = window.setInterval(() => {
      syncCustomerOrders(true);
    }, 12000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncCustomerOrders(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(syncInterval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [profile, zones, merchants, pushLiveNotification, syncCustomerOrders]);

  // Real-Time Subscription to `notifications` table + audio alert playback
  useEffect(() => {
    if (!profile?.id || profile.is_guest) return;

    let cancelled = false;

    fetchUserNotifications(profile.id).then((rows) => {
      if (cancelled || rows.length === 0) return;
      setNotifications((prev) => {
        const existingIds = new Set(prev.map((n) => n.id));
        const mapped: LiveNotificationItem[] = rows
          .filter((r) => !existingIds.has(r.id))
          .map((r) => ({
            id: r.id,
            title: r.title,
            body: r.message,
            timestamp: r.created_at,
            read: r.is_read,
          }));
        return [...mapped, ...prev].slice(0, 30);
      });
    });

    const notifChannel = supabase
      .channel(`hatly-notifications-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (!row?.id) return;
          if (row.user_id && String(row.user_id) !== profile.id) return;

          const newItem: LiveNotificationItem = {
            id: String(row.id),
            orderId: row.order_id ? String(row.order_id) : null,
            orderNumber: row.order_number ? String(row.order_number) : null,
            status: (row.status as OrderStatus | undefined) ?? null,
            title: String(row.title ?? 'تحديث جديد من هاتلي'),
            body: String(row.message ?? ''),
            timestamp: row.created_at ? String(row.created_at) : new Date().toISOString(),
            read: Boolean(row.is_read),
          };

          setNotifications((prev) => {
            if (prev.some((n) => n.id === newItem.id)) return prev;
            return [newItem, ...prev].slice(0, 30);
          });

          setActiveToast(newItem);
          window.setTimeout(() => {
            setActiveToast((curr) => (curr?.id === newItem.id ? null : curr));
          }, 6000);

          // Play HTML5 Audio alert on every NEW Realtime notification
          triggerNotificationAudio();

          if (
            typeof window !== 'undefined' &&
            'Notification' in window &&
            Notification.permission === 'granted'
          ) {
            try {
              new Notification(newItem.title, {
                body: newItem.body,
                icon: '/pwa-192x192.png',
              });
            } catch {
              // ignore mobile notification constructor errors
            }
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(notifChannel);
    };
  }, [profile?.id, profile?.is_guest, triggerNotificationAudio]);

  const handleAuthenticated = (nextProfile: CustomerProfile) => {
    setProfile(nextProfile);
    setActiveTab('home');
    setOrderFlow({ open: false });
    setTrackingOrderId(null);
    setSelectedMerchant(null);
    if (nextProfile.zone_id) {
      setSelectedZoneId(nextProfile.zone_id);
    }
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(nextProfile));
    } catch {
      // ignore
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut().catch(() => {});
    localStorage.removeItem(PROFILE_STORAGE_KEY);
    setProfile(null);
    setSavedAddresses([]);
    setAddressesLoaded(false);
    setOrderFlow({ open: false });
    setTrackingOrderId(null);
    setSelectedMerchant(null);
    setActiveTab('home');
  };

  const handleRequestBrowserNotifications = async () => {
    if (!('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    setBrowserNotifPermission(perm);
  };

  const handleOrderCreated = (created: OrderRecord) => {
    setOrders((prev) => [created, ...prev.filter((o) => o.id !== created.id)]);
    pushLiveNotification(
      created.id,
      created.order_number || created.id.slice(0, 8),
      created.status
    );
  };

  const handleOrderStatusUpdated = useCallback(
    (orderId: string, nextStatus: OrderStatus, courier?: Courier | null) => {
      updateLocalOrder(orderId, {
        status: nextStatus,
        ...(courier ? { courier, courier_id: courier.id } : {}),
      });

      setOrders((prev) => {
        const nextList = prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                status: nextStatus,
                ...(courier ? { courier, courier_id: courier.id } : {}),
              }
            : o
        );
        const target = nextList.find((o) => o.id === orderId);
        if (target) {
          pushLiveNotification(
            target.id,
            target.order_number || target.id.slice(0, 8),
            nextStatus
          );
        }
        return nextList;
      });
    },
    [pushLiveNotification]
  );

  const openMerchantDetails = async (merchant: Merchant) => {
    setMerchantErrorBanner(null);
    const check = await verifyMerchantAvailability(merchant.id);
    if (!check.available) {
      setSelectedMerchant(null);
      setOrderFlow({ open: false });
      setMerchantErrorBanner(
        check.error || 'عذراً، هذا المتجر غير متاح حالياً لاستقبال الطلبات.'
      );
      loadDiscoveryData();
      return;
    }

    setOrderFlow({ open: false });
    setTrackingOrderId(null);
    setSelectedMerchant(merchant);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectAd = (ad: Advertisement) => {
    if (ad.merchant_id) {
      const matched = merchants.find((m) => m.id === ad.merchant_id);
      if (matched) {
        openMerchantDetails(matched);
        return;
      }
    }
    setOrderFlow({ open: false });
    setTrackingOrderId(null);
    setSelectedMerchant(null);
    setActiveTab('ads');
  };

  const goHome = () => {
    setOrderFlow({ open: false });
    setTrackingOrderId(null);
    setSelectedMerchant(null);
    setActiveTab('home');
  };

  const unreadNotifCount = notifications.filter((n) => !n.read).length;
  const activeOrdersCount = orders.filter(
    (o) => o.status !== 'delivered' && o.status !== 'cancelled'
  ).length;

  const trackedOrder = trackingOrderId
    ? orders.find((o) => o.id === trackingOrderId) ?? null
    : null;

  if (!profile) {
    return <SplashAuthScreen zones={zones} onAuthenticated={handleAuthenticated} />;
  }

  if (!addressesLoaded) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0A192F] text-white px-6 text-center">
        <img
          src="/src/assets/images/hatly_official_logo_1794860801844.jpg"
          alt="شعار هاتلي"
          referrerPolicy="no-referrer"
          className="h-20 w-20 rounded-2xl bg-white object-contain p-1 shadow-xl"
        />
        <p className="mt-4 text-sm font-bold text-slate-200">جاري تجهيز حسابك ومواقعك المحفوظة...</p>
      </div>
    );
  }

  if (savedAddresses.length === 0) {
    return (
      <ForcedLocationSetup
        profile={profile}
        zones={zones}
        onAddressSaved={(nextAddresses) => setSavedAddresses(nextAddresses)}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div
      className={`min-h-screen bg-[#F6F8FB] text-[#0A192F] ${
        globalAd && !globalAdDismissed ? 'pb-36 md:pb-24' : 'pb-20 md:pb-8'
      }`}
    >
      <OfflineIndicator />

      {/* Top App Bar (Clean 3-zone header) */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          {/* Zone 1: Brand Wordmark + Official Logo */}
          <button
            type="button"
            onClick={goHome}
            className="flex items-center gap-2 text-right whitespace-nowrap shrink-0"
          >
            <img
              src="/src/assets/images/hatly_official_logo_1794860801844.jpg"
              alt="شعار هاتلي"
              referrerPolicy="no-referrer"
              className="h-10 w-10 rounded-xl border border-slate-100 bg-white object-contain"
            />
            <span className="text-lg font-extrabold tracking-tight text-[#0A192F]">هاتلي</span>
          </button>

          {/* Zone 2: Desktop Single-Line Navigation (3 primary links matching Bottom Nav) */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-bold text-slate-600">
            <button
              type="button"
              onClick={goHome}
              className={`whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'home' && !orderFlow.open && !trackedOrder && !selectedMerchant
                  ? 'text-[#FF7B00]'
                  : 'hover:text-[#0A192F]'
              }`}
            >
              الرئيسية
            </button>
            <button
              type="button"
              onClick={() => {
                setOrderFlow({ open: false });
                setTrackingOrderId(null);
                setSelectedMerchant(null);
                setActiveTab('orders');
              }}
              className={`whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'orders' || trackedOrder
                  ? 'text-[#FF7B00]'
                  : 'hover:text-[#0A192F]'
              }`}
            >
              طلباتي {activeOrdersCount > 0 ? `(${activeOrdersCount})` : ''}
            </button>
            <button
              type="button"
              onClick={() => {
                setOrderFlow({ open: false });
                setTrackingOrderId(null);
                setSelectedMerchant(null);
                setActiveTab('profile');
              }}
              className={`whitespace-nowrap shrink-0 transition-colors ${
                activeTab === 'profile' ? 'text-[#FF7B00]' : 'hover:text-[#0A192F]'
              }`}
            >
              حسابي
            </button>
          </nav>

          {/* Zone 3: Notification Bell + PWA Install */}
          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton variant="compact" />

            <button
              type="button"
              onClick={() => setNotifDrawerOpen(true)}
              aria-label="إشعارات الطلبات المباشرة"
              className="relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white text-[#0A192F] transition-colors hover:bg-slate-50"
            >
              <Bell className="h-5 w-5" />
              {unreadNotifCount > 0 && (
                <span className="tabular-nums absolute top-1.5 left-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#FF7B00] px-1 text-[10px] font-extrabold text-white">
                  {unreadNotifCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">
        {orderFlow.open ? (
          <CreateOrderFlow
            initialStep={orderFlow.initialStep}
            initialMerchant={orderFlow.initialStep === 'brand_checkout' ? orderFlow.merchant : null}
            merchants={merchants}
            zones={zones}
            profile={profile}
            savedAddresses={savedAddresses}
            onAddressesChange={setSavedAddresses}
            defaultZoneId={selectedZoneId}
            inlineAd={globalAd ?? ads[0] ?? null}
            onSelectAd={handleSelectAd}
            onRefreshMerchants={() => loadDiscoveryData()}
            isRefreshingMerchants={isRefreshingMerchants}
            onCancel={() => setOrderFlow({ open: false })}
            onOrderCreated={handleOrderCreated}
            onMerchantUnavailable={() => {
              setOrderFlow({ open: false });
              setSelectedMerchant(null);
              setMerchantErrorBanner('عذراً، هذا المتجر غير متاح حالياً لاستقبال الطلبات.');
              loadDiscoveryData();
            }}
            onTrackOrder={(ord) => {
              setOrderFlow({ open: false });
              setSelectedMerchant(null);
              setActiveTab('orders');
              setTrackingOrderId(ord.id);
            }}
          />
        ) : trackedOrder ? (
          <TrackOrderView
            order={trackedOrder}
            zones={zones}
            inlineAd={globalAd ?? ads[0] ?? null}
            onSelectAd={handleSelectAd}
            onBack={() => setTrackingOrderId(null)}
            onOrderStatusUpdated={handleOrderStatusUpdated}
          />
        ) : selectedMerchant ? (
          <MerchantDetailsView
            merchant={selectedMerchant}
            onBack={() => setSelectedMerchant(null)}
            onMerchantUnavailable={() => {
              loadDiscoveryData();
            }}
            onStartOrder={(merchant) => {
              setSelectedMerchant(null);
              setOrderFlow({ open: true, initialStep: 'brand_checkout', merchant });
            }}
          />
        ) : activeTab === 'home' ? (
          <HomeDiscovery
            profile={profile}
            zones={zones}
            selectedZoneId={selectedZoneId}
            onZoneChange={(zid) => setSelectedZoneId(zid)}
            ads={ads}
            merchants={merchants}
            merchantsAreLive={merchantsAreLive}
            orders={orders}
            merchantErrorBanner={merchantErrorBanner}
            onDismissMerchantError={() => setMerchantErrorBanner(null)}
            onRefreshMerchants={() => loadDiscoveryData()}
            isRefreshingMerchants={isRefreshingMerchants}
            onSelectAd={handleSelectAd}
            onOpenAdsPage={() => setActiveTab('ads')}
            onSelectMerchant={openMerchantDetails}
            onStartOrderFlow={() => setOrderFlow({ open: true, initialStep: 'choose_type' })}
            onStartCustomOrder={() => setOrderFlow({ open: true, initialStep: 'custom_details' })}
          />
        ) : activeTab === 'ads' ? (
          <AdsPage
            ads={ads}
            onBack={() => setActiveTab('home')}
            onSelectAd={handleSelectAd}
          />
        ) : activeTab === 'orders' ? (
          <OrdersListView
            orders={orders}
            error={ordersError}
            isRefreshing={isRefreshingOrders}
            onRefresh={() => syncCustomerOrders(false)}
            onSelectOrder={(ord) => setTrackingOrderId(ord.id)}
            onStartOrderFlow={() => setOrderFlow({ open: true, initialStep: 'choose_type' })}
          />
        ) : (
          <ProfileView
            profile={profile}
            zones={zones}
            addresses={savedAddresses}
            orders={orders}
            onAddressesChange={setSavedAddresses}
            browserNotifPermission={browserNotifPermission}
            onRequestBrowserPermission={handleRequestBrowserNotifications}
            onUpdateProfile={(updated) => {
              setProfile(updated);
              if (updated.zone_id) setSelectedZoneId(updated.zone_id);
              localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(updated));
            }}
            onLogout={handleLogout}
          />
        )}
      </main>

      {/* Global Floating Ad Banner (Appears across ALL screens) */}
      <GlobalAdBanner
        ad={globalAd}
        dismissed={globalAdDismissed}
        onDismiss={() => setGlobalAdDismissed(true)}
        onSelectAd={handleSelectAd}
      />

      {/* Mobile Bottom Navigation Bar (Strictly 3 items: الرئيسية, طلباتي, حسابي) */}
      <nav
        aria-label="التنقل الرئيسي"
        className="fixed right-0 bottom-0 left-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md pb-safe md:hidden"
      >
        <div className="grid h-16 grid-cols-3 items-center">
          <button
            type="button"
            onClick={goHome}
            className={`flex min-h-[48px] flex-col items-center justify-center gap-1 transition-colors ${
              activeTab === 'home' && !orderFlow.open && !trackedOrder && !selectedMerchant
                ? 'text-[#FF7B00]'
                : 'text-slate-500'
            }`}
          >
            <Home className="h-5 w-5" />
            <span className="text-[11px] font-bold">الرئيسية</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setOrderFlow({ open: false });
              setTrackingOrderId(null);
              setSelectedMerchant(null);
              setActiveTab('orders');
            }}
            className={`relative flex min-h-[48px] flex-col items-center justify-center gap-1 transition-colors ${
              activeTab === 'orders' || trackedOrder ? 'text-[#FF7B00]' : 'text-slate-500'
            }`}
          >
            <div className="relative">
              <ClipboardList className="h-5 w-5" />
              {activeOrdersCount > 0 && (
                <span className="tabular-nums absolute -top-1.5 -left-2.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#0A192F] px-1 text-[10px] font-bold text-white">
                  {activeOrdersCount}
                </span>
              )}
            </div>
            <span className="text-[11px] font-bold">طلباتي</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setOrderFlow({ open: false });
              setTrackingOrderId(null);
              setSelectedMerchant(null);
              setActiveTab('profile');
            }}
            className={`flex min-h-[48px] flex-col items-center justify-center gap-1 transition-colors ${
              activeTab === 'profile' ? 'text-[#FF7B00]' : 'text-slate-500'
            }`}
          >
            <UserRound className="h-5 w-5" />
            <span className="text-[11px] font-bold">حسابي</span>
          </button>
        </div>
      </nav>

      {/* Live Order Notifications Toast & Drawer */}
      <LiveOrderNotifications
        notifications={notifications}
        activeToast={activeToast}
        drawerOpen={notifDrawerOpen}
        browserNotifPermission={browserNotifPermission}
        soundEnabled={soundEnabled}
        soundAutoplayBlocked={soundAutoplayBlocked}
        onEnableSound={handleEnableSound}
        onToggleSound={handleToggleSound}
        onDismissAutoplayPrompt={() => setSoundAutoplayBlocked(false)}
        onRequestBrowserPermission={handleRequestBrowserNotifications}
        onDismissToast={() => setActiveToast(null)}
        onCloseDrawer={() => setNotifDrawerOpen(false)}
        onMarkAllRead={() => {
          setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
          if (profile?.id) {
            markAllNotificationsAsReadInDb(profile.id);
          }
        }}
        onSelectNotification={(item) => {
          setNotifications((prev) =>
            prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
          );
          markNotificationAsReadInDb(item.id);
          if (item.orderId) {
            setOrderFlow({ open: false });
            setSelectedMerchant(null);
            setActiveTab('orders');
            setTrackingOrderId(item.orderId);
          } else {
            setNotifDrawerOpen(true);
          }
        }}
      />
    </div>
  );
}
