export interface Unit {
  id: string;
  name: string;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  barcode: string;
  price: number;
  cost: number;
  stock: number;
  safetyStock: number; // Notification threshold
  unit: string; // unit ID or Name
  image?: string; // base64 representation of the product image
  category?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Member {
  id: string;
  name: string;
  phone: string;
  points: number;
  createdAt: string;
  updatedAt?: string;
  memberCode?: string; // รหัสบัตรรัน RF-10001 เป็นต้น
  birthday?: string; // วันเดือนปีเกิด
}

export interface MemberCard {
  id: string;
  code: string;
  status: 'available' | 'assigned';
  assignedToMemberId?: string;
  assignedToMemberName?: string;
  createdAt: string;
}

export interface SaleItem {
  productId: string;
  productName: string;
  price: number;
  cost: number;
  quantity: number;
  unit: string;
  total: number;
}

export interface Sale {
  id: string;
  invoiceId: string;
  date: string; // YYYY-MM-DD
  timestamp: string; // ISO String
  items: SaleItem[];
  totalAmount: number;
  cashReceived: number;
  change: number;
  paymentMethod: 'Cash' | 'QR Code' | 'TrueMoney';
  pointsEarned: number;
  memberId?: string;
  memberName?: string;
  synced?: boolean; // Offline-first sync status
}

export interface CartItem {
  product: Product;
  quantity: number;
  discount?: number;
}

export interface SyncStatus {
  isConnected: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncedAt?: string;
}

export interface StoreSettings {
  logo: string; // Base64 data, URL or Emoji
  nameEng: string;
  nameThai: string;
  themeColor: 'purple' | 'pink' | 'blue' | 'emerald' | 'orange';
  promptPayId?: string;
  trueMoneyPhone?: string;
}

