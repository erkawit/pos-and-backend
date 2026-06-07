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
  signOut,
  User
} from 'firebase/auth';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import { Product, Unit, Member, MemberCard, Sale, CartItem, SyncStatus, SaleItem, StoreSettings } from '../types';
import { 
  generateInvoiceId, 
  generateUUID, 
  SEED_PRODUCTS, 
  SEED_MEMBERS, 
  SEED_UNITS 
} from '../utils/generators';

interface PosContextType {
  user: User | null;
  authLoading: boolean;
  loginWithGoogle: () => Promise<void>;
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
  const [user, setUser] = useState<User | null>(null);
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
    const cached = localStorage.getItem('pos_settings');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object' && parsed.logo) {
          return parsed;
        }
      } catch (e) {}
    }
    return {
      logo: '🛍️',
      nameEng: 'Thai Store & POS',
      nameThai: 'ระบบบริหารหน้าร้าน คลังพัสดุและฐานสมาชิก',
      themeColor: 'purple',
      promptPayId: '0812345678',
      trueMoneyPhone: '0812345678'
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

  // Monitor Auth Status
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  // Sync / Fetch data dynamically from Firebase if user is authenticated
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    let unsubProducts = () => {};
    let unsubUnits = () => {};
    let unsubMembers = () => {};
    let unsubMemberCards = () => {};
    let unsubSales = () => {};
    let unsubSettings = () => {};

    try {
      // 1. Subscribe to Products
      unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
        const prodList: Product[] = [];
        snapshot.forEach((doc) => {
          prodList.push({ id: doc.id, ...doc.data() } as Product);
        });
        // If there are standard seeds but DB is empty, we will handle that later.
        // If snapshot has items, update state
        if (prodList.length > 0) {
          setProducts(prodList);
        }
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, 'products');
      });

      // 2. Subscribe to Units
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

      // 3. Subscribe to Members
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

      // 3.5. Subscribe to Member Cards
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

      // 4. Subscribe to Sales History
      unsubSales = onSnapshot(collection(db, 'sales'), (snapshot) => {
        const salesList: Sale[] = [];
        snapshot.forEach((doc) => {
          salesList.push({ id: doc.id, ...doc.data() } as Sale);
        });
        // Sort sales by timestamp descending
        salesList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setSales(salesList);
        setLoading(false);
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, 'sales');
      });

      // 5. Subscribe to Settings
      unsubSettings = onSnapshot(doc(db, 'settings', 'store_config'), (snapshot) => {
        if (snapshot.exists()) {
          const cloudSettings = snapshot.data() as StoreSettings;
          setSettings(cloudSettings);
        }
      }, (err) => {
        // Safe warning on first load if settings don't exist yet
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
  }, [user]);

  const updateSettings = async (newSettings: StoreSettings) => {
    setSettings(newSettings);
    if (user && syncStatus.isConnected) {
      try {
        await setDoc(doc(db, 'settings', 'store_config'), newSettings);
      } catch (err) {
        console.warn("Firebase settings update warning:", err);
        handleFirestoreError(err, OperationType.WRITE, 'settings/store_config');
      }
    }
  };

  // Handle automatic syncing when network comes back online
  useEffect(() => {
    if (syncStatus.isConnected && user && syncStatus.pendingCount > 0 && !syncStatus.isSyncing) {
      // Auto trigger sync after brief delay
      const timer = setTimeout(() => {
        triggerManualSync();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [syncStatus.isConnected, user, syncStatus.pendingCount]);

  // Auth operators
  const loginWithGoogle = async () => {
    try {
      setAuthLoading(true);
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Login fail in provider context:", err);
      setError("ไม่สามารถเข้าสู่ระบบผ่าน Google ได้");
      throw err;
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      // Empty local operational cart
      setCart([]);
      setCartMemberState(null);
      // Reset products, units, and members to default seed items on logout so offline works beautiful immediately
      setProducts(SEED_PRODUCTS);
      setUnits(SEED_UNITS);
      setMembers(SEED_MEMBERS);
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
  const queueWrite = (type: 'products' | 'members' | 'units', id: string, data: any | null) => {
    setPendingWrites(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [id]: data
      }
    }));
  };

  // ==========================================
  // PRODUCT MANAGEMENT
  // ==========================================
  const addProduct = async (p: Omit<Product, 'id'>) => {
    const id = 'p-' + generateUUID();
    const newProduct: Product = { ...p, id, createdAt: new Date().toISOString() };
    
    // 1. Instantly update Local UI State (Offline-first extreme responsive)
    setProducts(prev => [newProduct, ...prev]);

    // 2. Queue for Firebase synchronization
    queueWrite('products', id, newProduct);

    // 3. Try to push immediately
    if (user && syncStatus.isConnected) {
      try {
        await setDoc(doc(db, 'products', id), {
          id: newProduct.id,
          name: newProduct.name,
          barcode: newProduct.barcode || '',
          price: Number(newProduct.price),
          cost: Number(newProduct.cost),
          stock: Number(newProduct.stock),
          safetyStock: Number(newProduct.safetyStock || 0),
          unit: newProduct.unit,
          category: newProduct.category || '',
          image: newProduct.image || '',
          createdAt: newProduct.createdAt
        });
        // Remove from pending queue on success
        setPendingWrites(prev => {
          const updated = { ...prev.products };
          delete updated[id];
          return { ...prev, products: updated };
        });
      } catch (err) {
        console.warn("Direct Firestore write failed, keeping in offline pool:", err);
      }
    }
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    // 1. Instantly update Local UI State
    let originalProduct: Product | undefined;
    setProducts(prev => prev.map(p => {
      if (p.id === id) {
        originalProduct = p;
        return { ...p, ...updates, updatedAt: new Date().toISOString() };
      }
      return p;
    }));

    // Find the merged product
    const updatedProduct = products.find(p => p.id === id);
    if (!updatedProduct) return;
    const finalProduct = { ...updatedProduct, ...updates, updatedAt: new Date().toISOString() };

    // 2. Queue for Sync
    queueWrite('products', id, finalProduct);

    // 3. Try to write in Firestore
    if (user && syncStatus.isConnected) {
      try {
        await setDoc(doc(db, 'products', id), {
          id: finalProduct.id,
          name: finalProduct.name,
          barcode: finalProduct.barcode || '',
          price: Number(finalProduct.price),
          cost: Number(finalProduct.cost),
          stock: Number(finalProduct.stock),
          safetyStock: Number(finalProduct.safetyStock || 0),
          unit: finalProduct.unit,
          category: finalProduct.category || '',
          image: finalProduct.image || '',
          createdAt: finalProduct.createdAt || new Date().toISOString(),
          updatedAt: finalProduct.updatedAt
        });
        // Remove from queue
        setPendingWrites(prev => {
          const updated = { ...prev.products };
          delete updated[id];
          return { ...prev, products: updated };
        });
      } catch (err) {
        console.warn("Direct update failed, keeping in offline pool:", err);
      }
    }
  };

  const deleteProduct = async (id: string) => {
    // 1. Update UI Instantly
    setProducts(prev => prev.filter(p => p.id !== id));

    // 2. Queue for deletion
    queueWrite('products', id, null);

    // 3. Sync to Firestore
    if (user && syncStatus.isConnected) {
      try {
        await deleteDoc(doc(db, 'products', id));
        setPendingWrites(prev => {
          const updated = { ...prev.products };
          delete updated[id];
          return { ...prev, products: updated };
        });
      } catch (err) {
        console.warn("Direct delete failed, keeping in offline pool:", err);
      }
    }
  };

  // ==========================================
  // UNIT MANAGEMENT
  // ==========================================
  const addUnit = async (name: string) => {
    const id = 'u-' + generateUUID();
    const newUnit: Unit = { id, name, createdAt: new Date().toISOString() };
    
    setUnits(prev => [...prev, newUnit]);
    queueWrite('units', id, newUnit);

    if (user && syncStatus.isConnected) {
      try {
        await setDoc(doc(db, 'units', id), {
          id: newUnit.id,
          name: newUnit.name,
          createdAt: newUnit.createdAt
        });
        setPendingWrites(prev => {
          const updated = { ...prev.units };
          delete updated[id];
          return { ...prev, units: updated };
        });
      } catch (err) {
        console.warn("Direct unit insert failed:", err);
      }
    }
  };

  const updateUnit = async (id: string, name: string) => {
    setUnits(prev => prev.map(u => u.id === id ? { ...u, name } : u));
    const targetUnit = units.find(u => u.id === id);
    if (!targetUnit) return;
    const finalUnit = { ...targetUnit, name };

    queueWrite('units', id, finalUnit);

    if (user && syncStatus.isConnected) {
      try {
        await setDoc(doc(db, 'units', id), {
          id: finalUnit.id,
          name: finalUnit.name,
          createdAt: finalUnit.createdAt
        });
        setPendingWrites(prev => {
          const updated = { ...prev.units };
          delete updated[id];
          return { ...prev, units: updated };
        });
      } catch (err) {
        console.warn("Direct unit edit failed:", err);
      }
    }
  };

  const deleteUnit = async (id: string) => {
    setUnits(prev => prev.filter(u => u.id !== id));
    queueWrite('units', id, null);

    if (user && syncStatus.isConnected) {
      try {
        await deleteDoc(doc(db, 'units', id));
        setPendingWrites(prev => {
          const updated = { ...prev.units };
          delete updated[id];
          return { ...prev, units: updated };
        });
      } catch (err) {
        console.warn("Direct unit delete failed:", err);
      }
    }
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

    if (user && syncStatus.isConnected) {
      try {
        await setDoc(doc(db, 'memberCards', cardDocId), updatedCard);
        setPendingWrites(prev => {
          const updated = { ...(prev.memberCards || {}) };
          delete updated[cardDocId];
          return { ...prev, memberCards: updated };
        });
      } catch (err) {
        console.warn("Direct card update failed:", err);
      }
    }
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

    if (user && syncStatus.isConnected) {
      try {
        await setDoc(doc(db, 'members', id), {
          id: newMember.id,
          name: newMember.name,
          phone: newMember.phone,
          points: Number(newMember.points),
          createdAt: newMember.createdAt,
          memberCode: newMember.memberCode || '',
          birthday: newMember.birthday || ''
        });
        setPendingWrites(prev => {
          const updated = { ...prev.members };
          delete updated[id];
          return { ...prev, members: updated };
        });
      } catch (err) {
        console.warn("Direct member creation failed:", err);
      }
    }
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

    if (user && syncStatus.isConnected) {
      try {
        await setDoc(doc(db, 'members', id), {
          id: finalMember.id,
          name: finalMember.name,
          phone: finalMember.phone,
          points: Number(finalMember.points),
          createdAt: finalMember.createdAt,
          updatedAt: finalMember.updatedAt || '',
          memberCode: finalMember.memberCode || '',
          birthday: finalMember.birthday || ''
        });
        setPendingWrites(prev => {
          const updated = { ...prev.members };
          delete updated[id];
          return { ...prev, members: updated };
        });
      } catch (err) {
        console.warn("Direct member update failed:", err);
      }
    }
  };

  const deleteMember = async (id: string) => {
    const found = members.find(m => m.id === id);
    if (found && found.memberCode) {
      await updateCardAssignmentState(found.memberCode, 'available');
    }

    setMembers(prev => prev.filter(m => m.id !== id));
    queueWrite('members', id, null);

    if (user && syncStatus.isConnected) {
      try {
        await deleteDoc(doc(db, 'members', id));
        setPendingWrites(prev => {
          const updated = { ...prev.members };
          delete updated[id];
          return { ...prev, members: updated };
        });
      } catch (err) {
        console.warn("Direct member delete failed:", err);
      }
    }
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

    if (user && syncStatus.isConnected) {
      try {
        await deleteDoc(doc(db, 'memberCards', id));
        setPendingWrites(prev => {
          const updated = { ...(prev.memberCards || {}) };
          delete updated[id];
          return { ...prev, memberCards: updated };
        });
      } catch (err) {
        console.warn("Direct card delete failed:", err);
      }
    }
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

    // 6. Try to write immediately to Firebase Firestore
    if (user && syncStatus.isConnected) {
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
      // 1. Sync Units
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
      loginWithGoogle,
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
