import { Product, Unit, Member } from '../types';

/**
 * Generates a compliant PromptPay EMVCo static QR payload.
 * Supports standard domestic mobile phone numbers (10 digits) or national IDs (13 digits).
 */
export function generatePromptPayPayload(phoneNumberOrId: string, amount?: number): string {
  // Normalize string by sanitizing dashes and whitespace
  const target = phoneNumberOrId.replace(/[- ]/g, "").trim();
  let formattedTarget = target;
  
  if (target.length === 10) {
    // Standard Thailand mobile: starts with 0 (e.g. 0812345678) -> convert convert to international 0066 (e.g. 0066812345678)
    formattedTarget = "0066" + target.substring(1);
  } else if (target.length === 13) {
    // Thai national ID
    formattedTarget = target;
  }

  // EMVCo tags
  const p1 = "000201010212"; // Payload version and static merchant/personal QR type
  const p2 = "2937" + "0016A000000677010111" + (formattedTarget.length === 13 ? "0213" : "0113") + formattedTarget;
  const p3 = "5802TH"; // Country code
  
  let amountStr = "";
  if (amount !== undefined && amount > 0) {
    const amtFormatted = amount.toFixed(2);
    // Tag 54: Amount length + amount formatted text
    amountStr = "54" + String(amtFormatted.length).padStart(2, "0") + amtFormatted;
  }
  
  // Tag 53: Transaction Currency (764 = THB), space for checksum in Tag 63
  const p4 = "5303764" + amountStr + "6304";
  const fullData = p1 + p2 + p3 + p4;

  // Compute CRC-16/CCITT-FALSE (XMODEM variant)
  let crc = 0xFFFF;
  for (let i = 0; i < fullData.length; i++) {
    let x = ((crc >> 8) ^ fullData.charCodeAt(i)) & 0xFF;
    x ^= x >> 4;
    crc = ((crc << 8) ^ (x << 12) ^ (x << 5) ^ x) & 0xFFFF;
  }
  
  const crcStr = crc.toString(16).toUpperCase().padStart(4, "0");
  return fullData + crcStr;
}

/**
 * High quality dynamic QR URL generator usando standard QR Server API
 */
export function getPromptPayQRUrl(phoneNumberOrId: string, amount: number): string {
  const payload = generatePromptPayPayload(phoneNumberOrId, amount);
  return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(payload)}`;
}

/**
 * Generates high quality short alphanumeric custom IDs
 */
export function generateUUID(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generates Sequential Invoice Identifiers: INV-YYYYMMDD-XXXX
 */
export function generateInvoiceId(salesCountToday: number): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');
  
  const idx = String(salesCountToday + 1).padStart(4, '0');
  return `INV-${year}${month}${date}-${idx}`;
}

export const SEED_UNITS: Unit[] = [
  { id: 'u-1', name: 'แก้ว', createdAt: new Date().toISOString() },
  { id: 'u-2', name: 'ชิ้น', createdAt: new Date().toISOString() },
  { id: 'u-3', name: 'ถุง', createdAt: new Date().toISOString() },
  { id: 'u-4', name: 'กล่อง', createdAt: new Date().toISOString() },
  { id: 'u-5', name: 'กิโลกรัม', createdAt: new Date().toISOString() }
];

export const SEED_PRODUCTS: Product[] = [
  {
    id: 'chiffon-1',
    name: 'ชิปฟ่อนมะพร้าว',
    barcode: '8850021001',
    price: 35,
    cost: 15,
    stock: 25,
    safetyStock: 8,
    unit: 'ชิ้น',
    category: 'ขนมชิปฟ่อน',
    image: ''
  },
  {
    id: 'chiffon-2',
    name: 'ชิปฟ่อนช็อกโกแลต',
    barcode: '8850021002',
    price: 35,
    cost: 15,
    stock: 6,
    safetyStock: 5,
    unit: 'ชิ้น',
    category: 'ขนมชิปฟ่อน',
    image: ''
  },
  {
    id: 'chiffon-3',
    name: 'ชิปฟ่อนชาไทย',
    barcode: '8850021003',
    price: 35,
    cost: 15,
    stock: 12,
    safetyStock: 5,
    unit: 'ชิ้น',
    category: 'ขนมชิปฟ่อน',
    image: ''
  },
  {
    id: 'chiffon-4',
    name: 'ชิปฟ่อนใบเตย',
    barcode: '8850021004',
    price: 35,
    cost: 15,
    stock: 5,
    safetyStock: 5,
    unit: 'ชิ้น',
    category: 'ขนมชิปฟ่อน',
    image: ''
  },
  {
    id: 'chiffon-5',
    name: 'ชิปฟ่อนฝอยทอง',
    barcode: '8850021005',
    price: 40,
    cost: 18,
    stock: 15,
    safetyStock: 6,
    unit: 'ชิ้น',
    category: 'ขนมชิปฟ่อน',
    image: ''
  },
  {
    id: 'chiffon-6',
    name: 'ชิปฟ่อนหมูหยอง',
    barcode: '8850021006',
    price: 45,
    cost: 20,
    stock: 4,
    safetyStock: 5,
    unit: 'ชิ้น',
    category: 'ขนมชิปฟ่อน',
    image: ''
  },
  {
    id: 'chiffon-7',
    name: 'ชิปฟ่อนไก่หยอง',
    barcode: '8850021007',
    price: 45,
    cost: 20,
    stock: 18,
    safetyStock: 6,
    unit: 'ชิ้น',
    category: 'ขนมชิปฟ่อน',
    image: ''
  }
];

export const SEED_MEMBERS: Member[] = [
  { id: 'm-1', name: 'คุณวิชัย สุวรรณศักดิ์', phone: '0812345678', points: 350, createdAt: new Date().toISOString() },
  { id: 'm-2', name: 'คุณสมรัก ใจดี', phone: '0898765432', points: 120, createdAt: new Date().toISOString() },
  { id: 'm-3', name: 'คุณอารียา สินค้าดี', phone: '0951122334', points: 45, createdAt: new Date().toISOString() }
];
