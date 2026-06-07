import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut
} from 'firebase/auth';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import { getSupabaseClient } from '../supabase';
import { Product, Unit, Member, MemberCard, Sale, CartItem, SyncStatus, SaleItem, StoreSettings, AppUser } from '../types';
import { 
  generateInvoiceId, 
  generateUUID, 
  SEED_PRODUCTS, 
  SEED_MEMBERS, 
  SEED_UNITS 
} from '../utils/generators';

interface PosContextType {
  user: AppUser | null;
  authLoading: boolean;
  loginWithCredentials: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  
  products: Product[];
  units: Unit[];
  members: Member[];
  memberCards: MemberCard[];
  sales: Sale[];
  
  cart: CartItem[];
  cartMember: Member | null;
  syncStatus: SyncStatus;
  loading: boolean;
  error: string | null;
  
  settings: StoreSettings;
  updateSettings: (newSettings: StoreSettings) => Promise<void>;
  
  // Actions
  addProduct: (product: Omit<Product, 'id'>) => Promise<void>;
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  
  addUnit: (name: string) => Promise<void>;
  updateUnit: (id: string, name: string) => Promise<void>;
  deleteUnit: (id: string) => Promise<void>;
  
  addMember: (member: Omit<Member, 'id' | 'points' | 'createdAt'>) => Promise<void>;
  updateMember: (id: string, updates: Partial<Member>) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;
  
  generateMemberCards: (count: number) => Promise<void>;
  deleteMemberCard: (id: string) => Promise<void>;
  
  // Cart Actions
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  setCartMember: (member: Member | null) => void;
  clearCart: () => void;
  
  // Sale Actions
  checkout: (paymentMethod: 'Cash' | 'QR Code' | 'TrueMoney', cashReceived: number) => Promise<Required<Sale>>;
  triggerManualSync: () => Promise<void>;
  seedInitialData: () => Promise<void>;
}

const PosContext = createContext<PosContextType | undefined>(undefined);

export const usePos = () => {
  const context = useContext(PosContext);
  if (!context) throw new Error('usePos must be used within PosProvider');
  return context;
};

export const PosProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Core inventories (initialized from local storage for instant loads)
  const [products, setProducts] = useState<Product[]>(() => {
    const cached = localStorage.getItem('pos_products');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {}
    }
    return SEED_PRODUCTS;
  });
  const [units, setUnits] = useState<Unit[]>(() => {
    const cached = localStorage.getItem('pos_units');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {}
    }
    return SEED_UNITS;
  });
  const [members, setMembers] = useState<Member[]>(() => {
    const cached = localStorage.getItem('pos_members');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {}
    }
    return SEED_MEMBERS;
  });
  const [memberCards, setMemberCards] = useState<MemberCard[]>(() => {
    const cached = localStorage.getItem('pos_member_cards');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (e) {}
    }
    return [];
  });
  const [sales, setSales] = useState<Sale[]>(() => {
    const cached = localStorage.getItem('pos_sales');
    return cached ? JSON.parse(cached) : [];
  });

  const [settings, setSettings] = useState<StoreSettings>(() => {
    const defaultSupUrl = ((import.meta as any).env?.VITE_SUPABASE_URL as string) || '';
    const defaultSupAnon = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string) || '';
    const defaultProvider = (defaultSupUrl && defaultSupAnon) ? 'supabase' : 'firebase';

    const cached = localStorage.getItem('pos_settings');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object' && parsed.logo) {
          return {
            dbProvider: defaultProvider,
            supabaseUrl: defaultSupUrl,
            supabaseAnonKey: defaultSupAnon,
            ...parsed
          };
        }
      } catch (e) {}
    }
    return {
      logo: '🛍️',
      nameEng: 'Thai Store & POS',
      nameThai: 'ระบบบริหารหน้าร้าน คลังพัสดุและฐานสมาชิก',
      themeColor: 'purple',
      promptPayId: '0812345678',
      trueMoneyPhone: '0812345678',
      dbProvider: defaultProvider,
      supabaseUrl: defaultSupUrl,
      supabaseAnonKey: defaultSupAnon
    };
  });

  // Dynamic favicon generation with custom emoji or image URL support
  const updateFavicon = (logoBase64OrEmojiOrUrl: string) => {
    try {
      let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      
      const isEmoji = logoBase64OrEmojiOrUrl.length <= 10 && /\p{Emoji}/u.test(logoBase64OrEmojiOrUrl);
      if (isEmoji) {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#f3e8ff'; // pastel purple bg for emoji
          ctx.beginPath();
          ctx.roundRect(0, 0, 64, 64, 16);
          ctx.fill();
          
          ctx.font = '48px serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(logoBase64OrEmojiOrUrl, 32, 35);
          link.href = canvas.toDataURL();
        }
      } else {
        link.href = logoBase64OrEmojiOrUrl;
      }
    } catch (e) {
      console.warn("Favicon rendering skipped", e);
    }
  };

  useEffect(() => {
    localStorage.setItem('pos_settings', JSON.stringify(settings));
    if (settings.logo) {
      updateFavicon(settings.logo);
    }
  }, [settings]);

  // Offline-first Queues
  const [pendingWrites, setPendingWrites] = useState<{
    products: { [id: string]: Product | null }; // null means deleted
    members: { [id: string]: Member | null };
    units: { [id: string]: Unit | null };
    memberCards: { [id: string]: MemberCard | null };
    sales: Sale[];
  }>(() => {
    const cached = localStorage.getItem('pos_sync_queue');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        return {
          products: parsed.products || {},
          members: parsed.members || {},
          units: parsed.units || {},
          memberCards: parsed.memberCards || {},
          sales: parsed.sales || []
        };
      } catch (e) {}
    }
    return { products: {}, members: {}, units: {}, memberCards: {}, sales: [] };
  });

  // Cart State (UI specific)
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartMember, setCartMemberState] = useState<Member | null>(null);

  // Connection and Sync status state
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isConnected: navigator.onLine,
    pendingCount: 0,
    isSyncing: false,
    lastSyncedAt: localStorage.getItem('pos_last_synced') || undefined
  });

  // Save cached states to local storage whenever they change to ensure offline durability
  useEffect(() => {
    localStorage.setItem('pos_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('pos_units', JSON.stringify(units));
  }, [units]);

  useEffect(() => {
    localStorage.setItem('pos_members', JSON.stringify(members));
  }, [members]);

  useEffect(() => {
    localStorage.setItem('pos_member_cards', JSON.stringify(memberCards));
  }, [memberCards]);

  useEffect(() => {
    localStorage.setItem('pos_sales', JSON.stringify(sales));
  }, [sales]);

  useEffect(() => {
    localStorage.setItem('pos_sync_queue', JSON.stringify(pendingWrites));
    
    // Calculate total pending writes count
    const pProd = Object.keys(pendingWrites.products).length;
    const pMem = Object.keys(pendingWrites.members).length;
    const pUnit = Object.keys(pendingWrites.units).length;
    const pCards = Object.keys(pendingWrites.memberCards || {}).length;
    const pSales = pendingWrites.sales.length;
    
    setSyncStatus(prev => ({
      ...prev,
      pendingCount: pProd + pMem + pUnit + pCards + pSales
    }));
  }, [pendingWrites]);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setSyncStatus(prev => ({ ...prev, isConnected: true }));
    const handleOffline = () => setSyncStatus(prev => ({ ...prev, isConnected: false }));
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getRoleFromEmail = (email?: string | null): 'admin' | 'general' => {
    if (!email) return 'general';
    const cleanEmail = email.toLowerCase();
    if (cleanEmail.includes('admin')) return 'admin';
    return 'general';
  };

  // Monitor Auth Status
  useEffect(() => {
    const savedUserStr = localStorage.getItem('pos_current_user');
    if (savedUserStr) {
      try {
        const savedUser = JSON.parse(savedUserStr);
        setUser(savedUser);
        setAuthLoading(false);
        return;
      } catch (e) {
        console.warn("Could not load local session:", e);
      }
    }

    if (settings.dbProvider === 'supabase') {
      const sbClient = getSupabaseClient(settings.supabaseUrl, settings.supabaseAnonKey);
      if (!sbClient) {
        setUser(null);
        setAuthLoading(false);
        return;
      }

      sbClient.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          const u = session.user;
          const sessionUser: AppUser = {
            uid: u.id,
            email: u.email || '',
            displayName: u.user_metadata?.full_name || (u.email?.toLowerCase().includes('admin') ? 'ผู้ดูแลระบบ (Admin)' : 'พนักงานขาย (Staff)'),
            photoURL: u.user_metadata?.avatar_url || '',
            role: getRoleFromEmail(u.email)
          };
          setUser(sessionUser);
          localStorage.setItem('pos_current_user', JSON.stringify(sessionUser));
        } else {
          setUser(null);
        }
        setAuthLoading(false);
      });

      const { data: { subscription } } = sbClient.auth.onAuthStateChange((event, session) => {
        if (session?.user) {
          const u = session.user;
          const sessionUser: AppUser = {
            uid: u.id,
            email: u.email || '',
            displayName: u.user_metadata?.full_name || (u.email?.toLowerCase().includes('admin') ? 'ผู้ดูแลระบบ (Admin)' : 'พนักงานขาย (Staff)'),
            photoURL: u.user_metadata?.avatar_url || '',
            role: getRoleFromEmail(u.email)
          };
          setUser(sessionUser);
          localStorage.setItem('pos_current_user', JSON.stringify(sessionUser));
        } else {
          if (!localStorage.getItem('pos_current_user')) {
            setUser(null);
          }
        }
        setAuthLoading(false);
      });
      return () => subscription.unsubscribe();
    } else {
      const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser) {
          const sessionUser: AppUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || (firebaseUser.email?.toLowerCase().includes('admin') ? 'ผู้ดูแลระบบ (Admin)' : 'พนักงานขาย (Staff)'),
            photoURL: firebaseUser.photoURL || '',
            role: getRoleFromEmail(firebaseUser.email)
          };
          setUser(sessionUser);
          localStorage.setItem('pos_current_user', JSON.stringify(sessionUser));
        } else {
          if (!localStorage.getItem('pos_current_user')) {
            setUser(null);
          }
        }
        setAuthLoading(false);
      });
      return unsubscribe;
    }
  }, [settings.dbProvider, settings.supabaseUrl, settings.supabaseAnonKey]);

  // Sync / Fetch data dynamically from Firebase or Supabase if user is authenticated
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);

    if (settings.dbProvider === 'supabase') {
      const sbClient = getSupabaseClient(settings.supabaseUrl, settings.supabaseAnonKey);
      if (!sbClient) {
        setLoading(false);
        return;
      }

      // Load all Supabase tables and subscribe
      const loadAllSupabaseData = async () => {
        try {
          // Fetch products
          const { data: pData } = await sbClient.from('products').select('*');
          if (pData && pData.length > 0) {
            setProducts(pData.map(p => ({
              id: p.id,
              name: p.name,
              barcode: p.barcode || '',
              price: Number(p.price || 0),
              cost: Number(p.cost || 0),
              stock: Number(p.stock || 0),
              safetyStock: Number(p.safety_stock || p.safetyStock || 0),
              unit: p.unit,
              image: p.image || '',
              category: p.category || '',
              createdAt: p.created_at || p.createdAt,
              updatedAt: p.updated_at || p.updatedAt
            })));
          }

          // Fetch units
          const { data: uData } = await sbClient.from('units').select('*');
          if (uData && uData.length > 0) {
            setUnits(uData.map(u => ({
              id: u.id,
              name: u.name,
              createdAt: u.created_at || u.createdAt
            })));
          }

          // Fetch members
          const { data: mData } = await sbClient.from('members').select('*');
          if (mData && mData.length > 0) {
            setMembers(mData.map(m => ({
              id: m.id,
              name: m.name,
              phone: m.phone || '',
              points: Number(m.points || 0),
              createdAt: m.created_at || m.createdAt,
              updatedAt: m.updated_at || m.updatedAt || '',
              memberCode: m.member_code || m.memberCode || '',
              birthday: m.birthday || ''
            })));
          }

          // Fetch member cards
          const { data: mcData } = await sbClient.from('member_cards').select('*');
          if (mcData && mcData.length > 0) {
            setMemberCards(mcData.map(c => ({
              id: c.id,
              code: c.code,
              status: c.status,
              assignedToMemberId: c.assigned_to_member_id || c.assignedToMemberId || '',
              assignedToMemberName: c.assigned_to_member_name || c.assignedToMemberName || '',
              createdAt: c.created_at || c.createdAt
            })));
          }

          // Fetch sales and sale items
          const { data: sData } = await sbClient.from('sales').select('*, sale_items(*)');
          if (sData) {
            const salesList: Sale[] = sData.map(s => ({
              id: s.id,
              invoiceId: s.invoice_id || s.invoiceId,
              date: s.date,
              timestamp: s.timestamp,
              totalAmount: Number(s.total_amount || s.totalAmount || 0),
              cashReceived: Number(s.cash_received || s.cashReceived || 0),
              change: Number(s.change || 0),
              paymentMethod: s.payment_method || s.paymentMethod || 'Cash',
              pointsEarned: Number(s.points_earned || s.pointsEarned || 0),
              memberId: s.member_id || s.memberId || '',
              memberName: s.member_name || s.memberName || '',
              items: (s.sale_items || []).map((si: any) => ({
                productId: si.product_id || si.productId,
                productName: si.product_name || si.productName,
                price: Number(si.price || 0),
                cost: Number(si.cost || 0),
                quantity: Number(si.quantity || 0),
                unit: si.unit,
                total: Number(si.total || 0)
              })),
              synced: true
            }));
            salesList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setSales(salesList);
          }

          // Fetch settings
          const { data: setRow } = await sbClient.from('store_settings').select('*').limit(1).maybeSingle();
          if (setRow) {
            setSettings(prev => ({
              ...prev,
              logo: setRow.logo || prev.logo,
              nameEng: setRow.name_eng || setRow.nameEng || prev.nameEng,
              nameThai: setRow.name_thai || setRow.nameThai || prev.nameThai,
              themeColor: setRow.theme_color || setRow.themeColor || prev.themeColor,
              promptPayId: setRow.promptpay_id || setRow.promptPayId || prev.promptPayId,
              trueMoneyPhone: setRow.truemoney_phone || setRow.trueMoneyPhone || prev.trueMoneyPhone
            }));
          }
        } catch (err) {
          console.error("Supabase load tables error:", err);
        } finally {
          setLoading(false);
        }
      };

      loadAllSupabaseData();

      const channel = sbClient
        .channel('supabase-channel-live')
        .on('postgres_changes', { event: '*', schema: 'public' }, () => {
          loadAllSupabaseData();
        })
        .subscribe();

      return () => {
        sbClient.removeChannel(channel);
      };
    } else {
      let unsubProducts = () => {};
      let unsubUnits = () => {};
      let unsubMembers = () => {};
      let unsubMemberCards = () => {};
      let unsubSales = () => {};
      let unsubSettings = () => {};

      try {
        unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
          const prodList: Product[] = [];
          snapshot.forEach((doc) => {
            prodList.push({ id: doc.id, ...doc.data() } as Product);
          });
          if (prodList.length > 0) {
            setProducts(prodList);
          }
        }, (err) => {
          handleFirestoreError(err, OperationType.GET, 'products');
        });

        unsubUnits = onSnapshot(collection(db, 'units'), (snapshot) => {
          const unitList: Unit[] = [];
          snapshot.forEach((doc) => {
            unitList.push({ id: doc.id, ...doc.data() } as Unit);
          });
          if (unitList.length > 0) {
            setUnits(unitList);
          }
        }, (err) => {
          handleFirestoreError(err, OperationType.GET, 'units');
        });

        unsubMembers = onSnapshot(collection(db, 'members'), (snapshot) => {
          const memberList: Member[] = [];
          snapshot.forEach((doc) => {
            memberList.push({ id: doc.id, ...doc.data() } as Member);
          });
          if (memberList.length > 0) {
            setMembers(memberList);
          }
        }, (err) => {
          handleFirestoreError(err, OperationType.GET, 'members');
        });

        unsubMemberCards = onSnapshot(collection(db, 'memberCards'), (snapshot) => {
          const cardList: MemberCard[] = [];
          snapshot.forEach((doc) => {
            cardList.push({ id: doc.id, ...doc.data() } as MemberCard);
          });
          if (cardList.length > 0) {
            setMemberCards(cardList);
          }
        }, (err) => {
          handleFirestoreError(err, OperationType.GET, 'memberCards');
        });

        unsubSales = onSnapshot(collection(db, 'sales'), (snapshot) => {
          const salesList: Sale[] = [];
          snapshot.forEach((doc) => {
            salesList.push({ id: doc.id, ...doc.data() } as Sale);
          });
          salesList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setSales(salesList);
          setLoading(false);
        }, (err) => {
          handleFirestoreError(err, OperationType.GET, 'sales');
        });

        unsubSettings = onSnapshot(doc(db, 'settings', 'store_config'), (snapshot) => {
          if (snapshot.exists()) {
            const cloudSettings = snapshot.data() as StoreSettings;
            setSettings(cloudSettings);
          }
        }, (err) => {
          console.warn("Settings fetch warning:", err);
        });

      } catch (err) {
        console.error("Subscription Error: ", err);
        setError("เกิดข้อผิดพลาดในการโหลดข้อมูลจากเซิร์ฟเวอร์");
        setLoading(false);
      }

      return () => {
        unsubProducts();
        unsubUnits();
        unsubMembers();
        unsubMemberCards();
        unsubSales();
        unsubSettings();
      };
    }
  }, [user, settings.dbProvider, settings.supabaseUrl, settings.supabaseAnonKey]);

  const updateSettings = async (newSettings: StoreSettings) => {
    setSettings(newSettings);
    if (user && syncStatus.isConnected) {
      if (newSettings.dbProvider === 'supabase') {
        const sbClient = getSupabaseClient(newSettings.supabaseUrl, newSettings.supabaseAnonKey);
        if (sbClient) {
          try {
            await sbClient.from('store_settings').upsert({
              id: 'settings_main',
              logo: newSettings.logo,
              name_eng: newSettings.nameEng,
              name_thai: newSettings.nameThai,
              theme_color: newSettings.themeColor,
              promptpay_id: newSettings.promptPayId || '',
              truemoney_phone: newSettings.trueMoneyPhone || ''
            });
          } catch (err) {
            console.warn("Supabase settings update warning:", err);
          }
        }
      } else {
        try {
          await setDoc(doc(db, 'settings', 'store_config'), newSettings);
        } catch (err) {
          console.warn("Firebase settings update warning:", err);
          handleFirestoreError(err, OperationType.WRITE, 'settings/store_config');
        }
      }
    }
  };

  // Handle automatic syncing when network comes back online
  useEffect(() => {
    if (syncStatus.isConnected && user && syncStatus.pendingCount > 0 && !syncStatus.isSyncing) {
      const timer = setTimeout(() => {
        triggerManualSync();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [syncStatus.isConnected, user, syncStatus.pendingCount]);

  // Auth operators
  const loginWithCredentials = async (usernameInput: string, passwordInput: string) => {
    try {
      setAuthLoading(true);
      setError(null);

      const trimmedUser = usernameInput.trim().toLowerCase();
      const trimmedPass = passwordInput.trim();

      if (!trimmedUser || !trimmedPass) {
        throw new Error("กรุณาระบุชื่อผู้ใช้งานและรหัสผ่าน");
      }

      // Format clean deterministic emails
      let email = '';
      if (trimmedUser === 'admin') {
        email = 'admin@pos.com';
      } else if (trimmedUser === 'staff' || trimmedUser === 'cashier') {
        email = 'staff@pos.com';
      } else if (trimmedUser.includes('@')) {
        email = trimmedUser;
      } else {
        email = `${trimmedUser}@pos.com`;
      }

      const isDefaultAdmin = trimmedUser === 'admin' && trimmedPass === 'admin1234';
      const isDefaultStaff = (trimmedUser === 'staff' || trimmedUser === 'cashier') && trimmedPass === 'staff1234';

      if (trimmedUser === 'admin' && trimmedPass !== 'admin1234') {
        throw new Error("รหัสผ่านสำหรับสิทธิ์ผู้ดูแลระบบ (Admin) ไม่ถูกต้อง (รหัสผ่านคือ admin1234)");
      }
      if ((trimmedUser === 'staff' || trimmedUser === 'cashier') && trimmedPass !== 'staff1234') {
        throw new Error("รหัสผ่านสำหรับสิทธิ์พนักงานทั่วไป (Staff) ไม่ถูกต้อง (รหัสผ่านคือ staff1234)");
      }

      if (!isDefaultAdmin && !isDefaultStaff) {
        throw new Error("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (กรุณาใช้บัญชี admin หรือ staff)");
      }

      if (settings.dbProvider === 'supabase') {
        const sbClient = getSupabaseClient(settings.supabaseUrl, settings.supabaseAnonKey);
        if (sbClient) {
          // Query the custom 'users' table in Supabase
          const { data: dbUser, error: dbError } = await sbClient
            .from('users')
            .select('*')
            .eq('username', trimmedUser)
            .maybeSingle();

          if (dbError) {
            console.error("Supabase custom users table query error:", dbError);
            if (dbError.message.includes("relation") && dbError.message.includes("does not exist")) {
              throw new Error("ตาราง 'users' ยังไม่มีอยู่ใน Supabase ของคุณ! กรุณาเปิด SQL Editor ในแดชบอร์ด Supabase ของคุณ เพื่อรันคำสั่งสร้างตาราง users และเพิ่มสิทธิ์ข้อมูลก่อนเริ่มล็อกอินค่ะ (ความผิดพลาด: relation users does not exist)");
            }
            throw new Error(`เกิดข้อผิดพลาดในการดึงข้อมูลจากตาราง users ของ Supabase: ${dbError.message}`);
          }

          if (!dbUser) {
            throw new Error(`ไม่พบชื่อผู้ใช้งาน "${trimmedUser}" ในฐานข้อมูลตาราง users บน Supabase`);
          }

          if (dbUser.password !== trimmedPass) {
            throw new Error("รหัสผ่านไม่ถูกต้อง กรุณาป้อนใหม่อีกครั้ง");
          }

          const sessionUser: AppUser = {
            uid: dbUser.id || `sb-${dbUser.username}`,
            email,
            displayName: dbUser.display_name || (dbUser.role === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'พนักงานขาย (Staff)'),
            photoURL: '',
            role: dbUser.role === 'admin' ? 'admin' : 'general',
          };

          setUser(sessionUser);
          localStorage.setItem('pos_current_user', JSON.stringify(sessionUser));
        } else {
          // Supabase credentials not set, fallback to offline UI
          const sessionUser: AppUser = {
            uid: trimmedUser === 'admin' ? 'uid-admin-offline-sb' : 'uid-staff-offline-sb',
            email,
            displayName: trimmedUser === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'พนักงานขาย (Staff)',
            photoURL: '',
            role: trimmedUser === 'admin' ? 'admin' : 'general',
          };
          setUser(sessionUser);
          localStorage.setItem('pos_current_user', JSON.stringify(sessionUser));
        }
      } else {
        // Firebase Cloud configuration
        const { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth');
        try {
          const res = await signInWithEmailAndPassword(auth, email, trimmedPass);
          const sessionUser: AppUser = {
            uid: res.user.uid,
            email: res.user.email || email,
            displayName: trimmedUser === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'พนักงานขาย (Staff)',
            photoURL: '',
            role: trimmedUser === 'admin' ? 'admin' : 'general',
          };
          setUser(sessionUser);
          localStorage.setItem('pos_current_user', JSON.stringify(sessionUser));
        } catch (fbErr: any) {
          // If user doesn't exist, auto create
          const isUserNotFound = fbErr?.code === 'auth/user-not-found' || 
                                 fbErr?.message?.includes('user-not-found') || 
                                 fbErr?.code === 'auth/invalid-credential';
                                 
          if (isUserNotFound) {
            try {
              const res = await createUserWithEmailAndPassword(auth, email, trimmedPass);
              await updateProfile(res.user, {
                displayName: trimmedUser === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'พนักงานขาย (Staff)'
              });
              
              const sessionUser: AppUser = {
                uid: res.user.uid,
                email: res.user.email || email,
                displayName: trimmedUser === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'พนักงานขาย (Staff)',
                photoURL: '',
                role: trimmedUser === 'admin' ? 'admin' : 'general',
              };
              setUser(sessionUser);
              localStorage.setItem('pos_current_user', JSON.stringify(sessionUser));
            } catch (regErr) {
              console.warn("Could not register on Firebase, fell back to offline mode for UI:", regErr);
              // Safe offline sandbox mock
              const sessionUser: AppUser = {
                uid: trimmedUser === 'admin' ? 'uid-admin-offline-fb' : 'uid-staff-offline-fb',
                email,
                displayName: trimmedUser === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'พนักงานขาย (Staff)',
                photoURL: '',
                role: trimmedUser === 'admin' ? 'admin' : 'general',
              };
              setUser(sessionUser);
              localStorage.setItem('pos_current_user', JSON.stringify(sessionUser));
            }
          } else {
            throw fbErr;
          }
        }
      }
    } catch (err: any) {
      console.error("Login failed:", err);
      const errMsg = err?.message || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง";
      setError(errMsg);
      throw err;
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = async () => {
    try {
      localStorage.removeItem('pos_current_user');
      if (settings.dbProvider === 'supabase') {
        const sbClient = getSupabaseClient(settings.supabaseUrl, settings.supabaseAnonKey);
        if (sbClient) {
          await sbClient.auth.signOut();
        }
      } else {
        await signOut(auth);
      }
      // Empty local operational cart
      setCart([]);
      setCartMemberState(null);
      // Reset products, units, and members to default seed items on logout so offline works beautiful immediately
      setProducts(SEED_PRODUCTS);
      setUnits(SEED_UNITS);
      setMembers(SEED_MEMBERS);
      setUser(null);
    } catch (err) {
      console.error("Logout fail:", err);
    }
  };

  // Seeder to populate the DB with Thai-tailored goods if database collections are clean
  const seedInitialData = async () => {
    setLoading(true);
    try {
      if (user) {
        const batch = writeBatch(db);
        
        // Seed Units
        SEED_UNITS.forEach((u) => {
          const ref = doc(db, 'units', u.id);
          batch.set(ref, { id: u.id, name: u.name, createdAt: u.createdAt });
        });

        // Seed Products
        SEED_PRODUCTS.forEach((p) => {
          const ref = doc(db, 'products', p.id);
          batch.set(ref, p);
        });

        // Seed Members
        SEED_MEMBERS.forEach((m) => {
          const ref = doc(db, 'members', m.id);
          batch.set(ref, m);
        });

        await batch.commit();
      }
      
      // Update local states instantly
      setUnits(SEED_UNITS);
      setProducts(SEED_PRODUCTS);
      setMembers(SEED_MEMBERS);
    } catch (err) {
      console.error("Seeding error:", err);
      setError("ไม่สามารถเตรียมข้อมูลเริ่มต้นได้");
    } finally {
      setLoading(false);
    }
  };

  // Helper to add edit deletes queue item
  const queueWrite = (type: 'products' | 'members' | 'units' | 'memberCards', id: string, data: any | null) => {
    setPendingWrites(prev => ({
      ...prev,
      [type]: {
        ...prev[type] as any,
        [id]: data
      }
    }));
  };

  // Helper to execute instant cloud writes to either Firebase or Supabase
  const executeImmediateWrite = async (
    collectionName: 'products' | 'units' | 'members' | 'memberCards',
    id: string,
    data: any | null
  ) => {
    if (!user || !syncStatus.isConnected) return;

    if (settings.dbProvider === 'supabase') {
      const sbClient = getSupabaseClient(settings.supabaseUrl, settings.supabaseAnonKey);
      if (!sbClient) return;

      try {
        if (data === null) {
          // Deletion
          const tableName = collectionName === 'memberCards' ? 'member_cards' : collectionName;
          await sbClient.from(tableName).delete().eq('id', id);
        } else {
          // Upsertion
          if (collectionName === 'products') {
            await sbClient.from('products').upsert({
              id: data.id,
              name: data.name,
              barcode: data.barcode || '',
              price: Number(data.price),
              cost: Number(data.cost),
              stock: Number(data.stock),
              safety_stock: Number(data.safetyStock || 0),
              unit: data.unit,
              category: data.category || '',
              image: data.image || '',
              created_at: data.createdAt || new Date().toISOString(),
              updated_at: data.updatedAt || new Date().toISOString()
            });
          } else if (collectionName === 'units') {
            await sbClient.from('units').upsert({
              id: data.id,
              name: data.name,
              created_at: data.createdAt
            });
          } else if (collectionName === 'members') {
            await sbClient.from('members').upsert({
              id: data.id,
              name: data.name,
              phone: data.phone || '',
              points: Number(data.points || 0),
              created_at: data.createdAt,
              updated_at: data.updatedAt || new Date().toISOString(),
              member_code: data.memberCode || '',
              birthday: data.birthday || ''
            });
          } else if (collectionName === 'memberCards') {
            await sbClient.from('member_cards').upsert({
              id: data.id,
              code: data.code,
              status: data.status,
              assigned_to_member_id: data.assignedToMemberId || null,
              assigned_to_member_name: data.assignedToMemberName || null,
              created_at: data.createdAt
            });
          }
        }

        // Successfully written to Supabase! Remove from pending queue
        setPendingWrites(prev => {
          const updated = { ...prev[collectionName] as any };
          delete updated[id];
          return { ...prev, [collectionName]: updated };
        });
      } catch (err) {
        console.warn(`Direct Supabase write on ${collectionName} failed:`, err);
      }
    } else {
      // Firebase standard execution
      try {
        const firestorePath = collectionName === 'memberCards' ? 'memberCards' : collectionName;
        if (data === null) {
          await deleteDoc(doc(db, firestorePath, id));
        } else {
          await setDoc(doc(db, firestorePath, id), data);
        }

        // Successfully written to Firestore! Remove from pending queue
        setPendingWrites(prev => {
          const updated = { ...prev[collectionName] as any };
          delete updated[id];
          return { ...prev, [collectionName]: updated };
        });
      } catch (err) {
        console.warn(`Direct Firestore write on ${collectionName} failed:`, err);
      }
    }
  };

  // ==========================================
  // PRODUCT MANAGEMENT
  // ==========================================
  const addProduct = async (p: Omit<Product, 'id'>) => {
    const id = 'p-' + generateUUID();
    const newProduct: Product = { ...p, id, createdAt: new Date().toISOString() };
    
    // 1. Instantly update Local UI State (Offline-first extreme responsive)
    setProducts(prev => [newProduct, ...prev]);

    // 2. Queue for Firebase/Supabase synchronization
    queueWrite('products', id, newProduct);

    // 3. Try to push immediately
    await executeImmediateWrite('products', id, newProduct);
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    // 1. Instantly update Local UI State
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p));

    // Find the merged product
    const updatedProduct = products.find(p => p.id === id);
    if (!updatedProduct) return;
    const finalProduct = { ...updatedProduct, ...updates, updatedAt: new Date().toISOString() };

    // 2. Queue for Sync
    queueWrite('products', id, finalProduct);

    // 3. Try to write immediately
    await executeImmediateWrite('products', id, finalProduct);
  };

  const deleteProduct = async (id: string) => {
    // 1. Update UI Instantly
    setProducts(prev => prev.filter(p => p.id !== id));

    // 2. Queue for deletion
    queueWrite('products', id, null);

    // 3. Sync to Database
    await executeImmediateWrite('products', id, null);
  };

  // ==========================================
  // UNIT MANAGEMENT
  // ==========================================
  const addUnit = async (name: string) => {
    const id = 'u-' + generateUUID();
    const newUnit: Unit = { id, name, createdAt: new Date().toISOString() };
    
    setUnits(prev => [...prev, newUnit]);
    queueWrite('units', id, newUnit);

    await executeImmediateWrite('units', id, newUnit);
  };

  const updateUnit = async (id: string, name: string) => {
    setUnits(prev => prev.map(u => u.id === id ? { ...u, name } : u));
    const targetUnit = units.find(u => u.id === id);
    if (!targetUnit) return;
    const finalUnit = { ...targetUnit, name };

    queueWrite('units', id, finalUnit);

    await executeImmediateWrite('units', id, finalUnit);
  };

  const deleteUnit = async (id: string) => {
    setUnits(prev => prev.filter(u => u.id !== id));
    queueWrite('units', id, null);

    await executeImmediateWrite('units', id, null);
  };

  // ==========================================
  // MEMBER MANAGEMENT & MEMBERSHIP CARDS
  // ==========================================
  const updateCardAssignmentState = async (cardCode: string, status: 'available' | 'assigned', memberId?: string, memberName?: string) => {
    setMemberCards(prev => prev.map(c => {
      if (c.code === cardCode) {
        return {
          ...c,
          status,
          assignedToMemberId: memberId || '',
          assignedToMemberName: memberName || ''
        };
      }
      return c;
    }));

    const cardDocId = cardCode; // use code as document ID
    const updatedCard: MemberCard = {
      id: cardDocId,
      code: cardCode,
      status,
      assignedToMemberId: memberId || '',
      assignedToMemberName: memberName || '',
      createdAt: new Date().toISOString()
    };

    // Keep original createdAt if possible
    const oldCard = memberCards.find(c => c.code === cardCode);
    if (oldCard) {
      updatedCard.createdAt = oldCard.createdAt;
    }

    setPendingWrites(prev => ({
      ...prev,
      memberCards: {
        ...(prev.memberCards || {}),
        [cardDocId]: updatedCard
      }
    }));

    await executeImmediateWrite('memberCards', cardDocId, updatedCard);
  };

  const addMember = async (m: Omit<Member, 'id' | 'points' | 'createdAt'>) => {
    const id = 'm-' + generateUUID();
    const newMember: Member = { 
      ...m, 
      id, 
      points: 0, 
      createdAt: new Date().toISOString() 
    };

    setMembers(prev => [newMember, ...prev]);
    queueWrite('members', id, newMember);

    if (m.memberCode) {
      await updateCardAssignmentState(m.memberCode, 'assigned', id, m.name);
    }

    await executeImmediateWrite('members', id, newMember);
  };

  const updateMember = async (id: string, updates: Partial<Member>) => {
    const found = members.find(m => m.id === id);
    if (!found) return;

    const oldCardCode = found.memberCode;
    const newCardCode = updates.memberCode;

    if (oldCardCode !== newCardCode) {
      if (oldCardCode) {
        await updateCardAssignmentState(oldCardCode, 'available');
      }
      if (newCardCode) {
        await updateCardAssignmentState(newCardCode, 'assigned', id, updates.name || found.name);
      }
    } else if (newCardCode && updates.name && updates.name !== found.name) {
      await updateCardAssignmentState(newCardCode, 'assigned', id, updates.name);
    }

    setMembers(prev => prev.map(m => {
      if (m.id === id) {
        return { ...m, ...updates, updatedAt: new Date().toISOString() };
      }
      return m;
    }));

    const finalMember = { ...found, ...updates, updatedAt: new Date().toISOString() };
    queueWrite('members', id, finalMember);

    await executeImmediateWrite('members', id, finalMember);
  };

  const deleteMember = async (id: string) => {
    const found = members.find(m => m.id === id);
    if (found && found.memberCode) {
      await updateCardAssignmentState(found.memberCode, 'available');
    }

    setMembers(prev => prev.filter(m => m.id !== id));
    queueWrite('members', id, null);

    await executeImmediateWrite('members', id, null);
  };

  const generateMemberCards = async (count: number) => {
    if (count <= 0) return;

    let maxNum = 10000;
    memberCards.forEach(c => {
      const match = c.code.match(/^RF-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1]);
        if (num > maxNum) {
          maxNum = num;
        }
      }
    });

    const newCards: MemberCard[] = [];
    const nowStr = new Date().toISOString();

    for (let i = 1; i <= count; i++) {
      const numCode = maxNum + i;
      const code = `RF-${numCode}`;
      const card: MemberCard = {
        id: code,
        code,
        status: 'available',
        createdAt: nowStr
      };
      newCards.push(card);
    }

    setMemberCards(prev => [...prev, ...newCards]);

    setPendingWrites(prev => {
      const updatedQueue = { ...(prev.memberCards || {}) };
      newCards.forEach(c => {
        updatedQueue[c.id] = c;
      });
      return { ...prev, memberCards: updatedQueue };
    });

    if (user && syncStatus.isConnected) {
      if (settings.dbProvider === 'supabase') {
        const sbClient = getSupabaseClient(settings.supabaseUrl, settings.supabaseAnonKey);
        if (sbClient) {
          try {
            await sbClient.from('member_cards').insert(newCards.map(c => ({
              id: c.id,
              code: c.code,
              status: c.status,
              created_at: c.createdAt
            })));
            setPendingWrites(prev => {
              const updatedQueue = { ...(prev.memberCards || {}) };
              newCards.forEach(c => {
                delete updatedQueue[c.id];
              });
              return { ...prev, memberCards: updatedQueue };
            });
          } catch (err) {
            console.warn("Bulk card sync in Supabase failed:", err);
          }
        }
      } else {
        try {
          const batch = writeBatch(db);
          newCards.forEach(c => {
            batch.set(doc(db, 'memberCards', c.id), c);
          });
          await batch.commit();

          setPendingWrites(prev => {
            const updatedQueue = { ...(prev.memberCards || {}) };
            newCards.forEach(c => {
              delete updatedQueue[c.id];
            });
            return { ...prev, memberCards: updatedQueue };
          });
        } catch (err) {
          console.warn("Bulk card sync failed, kept in offline sync queue:", err);
        }
      }
    }
  };

  const deleteMemberCard = async (id: string) => {
    setMemberCards(prev => prev.filter(c => c.id !== id));
    
    setPendingWrites(prev => ({
      ...prev,
      memberCards: {
        ...(prev.memberCards || {}),
        [id]: null
      }
    }));

    await executeImmediateWrite('memberCards', id, null);
  };

  // ==========================================
  // CART OPERATIONS
  // ==========================================
  const addToCart = (product: Product) => {
    setCart(prev => {
      const idx = prev.findIndex(item => item.product.id === product.id);
      if (idx > -1) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + 1 };
        return updated;
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      return prev.reduce((acc, item) => {
        if (item.product.id === productId) {
          if (item.quantity > 1) {
            acc.push({ ...item, quantity: item.quantity - 1 });
          }
        } else {
          acc.push(item);
        }
        return acc;
      }, [] as CartItem[]);
    });
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(prev => prev.filter(item => item.product.id !== productId));
      return;
    }
    setCart(prev => prev.map(item => 
      item.product.id === productId ? { ...item, quantity } : item
    ));
  };

  const setCartMember = (member: Member | null) => {
    setCartMemberState(member);
  };

  const clearCart = () => {
    setCart([]);
    setCartMemberState(null);
  };

  // ==========================================
  // CHECKOUT & SALES LOGIC
  // ==========================================
  const checkout = async (paymentMethod: 'Cash' | 'QR Code' | 'TrueMoney', cashReceived: number): Promise<Required<Sale>> => {
    if (cart.length === 0) {
      throw new Error('ตะกร้าสินค้าว่างเปล่า');
    }

    const totalAmount = cart.reduce((sum, item) => {
      const price = item.product.price;
      const discount = item.discount || 0;
      return sum + (price - discount) * item.quantity;
    }, 0);

    const change = cashReceived > totalAmount ? cashReceived - totalAmount : 0;

    // Rules for member loyalty points: 1 point per 50 Baht of purchase
    const pointsEarned = Math.floor(totalAmount / 50);

    const invoiceId = generateInvoiceId(sales.length);
    const saleId = 's-' + generateUUID();
    const currentDate = new Date().toISOString().split('T')[0];

    const saleItems: SaleItem[] = cart.map(item => ({
      productId: item.product.id,
      productName: item.product.name,
      price: item.product.price,
      cost: item.product.cost,
      quantity: item.quantity,
      unit: item.product.unit,
      total: (item.product.price - (item.discount || 0)) * item.quantity
    }));

    const newSale: Required<Sale> = {
      id: saleId,
      invoiceId,
      date: currentDate,
      timestamp: new Date().toISOString(),
      items: saleItems,
      totalAmount,
      cashReceived,
      change,
      paymentMethod,
      pointsEarned,
      memberId: cartMember?.id || '',
      memberName: cartMember?.name || '',
      synced: false
    };

    // 1. IN-MEMORY & LOCAL STORAGE STOCK RECONCILIATION
    // Instantly subtract stock quantities on client machine
    setProducts(prev => {
      const updated = prev.map(prod => {
        const itemInCart = cart.find(c => c.product.id === prod.id);
        if (itemInCart) {
          const freshStock = prod.stock - itemInCart.quantity;
          return { ...prod, stock: freshStock >= 0 ? freshStock : 0 };
        }
        return prod;
      });
      return updated;
    });

    // 2. Add points to loyalty custom member local
    if (cartMember) {
      setMembers(prev => prev.map(m => {
        if (m.id === cartMember.id) {
          return { ...m, points: m.points + pointsEarned };
        }
        return m;
      }));
    }

    // 3. Store the Sale locally immediately
    setSales(prev => [newSale, ...prev]);

    // 4. Reset checkout basket (POS screen clean instantly)
    clearCart();

    // 5. Place in sync queue
    setPendingWrites(prev => ({
      ...prev,
      sales: [...prev.sales, newSale]
    }));

    // 6. Try to write immediately to database
    if (user && syncStatus.isConnected) {
      if (settings.dbProvider === 'supabase') {
        const sbClient = getSupabaseClient(settings.supabaseUrl, settings.supabaseAnonKey);
        if (sbClient) {
          try {
            await sbClient.from('sales').insert({
              id: newSale.id,
              invoice_id: newSale.invoiceId,
              date: newSale.date,
              timestamp: newSale.timestamp,
              total_amount: Number(newSale.totalAmount),
              cash_received: Number(newSale.cashReceived),
              change: Number(newSale.change),
              payment_method: newSale.paymentMethod,
              points_earned: Number(newSale.pointsEarned),
              member_id: newSale.memberId || null,
              member_name: newSale.memberName || null
            });

            for (const item of newSale.items) {
              await sbClient.from('sale_items').insert({
                id: `si-${newSale.id}-${item.productId}`,
                sale_id: newSale.id,
                product_id: item.productId,
                product_name: item.productName,
                price: Number(item.price),
                cost: Number(item.cost),
                quantity: Number(item.quantity),
                unit: item.unit,
                total: Number(item.total)
              });

              // Adjust stock in Supabase
              const currentProd = products.find(p => p.id === item.productId);
              if (currentProd) {
                const freshStock = Math.max(0, currentProd.stock - item.quantity);
                await sbClient.from('products').update({ stock: freshStock }).eq('id', item.productId);
              }
            }

            // Adjust member loyalty points in Supabase
            if (cartMember) {
              const currentMem = members.find(m => m.id === cartMember.id);
              if (currentMem) {
                await sbClient.from('members').update({ points: currentMem.points + pointsEarned }).eq('id', cartMember.id);
              }
            }

            // Mark local sale as synced
            setSales(prev => prev.map(s => s.id === saleId ? { ...s, synced: true } : s));

            // Remove from pending sales sync queue
            setPendingWrites(prev => ({
              ...prev,
              sales: prev.sales.filter(s => s.id !== saleId)
            }));
          } catch (err) {
            console.warn("Direct Supabase sale synchronization failed:", err);
          }
        }
      } else {
        try {
          const saleRef = doc(db, 'sales', saleId);
          
          // Write transaction doc
          await setDoc(saleRef, {
            id: newSale.id,
            invoiceId: newSale.invoiceId,
            date: newSale.date,
            timestamp: newSale.timestamp,
            items: newSale.items,
            totalAmount: newSale.totalAmount,
            cashReceived: newSale.cashReceived,
            change: newSale.change,
            paymentMethod: newSale.paymentMethod,
            pointsEarned: newSale.pointsEarned,
            memberId: newSale.memberId,
            memberName: newSale.memberName
          });

          // Batch update database stock and member points in Firestore synchronously
          const batch = writeBatch(db);

          // Subtract stock in Firebase Database
          cart.forEach(item => {
            const prodRef = doc(db, 'products', item.product.id);
            const currentProd = products.find(p => p.id === item.product.id);
            if (currentProd) {
              const freshStock = Math.max(0, currentProd.stock - item.quantity);
              batch.update(prodRef, { stock: freshStock });
            }
          });

          // Increment user membership points in Firebase Database
          if (cartMember) {
            const memRef = doc(db, 'members', cartMember.id);
            const currentMem = members.find(m => m.id === cartMember.id);
            if (currentMem) {
              batch.update(memRef, { points: currentMem.points + pointsEarned });
            }
          }

          await batch.commit();

          // Mark local sale as synced
          setSales(prev => prev.map(s => s.id === saleId ? { ...s, synced: true } : s));

          // Remove from pending sales sync queue
          setPendingWrites(prev => ({
            ...prev,
            sales: prev.sales.filter(s => s.id !== saleId)
          }));

        } catch (err) {
          console.warn("Direct sale synchronization failed, kept in offline synchronization stack:", err);
        }
      }
    }

    return newSale;
  };

  // ==========================================
  // BACKGROUND SYNC ENGINE (OFFLINE-FIRST DESIGN)
  // ==========================================
  const triggerManualSync = async () => {
    if (!user) {
      setError("กรุณาเข้าสู่ระบบก่อนทำการซิงค์ข้อมูล");
      return;
    }
    if (!syncStatus.isConnected) {
      setError("ไม่สามารถซิงค์ได้เนื่องจากคุณกำลังใช้งานแบบออฟไลน์");
      return;
    }

    setSyncStatus(prev => ({ ...prev, isSyncing: true }));
    setError(null);

    try {
      if (settings.dbProvider === 'supabase') {
        const sbClient = getSupabaseClient(settings.supabaseUrl, settings.supabaseAnonKey);
        if (!sbClient) {
          setError("ไม่สามารถซิงค์ได้เนื่องจากยังไม่ได้ตั้งค่าโปรเจกต์ Supabase");
          setSyncStatus(prev => ({ ...prev, isSyncing: false }));
          return;
        }

        // 1. Sync Units
        const pendingUnitKeys = Object.keys(pendingWrites.units);
        for (const uid of pendingUnitKeys) {
          const uData = pendingWrites.units[uid];
          if (uData === null) {
            await sbClient.from('units').delete().eq('id', uid);
          } else {
            await sbClient.from('units').upsert({
              id: uData.id,
              name: uData.name,
              created_at: uData.createdAt
            });
          }
        }

        // 2. Sync Products
        const pendingProdKeys = Object.keys(pendingWrites.products);
        for (const pid of pendingProdKeys) {
          const pData = pendingWrites.products[pid];
          if (pData === null) {
            await sbClient.from('products').delete().eq('id', pid);
          } else {
            await sbClient.from('products').upsert({
              id: pData.id,
              name: pData.name,
              barcode: pData.barcode || '',
              price: Number(pData.price),
              cost: Number(pData.cost),
              stock: Number(pData.stock),
              safety_stock: Number(pData.safetyStock || 0),
              unit: pData.unit,
              category: pData.category || '',
              image: pData.image || '',
              created_at: pData.createdAt || new Date().toISOString(),
              updated_at: pData.updatedAt || new Date().toISOString()
            });
          }
        }

        // 3. Sync Members
        const pendingMemKeys = Object.keys(pendingWrites.members);
        for (const mid of pendingMemKeys) {
          const mData = pendingWrites.members[mid];
          if (mData === null) {
            await sbClient.from('members').delete().eq('id', mid);
          } else {
            await sbClient.from('members').upsert({
              id: mData.id,
              name: mData.name,
              phone: mData.phone || '',
              points: Number(mData.points || 0),
              created_at: mData.createdAt,
              updated_at: mData.updatedAt || new Date().toISOString(),
              member_code: mData.memberCode || '',
              birthday: mData.birthday || ''
            });
          }
        }

        // 3.5. Sync Member Cards
        const pendingCardKeys = Object.keys(pendingWrites.memberCards || {});
        for (const cid of pendingCardKeys) {
          const cData = pendingWrites.memberCards[cid];
          if (cData === null) {
            await sbClient.from('member_cards').delete().eq('id', cid);
          } else {
            await sbClient.from('member_cards').upsert({
              id: cData.id,
              code: cData.code,
              status: cData.status,
              assigned_to_member_id: cData.assignedToMemberId || null,
              assigned_to_member_name: cData.assignedToMemberName || null,
              created_at: cData.createdAt
            });
          }
        }

        // 4. Sync Sales History
        const pendingSaleItems = [...pendingWrites.sales];
        for (const sale of pendingSaleItems) {
          await sbClient.from('sales').upsert({
            id: sale.id,
            invoice_id: sale.invoiceId,
            date: sale.date,
            timestamp: sale.timestamp,
            total_amount: Number(sale.totalAmount),
            cash_received: Number(sale.cashReceived),
            change: Number(sale.change),
            payment_method: sale.paymentMethod,
            points_earned: Number(sale.pointsEarned),
            member_id: sale.memberId || null,
            member_name: sale.memberName || null
          });

          for (const item of sale.items) {
            await sbClient.from('sale_items').upsert({
              id: `si-${sale.id}-${item.productId}`,
              sale_id: sale.id,
              product_id: item.productId,
              product_name: item.productName,
              price: Number(item.price),
              cost: Number(item.cost),
              quantity: Number(item.quantity),
              unit: item.unit,
              total: Number(item.total)
            });

            // Adjust stock in Supabase
            const currentProd = products.find(p => p.id === item.productId);
            if (currentProd) {
              await sbClient.from('products').update({ stock: currentProd.stock }).eq('id', item.productId);
            }
          }

          if (sale.memberId) {
            const currentMem = members.find(m => m.id === sale.memberId);
            if (currentMem) {
              await sbClient.from('members').update({ points: currentMem.points }).eq('id', sale.memberId);
            }
          }

          setSales(prev => prev.map(s => s.id === sale.id ? { ...s, synced: true } : s));
        }

        setPendingWrites({ products: {}, members: {}, units: {}, memberCards: {}, sales: [] });
        
        const now = new Date().toLocaleTimeString('th-TH');
        localStorage.setItem('pos_last_synced', now);
        setSyncStatus(prev => ({
          ...prev,
          isSyncing: false,
          lastSyncedAt: now
        }));
        return;
      }

      // 1. Sync Units (Firebase path...)
      const pendingUnitKeys = Object.keys(pendingWrites.units);
      for (const uid of pendingUnitKeys) {
        const uData = pendingWrites.units[uid];
        if (uData === null) {
          // It was deleted offline
          await deleteDoc(doc(db, 'units', uid));
        } else {
          await setDoc(doc(db, 'units', uid), {
            id: uData.id,
            name: uData.name,
            createdAt: uData.createdAt
          });
        }
      }

      // 2. Sync Products
      const pendingProdKeys = Object.keys(pendingWrites.products);
      for (const pid of pendingProdKeys) {
        const pData = pendingWrites.products[pid];
        if (pData === null) {
          await deleteDoc(doc(db, 'products', pid));
        } else {
          await setDoc(doc(db, 'products', pid), {
            id: pData.id,
            name: pData.name,
            barcode: pData.barcode || '',
            price: Number(pData.price),
            cost: Number(pData.cost),
            stock: Number(pData.stock),
            safetyStock: Number(pData.safetyStock || 0),
            unit: pData.unit,
            category: pData.category || '',
            image: pData.image || '',
            createdAt: pData.createdAt || new Date().toISOString(),
            updatedAt: pData.updatedAt || ''
          });
        }
      }

      // 3. Sync Members
      const pendingMemKeys = Object.keys(pendingWrites.members);
      for (const mid of pendingMemKeys) {
        const mData = pendingWrites.members[mid];
        if (mData === null) {
          await deleteDoc(doc(db, 'members', mid));
        } else {
          await setDoc(doc(db, 'members', mid), {
            id: mData.id,
            name: mData.name,
            phone: mData.phone,
            points: Number(mData.points),
            createdAt: mData.createdAt,
            updatedAt: mData.updatedAt || '',
            memberCode: mData.memberCode || '',
            birthday: mData.birthday || ''
          });
        }
      }

      // 3.5. Sync Member Cards
      const pendingCardKeys = Object.keys(pendingWrites.memberCards || {});
      for (const cid of pendingCardKeys) {
        const cData = pendingWrites.memberCards[cid];
        if (cData === null) {
          await deleteDoc(doc(db, 'memberCards', cid));
        } else {
          await setDoc(doc(db, 'memberCards', cid), {
            id: cData.id,
            code: cData.code,
            status: cData.status,
            assignedToMemberId: cData.assignedToMemberId || '',
            assignedToMemberName: cData.assignedToMemberName || '',
            createdAt: cData.createdAt
          });
        }
      }

      // 4. Sync Sales History and adjust backend inventory stocks
      const pendingSaleItems = [...pendingWrites.sales];
      for (const sale of pendingSaleItems) {
        // Write the main Sale invoice record
        await setDoc(doc(db, 'sales', sale.id), {
          id: sale.id,
          invoiceId: sale.invoiceId,
          date: sale.date,
          timestamp: sale.timestamp,
          items: sale.items,
          totalAmount: sale.totalAmount,
          cashReceived: sale.cashReceived,
          change: sale.change,
          paymentMethod: sale.paymentMethod,
          pointsEarned: sale.pointsEarned,
          memberId: sale.memberId || '',
          memberName: sale.memberName || ''
        });

        // Commit stock updates inside a batch
        const batch = writeBatch(db);
        sale.items.forEach(item => {
          const prodRef = doc(db, 'products', item.productId);
          const currentProd = products.find(p => p.id === item.productId);
          if (currentProd) {
            batch.update(prodRef, { stock: currentProd.stock });
          }
        });

        if (sale.memberId) {
          const memRef = doc(db, 'members', sale.memberId);
          const currentMem = members.find(m => m.id === sale.memberId);
          if (currentMem) {
            batch.update(memRef, { points: currentMem.points });
          }
        }

        await batch.commit();

        // Mark as synced locally
        setSales(prev => prev.map(s => s.id === sale.id ? { ...s, synced: true } : s));
      }

      // 5. Everything synced beautifully! Reset the pending writing cues
      setPendingWrites({ products: {}, members: {}, units: {}, memberCards: {}, sales: [] });
      
      const now = new Date().toLocaleTimeString('th-TH');
      localStorage.setItem('pos_last_synced', now);
      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncedAt: now
      }));

    } catch (err) {
      console.error("Manual sync process caught error:", err);
      setError("เกิดความล้มเหลวในการซิงค์ข้อมูลบางส่วน กรุณาลองใหม่อีกครั้ง");
      setSyncStatus(prev => ({ ...prev, isSyncing: false }));
    }
  };

  return (
    <PosContext.Provider value={{
      user,
      authLoading,
      loginWithCredentials,
      logout,
      
      products,
      units,
      members,
      memberCards,
      sales,
      
      cart,
      cartMember,
      syncStatus,
      loading,
      error,
      
      settings,
      updateSettings,
      
      addProduct,
      updateProduct,
      deleteProduct,
      
      addUnit,
      updateUnit,
      deleteUnit,
      
      addMember,
      updateMember,
      deleteMember,
      
      generateMemberCards,
      deleteMemberCard,
      
      addToCart,
      removeFromCart,
      updateCartQuantity,
      setCartMember,
      clearCart,
      
      checkout,
      triggerManualSync,
      seedInitialData
    }}>
      {children}
    </PosContext.Provider>
  );
};
