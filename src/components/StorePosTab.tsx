import React, { useState, useMemo } from 'react';
import { usePos } from '../context/PosContext';
import { Product, Member, CartItem } from '../types';
import { getPromptPayQRUrl } from '../utils/generators';
import { BillingReceiptModal } from './BillingReceiptModal';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { 
  Plus, Minus, Trash2, Search, User, UserCheck, 
  CreditCard, Coins, Check, X, QrCode, Ticket, 
  ShoppingCart, Ban, Sparkles, Settings2, SlidersHorizontal, Filter, Barcode, Camera, Printer,
  AlertTriangle, Boxes, Volume2, Play, Keyboard
} from 'lucide-react';
import Swal from 'sweetalert2';
import { promptNumpad } from '../utils/thaiNumpad';


export const StorePosTab: React.FC = () => {
  const { 
    products, members, cart, cartMember, addToCart, removeFromCart, 
    updateCartQuantity, setCartMember, clearCart, checkout, settings 
  } = usePos();

  // Search parameters for catalog and members
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState<'name' | 'price-asc' | 'price-desc' | 'stock-low'>('name');
  const [memberSearch, setMemberSearch] = useState('');
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // PromptPay settings (Configurable PromptPay ID for custom mock payments)
  const [promptPayId, setPromptPayId] = useState(() => {
    return localStorage.getItem('pos_promptpay_id') || '0812345678';
  });
  const [isPpConfigOpen, setIsPpConfigOpen] = useState(false);

  // Checkout modal controls
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'QR Code' | 'TrueMoney'>('Cash');
  const [cashInput, setCashInput] = useState<string>('');
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [promptPayIdInput, setPromptPayIdInput] = useState('');
  const [trueMoneyPhoneInput, setTrueMoneyPhoneInput] = useState('');
  const [qrAmountInput, setQrAmountInput] = useState('');

  // Success state receipt popup
  const [lastCompletedSale, setLastCompletedSale] = useState<any>(null);

  // Low stock warning alerts state
  const [lowStockAlertProduct, setLowStockAlertProduct] = useState<{
    product: Product;
    currentCartQty: number;
    nextQty: number;
    remainingStock: number;
  } | null>(null);

  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(() => {
    const cached = localStorage.getItem('pos_sound_enabled');
    return cached !== 'false';
  });

  const playWarningSound = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const now = ctx.currentTime;
      
      // Tone 1: Warn tone (D5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.18);

      // Tone 2: Descending tone (A4)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(440.00, now + 0.15);
      gain2.gain.setValueAtTime(0.15, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.35);
    } catch (e) {
      console.warn("AudioContext warning sound failed", e);
    }
  };

  const handleAddToCartWithAlert = (product: Product) => {
    const existingItem = cart.find(item => item.product.id === product.id);
    const currentQty = existingItem ? existingItem.quantity : 0;
    const nextQty = currentQty + 1;
    const remaining = product.stock - nextQty;

    // Trigger warning if remaining stock drops to or below safetyStock/reorderPoint
    if (remaining <= product.safetyStock) {
      setLowStockAlertProduct({
        product,
        currentCartQty: currentQty,
        nextQty,
        remainingStock: Math.max(0, remaining)
      });

      if (isSoundEnabled) {
        playWarningSound();
      }
    }
    
    addToCart(product);
  };

  // Save PromptPay ID
  const savePromptPayId = (id: string) => {
    const clean = id.trim();
    setPromptPayId(clean);
    localStorage.setItem('pos_promptpay_id', clean);
    setIsPpConfigOpen(false);
  };

  // Generate categories list dynamically
  const categories = useMemo(() => {
    const list = new Set<string>();
    products.forEach(p => {
      if (p.category) list.add(p.category);
    });
    return ['All', ...Array.from(list)];
  }, [products]);

  // Filtered and sorted products list
  const filteredProducts = useMemo(() => {
    let result = products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(productSearch.toLowerCase()) || 
                            (p.barcode && p.barcode.includes(productSearch));
      const matchesCategory = selectedCategory === 'All' ? true : p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    if (sortBy === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name, 'th'));
    } else if (sortBy === 'price-asc') {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-desc') {
      result.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'stock-low') {
      result.sort((a, b) => a.stock - b.stock);
    }

    return result;
  }, [products, productSearch, selectedCategory, sortBy]);

  // Filtered and suggested members for loyalty point attachments
  const suggestedMembers = useMemo(() => {
    if (!memberSearch.trim()) return [];
    const q = memberSearch.trim().toLowerCase();
    return members.filter(m => 
      m.name.toLowerCase().includes(q) || 
      m.phone.includes(q) ||
      (m.memberCode && m.memberCode.toLowerCase().includes(q))
    );
  }, [members, memberSearch]);

  // Financial statistics of active cart
  const cartTotals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => {
      const price = item.product.price;
      const discount = item.discount || 0;
      return sum + (price - discount) * item.quantity;
    }, 0);
    
    // 1 loyalty point per 50 Baht
    const pointsEarned = Math.floor(subtotal / 50);

    return {
      subtotal,
      pointsEarned
    };
  }, [cart]);

  // Cash change logic
  const changeAmount = useMemo(() => {
    const cash = parseFloat(cashInput) || 0;
    if (cash >= cartTotals.subtotal) {
      return cash - cartTotals.subtotal;
    }
    return 0;
  }, [cashInput, cartTotals.subtotal]);

  // Set standard quick cash denominations
  const quickCashOptions = [50, 100, 500, 1000];

  // Numpad handlers for checkout/cart quantities
  const handleCartQuantityNumpad = async (productId: string, currentQty: number, maxStock: number) => {
    const result = await promptNumpad({ 
      title: 'ระบุจำนวนสินค้าในตะกร้า', 
      defaultValue: currentQty, 
      allowDecimal: false 
    });
    if (result !== null) {
      const targetQty = Math.max(1, Math.min(maxStock, result));
      updateCartQuantity(productId, targetQty);
    }
  };

  const handleCashInputNumpad = async () => {
    const result = await promptNumpad({ 
      title: 'ระบุยอดเงินที่ได้รับจากลูกค้า (฿)', 
      defaultValue: cashInput || '0' 
    });
    if (result !== null) {
      setCashInput(result.toString());
    }
  };

  const handleQrAmountInputNumpad = async () => {
    const result = await promptNumpad({ 
      title: 'ระบุยอดที่สแกนชำระพร้อมเพย์ (฿)', 
      defaultValue: qrAmountInput || '0' 
    });
    if (result !== null) {
      setQrAmountInput(result.toString());
    }
  };

  const handleOpenPayment = () => {
    if (cart.length === 0) return;
    setCheckoutError(null);
    setCashInput('');
    setPromptPayIdInput(settings?.promptPayId || promptPayId);
    setTrueMoneyPhoneInput(settings?.trueMoneyPhone || '0812345678');
    setQrAmountInput(cartTotals.subtotal.toString());
    setIsPaymentModalOpen(true);
  };

  const handleApplyQuickCash = (amount: number) => {
    setCashInput(amount.toString());
  };

  const handleSetExactCash = () => {
    setCashInput(cartTotals.subtotal.toString());
  };

  const handleConfirmPayment = async () => {
    setCheckoutError(null);
    const numericCash = parseFloat(cashInput) || 0;

    if (paymentMethod === 'Cash' && numericCash < cartTotals.subtotal) {
      setCheckoutError('จำนวนเงินสดที่ได้รับไม่เพียงพอสำหรับชำระค่าสินค้า');
      return;
    }

    try {
      setIsProcessingCheckout(true);
      
      // Checkout in DB Context (returns final Sale details)
      const confirmedCash = paymentMethod === 'QR Code' 
        ? (parseFloat(qrAmountInput) || cartTotals.subtotal) 
        : paymentMethod === 'TrueMoney' 
        ? cartTotals.subtotal 
        : numericCash;
      const completedSale = await checkout(paymentMethod, confirmedCash);
      
      setLastCompletedSale(completedSale);
      setIsPaymentModalOpen(false);

      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'ชำระเงินสำเร็จแล้ว! 🎉',
        text: `ยอดรับชำระสุทธิ ฿${cartTotals.subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}`,
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      });
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'ไม่สามารถชำระเงินได้');
    } finally {
      setIsProcessingCheckout(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full flex-1">
      
      {/* LEFT SECTION: PRODUCTS CATALOG (GRID: 8 COLUMNS) */}
      <div className="lg:col-span-7 xl:col-span-8 flex flex-col space-y-4 no-print">
        
        {/* Enhanced Live Search Filter Component */}
        <div className="bg-white p-4.5 rounded-2xl border border-pink-50/60 shadow-2xs space-y-3 animate-fade-in">
          
          <div className="flex flex-col md:flex-row gap-3 items-stretch justify-between">
            
            {/* Live Search Input Module */}
            <div className="flex flex-col sm:flex-row gap-2.5 flex-1 items-stretch">
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-slate-400">
                  <Search className="w-4 h-4 text-purple-400" />
                </span>
                
                <input
                  type="text"
                  placeholder="พิมพ์ชื่อสินค้า, บาร์โค้ด, หรือสแกนเพื่อค้นหา..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-10 pr-24 py-2.5 bg-slate-50/50 hover:bg-slate-55 border border-pink-100/30 rounded-xl text-xs font-semibold text-slate-700 placeholder-slate-400/80 font-sans focus:outline-hidden focus:ring-2 focus:ring-purple-200/50 focus:border-purple-300 transition-all shadow-2xs"
                />

                {/* Dynamic Status Badges inside Search Bar */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 no-print">
                  {productSearch ? (
                    <button
                      onClick={() => setProductSearch('')}
                      className="p-1 text-slate-400 hover:text-rose-500 rounded-full hover:bg-rose-50/50 transition-colors cursor-pointer"
                      title="ล้างคำค้นหา"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <span className="text-[9px] font-bold text-purple-400/80 bg-purple-50 px-1.5 py-0.5 rounded-md border border-purple-100/30 flex items-center gap-0.5 select-none md:mr-1">
                      <Barcode className="w-3 h-3" />
                      Auto-SCAN
                    </span>
                  )}
                </div>
              </div>

              {/* Barcode scanner hardware wedge connection */}
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="py-2.5 px-4 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 font-extrabold text-white rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 text-xs cursor-pointer focus:outline-hidden active:scale-95 whitespace-nowrap shrink-0 border border-black/5"
              >
                <Barcode className="w-4 h-4 text-current" />
                <span>สแกนเนอร์บาร์โค้ด USB/Wireless</span>
              </button>
            </div>

            {/* Live sorting dropdown/controls */}
            <div className="flex gap-2 items-center justify-between sm:justify-start">
              <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 whitespace-nowrap">
                <SlidersHorizontal className="w-3.5 h-3.5 text-purple-400" />
                จัดเรียงตาม:
              </span>
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="py-2.5 px-3 bg-slate-50/50 hover:bg-slate-55 border border-pink-100/30 rounded-xl text-xs font-bold text-slate-600 focus:outline-hidden focus:ring-2 focus:ring-purple-200/50 focus:border-purple-350 transition-all cursor-pointer"
              >
                <option value="name">ชื่อสินค้า (ก-ฮ)</option>
                <option value="price-asc">ราคา: ต่ำ ➔ สูง</option>
                <option value="price-desc">ราคา: สูง ➔ ต่ำ</option>
                <option value="stock-low">สต็อก: น้อย ➔ มาก</option>
              </select>
            </div>

          </div>

          {/* Categories select row & live statistics bar */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pt-2.5 border-t border-dashed border-pink-50/80">
            
            {/* Category selection */}
            <div className="flex items-center gap-2 max-w-full overflow-x-auto pb-1 md:pb-0 scrollbar-none">
              <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 whitespace-nowrap shrink-0">
                <Filter className="w-3.5 h-3.5 text-purple-400" />
                หมวดหมู่:
              </span>
              <div className="flex bg-slate-50 p-0.5 rounded-xl border border-pink-50/30 overflow-x-auto divide-x divide-pink-100/30 scrollbar-none">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                      selectedCategory === cat 
                        ? 'bg-white text-purple-700 shadow-2xs border border-pink-100/20' 
                        : 'text-slate-500 hover:text-purple-600'
                    }`}
                  >
                    {cat === 'All' ? 'ทั้งหมด' : cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick stats / results counter badge */}
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 shrink-0 self-end md:self-auto flex-wrap gap-y-2">
              <span>พบสินค้าตรงเงื่อนไข</span>
              <span className="font-mono bg-purple-50 border border-purple-100/50 text-purple-700 px-2 py-0.5 rounded-full font-bold">
                {filteredProducts.length}
              </span>
              <span>จาก {products.length} รายการ</span>
              
              {productSearch && (
                <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-100/45 px-1.5 py-0.5 rounded-md font-bold flex items-center gap-0.5 ml-1 animate-pulse">
                  กำลังกรองข้อมูล
                </span>
              )}

              {/* Sound alert system status and test module */}
              <div className="flex items-center gap-2 ml-2 pl-2 border-l border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !isSoundEnabled;
                    setIsSoundEnabled(nextVal);
                    localStorage.setItem('pos_sound_enabled', String(nextVal));
                    if (nextVal) playWarningSound();
                  }}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all border cursor-pointer ${
                    isSoundEnabled 
                      ? 'bg-purple-100/90 text-purple-700 border-purple-200 hover:bg-purple-200/50' 
                      : 'bg-slate-100 text-slate-450 border-slate-200 hover:bg-slate-200/50'
                  }`}
                  title={isSoundEnabled ? "เปิดสัญญาณเสียงเตือน (คลิกเพื่อปิด)" : "ปิดสัญญาณเสียงเตือน (คลิกเพื่อเปิด)"}
                >
                  <Volume2 className={`w-3.5 h-3.5 ${isSoundEnabled ? 'text-purple-600 animate-pulse' : 'text-slate-400'}`} />
                  <span>เสียงเตือนสต็อก {isSoundEnabled ? 'เปิด' : 'ปิด'}</span>
                </button>
                {isSoundEnabled && (
                  <button
                    type="button"
                    onClick={() => playWarningSound()}
                    className="p-1 hover:bg-purple-100 text-purple-500 rounded-lg hover:text-purple-700 transition-colors cursor-pointer"
                    title="ทดสอบระดับความดังและเสียงแจ้งเตือน"
                  >
                    <Play className="w-3 h-3 fill-purple-600 stroke-purple-600" />
                  </button>
                )}
              </div>
            </div>

          </div>

        </div>

        {/* Catalog grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 flex-1 overflow-y-auto max-h-[75vh]">
          {filteredProducts.map((p) => {
            const isOut = p.stock <= 0;
            const isLow = p.stock <= p.safetyStock;

            return (
              <div 
                key={p.id}
                onClick={() => !isOut && handleAddToCartWithAlert(p)}
                className={`bg-white rounded-2xl border ${isOut ? 'border-pink-50 bg-slate-50 opacity-60 cursor-not-allowed' : 'border-pink-50/60 hover:border-pink-200 hover:scale-[1.02] cursor-pointer shadow-2xs hover:shadow-md'} transition-all p-3.5 flex flex-col h-full`}
              >
                {/* Thumb icon */}
                <div className="aspect-square w-full rounded-xl overflow-hidden bg-slate-50 border border-slate-100 mb-3 flex items-center justify-center text-slate-400 relative">
                  {p.image ? (
                    <img 
                      src={p.image} 
                      alt={p.name} 
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <ShoppingCart className="w-8 h-8 stroke-1" />
                  )}

                  {/* Stock tag overlays */}
                  {isOut ? (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center font-bold text-white text-[11px] gap-1 px-2 text-center leading-tight">
                      <Ban className="w-3.5 h-3.5" />
                      สินค้าหมด
                    </div>
                  ) : isLow ? (
                    <div className="absolute top-1.5 right-1.5 bg-rose-400 text-white rounded-md px-1.5 py-0.5 text-[9px] font-bold flex items-center gap-0.5">
                      ใกล้หมด ({p.stock})
                    </div>
                  ) : (
                    <div className="absolute top-1.5 right-1.5 bg-purple-50 text-purple-700 rounded-md px-1.5 py-0.5 text-[9px] font-mono border border-purple-100/50">
                      สต็อก: {p.stock}
                    </div>
                  )}
                </div>

                {/* Info block */}
                <h5 className="font-semibold text-slate-800 text-xs line-clamp-1 flex-1 leading-relaxed">{p.name}</h5>
                
                <div className="flex items-end justify-between mt-2.5">
                  <span className="text-[9px] text-purple-500 font-medium bg-purple-50 px-1.5 py-0.5 rounded-sm uppercase tracking-wide">
                    {p.unit}
                  </span>
                  <span className="font-bold text-sm text-purple-600 font-mono">
                    ฿{p.price.toLocaleString()}
                  </span>
                </div>

              </div>
            );
          })}

          {filteredProducts.length === 0 && (
            <div className="col-span-full py-16 text-center text-slate-400 text-sm">
              <ShoppingCart className="w-10 h-10 stroke-1 mx-auto mb-2 text-slate-300" />
              ไม่มีสินค้าตรงตามเงื่อนไขที่เลือก
            </div>
          )}
        </div>

      </div>

      {/* RIGHT SECTION: ACTIVE CHECKOUT BASKET / CART PANEL (GRID: 4-5 COLUMNS) */}
      <div className="lg:col-span-5 xl:col-span-4 bg-white rounded-2xl border border-slate-100 shadow-2xs p-5 flex flex-col justify-between max-h-[85vh] overflow-y-auto no-print">
        
        {/* Cart top operations: Member attachment */}
        <div className="space-y-4 flex-1 flex flex-col">
          
          <div className="border-b border-pink-50 pb-4">
            
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-tight flex items-center gap-1.5">
                <User className="w-4 h-4 text-purple-500" />
                สะสมคะแนนลูกค้าสมาชิก
              </span>
              
              {cartMember && (
                <button 
                  onClick={() => setCartMember(null)}
                  className="text-[10px] text-rose-500 font-semibold hover:underline"
                >
                  ถอนแก้
                </button>
              )}
            </div>

            {cartMember ? (
              <div className="bg-purple-50/50 border border-purple-100 p-3 rounded-xl flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-slate-800">{cartMember.name}</span>
                    {cartMember.memberCode && (
                      <span className="inline-block bg-purple-100 text-purple-700 text-[9px] font-mono font-bold px-1 rounded-sm leading-none">
                        {cartMember.memberCode}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">{cartMember.phone}</div>
                </div>
                <div className="bg-purple-100 text-purple-700 px-2 py-1 rounded-lg text-center">
                  <div className="text-[10px] font-bold font-mono">{cartMember.points}</div>
                  <div className="text-[8px] uppercase tracking-wide">แต้มสะสม</div>
                </div>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="ป้อนชื่อ เบอร์โทร หรือรหัสบัตร RF-XXXXX..."
                    value={memberSearch}
                    onChange={(e) => {
                      setMemberSearch(e.target.value);
                      setIsMemberDropdownOpen(true);
                    }}
                    onFocus={() => setIsMemberDropdownOpen(true)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder-slate-400 text-slate-700 focus:outline-hidden"
                  />
                  {memberSearch && (
                    <button 
                      onClick={() => { setMemberSearch(''); setIsMemberDropdownOpen(false); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Dropdown members search suggestion results */}
                {isMemberDropdownOpen && suggestedMembers.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-100 shadow-lg rounded-xl z-30 max-h-40 overflow-y-auto divide-y divide-slate-50">
                    {suggestedMembers.map((m) => (
                      <div
                        key={m.id}
                        onClick={() => {
                          setCartMember(m);
                          setMemberSearch('');
                          setIsMemberDropdownOpen(false);
                        }}
                        className="p-2.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-bold text-slate-700">{m.name}</p>
                            {m.memberCode && (
                              <span className="inline-block bg-purple-50 text-purple-700 border border-purple-100 text-[9px] px-1 rounded-sm font-mono leading-none font-bold">
                                {m.memberCode}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">{m.phone}</p>
                        </div>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-sm font-bold">
                          {m.points} PT
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Checkout items shopping list */}
          <div className="flex-1 overflow-y-auto max-h-[38vh] space-y-3 pr-1">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-tight mb-2 flex items-center gap-1">
              <span>สินค้าในตะกร้า</span>
              <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md text-[9px] font-mono font-bold">
                {cart.reduce((sum, i) => sum + i.quantity, 0)} ชิ้น
              </span>
            </h4>

            {cart.map((item) => (
              <div 
                key={item.product.id}
                className="flex items-center justify-between p-2.5 hover:bg-slate-50 rounded-xl transition border border-dashed border-slate-100 bg-white"
              >
                <div className="flex-1 min-w-0 pr-3">
                  <span className="font-medium text-slate-700 text-xs block truncate leading-tight">
                    {item.product.name}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono block mt-1">
                    ฿{item.product.price} / {item.product.unit}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 p-0.5">
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="p-1 hover:bg-white rounded-md text-slate-500 transition active:scale-95"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span 
                      onClick={() => handleCartQuantityNumpad(item.product.id, item.quantity, item.product.stock)}
                      className="px-2 font-mono text-xs font-black text-purple-600 hover:text-purple-800 hover:bg-purple-100/55 rounded-md min-w-4 text-center cursor-pointer transition-colors"
                      title="กดเพื่อกรอกจำนวนสินค้าด้วยแป้นพิมพ์ตัวเลข"
                    >
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => handleAddToCartWithAlert(item.product)}
                      disabled={item.quantity >= item.product.stock}
                      className="p-1 hover:bg-white rounded-md text-slate-500 transition active:scale-95 disabled:opacity-30"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <span className="font-bold text-xs text-slate-800 font-mono w-14 text-right">
                    ฿{(item.product.price * item.quantity).toLocaleString()}
                  </span>

                  <button
                    onClick={() => updateCartQuantity(item.product.id, 0)}
                    className="p-1 text-slate-300 hover:text-rose-600 rounded-lg transition"
                    title="ลบรายการ"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>
            ))}

            {cart.length === 0 && (
              <div className="text-center py-12 text-slate-300 flex flex-col items-center justify-center">
                <ShoppingCart className="w-8 h-8 stroke-1 mb-2 text-slate-300" />
                <p className="text-xs font-medium">ยังไม่มีสินค้าในตะกร้าชำระเงิน</p>
                <p className="text-[10px] text-slate-400 mt-1">คลิกเลือกรายการซ้ายมือเพื่อทำรายการ</p>
              </div>
            )}

          </div>

        </div>

        {/* Financial calculation & Checkout inputs */}
        <div className="border-t border-slate-100 pt-4 mt-4 space-y-4">
          
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>ราคารวมทั้งสิ้น (Subtotal):</span>
              <span className="font-mono">฿{cartTotals.subtotal.toLocaleString()}</span>
            </div>
            
            {cartMember && cartTotals.pointsEarned > 0 && (
              <div className="flex justify-between text-emerald-600 font-medium">
                <span>คะแนนสะสมที่ลูกค้าได้รับ:</span>
                <span className="font-mono flex items-center gap-0.5">
                  <Sparkles className="w-3 h-3" />
                  +{cartTotals.pointsEarned} แต้ม
                </span>
              </div>
            )}

            <div className="flex justify-between font-bold text-slate-800 text-base pt-2 border-t border-dashed border-slate-100">
              <span>ยอดที่ต้องชำระ (Net):</span>
              <span className="font-mono text-purple-600 text-lg">฿{cartTotals.subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>
          </div>

          <div className="flex gap-2 font-sans">
            
            <button
              onClick={() => {
                Swal.fire({
                  title: 'ยืนยันเพื่อล้างรายการสินค้า?',
                  text: 'คุณต้องการยกเลิกและล้างคิวสินค้าในตะกร้าทั้งหมดทันทีใช่หรือไม่?',
                  icon: 'warning',
                  showCancelButton: true,
                  confirmButtonText: 'ล้างตะกร้า',
                  cancelButtonText: 'ยกเลิก',
                  confirmButtonColor: '#ef4444',
                  cancelButtonColor: '#64748b'
                }).then((result) => {
                  if (result.isConfirmed) {
                    clearCart();
                    Swal.fire({
                      toast: true,
                      position: 'top-end',
                      icon: 'success',
                      title: 'ล้างรายการในตะกร้าเรียบร้อย 🗑️',
                      showConfirmButton: false,
                      timer: 1500,
                      timerProgressBar: true
                    });
                  }
                });
              }}
              disabled={cart.length === 0}
              className="px-3.5 py-3 border border-pink-100 text-slate-550 hover:bg-slate-50 rounded-xl transition-all font-semibold text-xs disabled:opacity-40 whitespace-nowrap cursor-pointer"
            >
              เคลียร์ตะกร้า
            </button>

            <button
              onClick={() => window.print()}
              disabled={cart.length === 0}
              className="px-3.5 py-3 border border-purple-200 text-purple-600 hover:bg-purple-50/40 rounded-xl transition-all font-bold text-xs disabled:opacity-40 flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
              title="พิมพ์ใบรับเงินแบบย่อด่วนชั่วคราวของสินค้าที่เลือก"
            >
              <Printer className="w-4 h-4" />
              พิมพ์บิลย่อ
            </button>

            <button
              onClick={handleOpenPayment}
              disabled={cart.length === 0}
              className="flex-1 py-3 bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 hover:from-pink-500 hover:to-purple-500 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none font-bold text-white rounded-xl transition-all shadow-md text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <CreditCard className="w-4 h-4" />
              รับเงินชำระ
            </button>

          </div>

          {/* Shop custom PromptPay configuration footer */}
          <div className="text-[10px] text-slate-400 text-center border-t border-slate-50 pt-3 relative no-print">
            <span className="hover:text-purple-600 cursor-pointer flex justify-center items-center gap-1" onClick={() => setIsPpConfigOpen(!isPpConfigOpen)}>
              <Settings2 className="w-3 h-3 text-slate-400" />
              เบอร์ PromptPay ปักหมุดชำระ: <strong className="font-mono text-slate-500 hover:underline">{promptPayId}</strong>
            </span>
            
            {isPpConfigOpen && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 p-3 bg-white shadow-xl rounded-xl border border-pink-50 z-40 w-52 flex flex-col gap-1.5 text-left">
                <p className="text-[10px] font-bold text-slate-700">ระบุเลขที่บัญชี / เบอร์ PromptPay ร้าน</p>
                <input 
                  type="text" 
                  defaultValue={promptPayId}
                  id="promptpay-input-node"
                  className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
                <button 
                  onClick={() => {
                    const el = document.getElementById('promptpay-input-node') as HTMLInputElement;
                    savePromptPayId(el?.value || '0812345678');
                  }}
                  className="py-1 bg-purple-500 text-white rounded-lg font-bold text-[9px] hover:bg-purple-600"
                >
                  บันทึกเบอร์ร้านค้า
                </button>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* 3. Modal Layer: Checkout Payment Screen */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 no-print">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-xl w-full overflow-hidden flex flex-col">
            
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-800">ขั้นตอนการชำระเงิน / Payment Gateway</h3>
              <button 
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
              
              {checkoutError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold rounded-xl">
                  {checkoutError}
                </div>
              )}

              {/* Total display highlight */}
              <div className="text-center bg-purple-50/50 py-4 px-2 rounded-2xl border border-pink-50">
                <p className="text-[11px] font-bold text-purple-400 uppercase tracking-widest">ยอดเรียกชำระสุทธิ (Invoice Total)</p>
                <h2 className="text-3xl font-extrabold text-purple-600 font-mono mt-1">
                  ฿{cartTotals.subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}
                </h2>
              </div>

              {/* Toggle Methods selectors */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('Cash')}
                  className={`py-3 px-2 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-[11px] font-bold ${paymentMethod === 'Cash' ? 'border-purple-400 bg-purple-150/50 text-purple-700 shadow-xs' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                >
                  <Coins className="w-5 h-5 text-purple-500" />
                  เงินสด (Cash)
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('QR Code')}
                  className={`py-3 px-2 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-[11px] font-bold ${paymentMethod === 'QR Code' ? 'border-purple-400 bg-purple-150/50 text-purple-700 shadow-xs' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                >
                  <QrCode className="w-5 h-5 text-purple-500" />
                  พร้อมเพย์ QR
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('TrueMoney')}
                  className={`py-3 px-2 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-[11px] font-bold ${paymentMethod === 'TrueMoney' ? 'border-orange-400 bg-orange-50 text-orange-700 shadow-xs' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                >
                  <span className="text-lg">🧡</span>
                  TrueMoney Wallet
                </button>
              </div>

              {/* 1. Cash Checkout parameters options */}
              {paymentMethod === 'Cash' && (() => {
                const numericCashInput = parseFloat(cashInput) || 0;
                const nextFifty = Math.ceil(cartTotals.subtotal / 50) * 50;
                const nextHundred = Math.ceil(cartTotals.subtotal / 100) * 100;

                return (
                  <div className="space-y-4">
                    
                    <div>
                      <div className="flex justify-between mb-1.5 items-center">
                        <label className="block text-xs font-semibold text-slate-500">รับยอดเงินสด (Cash Tendered) *</label>
                        <button 
                          type="button"
                          onClick={handleSetExactCash}
                          className="text-[10px] text-purple-600 font-extrabold hover:underline flex items-center gap-1"
                        >
                          💸 รับพอดีตามยอด (฿{cartTotals.subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})})
                        </button>
                      </div>

                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-lg">฿</span>
                        <input
                          type="text"
                          readOnly
                          placeholder="ระบุจำนวนเงินที่ได้รับจากลูกค้า หรือกดปุ่มแป้นพิมพ์"
                          value={cashInput}
                          onClick={handleCashInputNumpad}
                          className="w-full pl-8 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-base text-slate-700 font-bold focus:outline-hidden focus:ring-2 focus:ring-purple-400 focus:bg-white transition-all shadow-2xs cursor-pointer hover:bg-slate-100"
                        />
                        <button
                          type="button"
                          onClick={handleCashInputNumpad}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-purple-650 transition cursor-pointer"
                          title="เปิดสัมผัสเพื่อระบุยอดเงินที่ได้รับด้วยแป้นพิมพ์ตัวเลข"
                        >
                          <Keyboard className="w-6 h-6 text-slate-400 hover:text-purple-550" />
                        </button>
                      </div>
                    </div>

                    {/* Standard Banknotes (ปุ่มสำหรับรับธนบัตรด่วนเพื่อคำนวณเงินทอน) */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        💵 เลือกธนบัตรรับเงินด่วน (Quick Banknotes)
                      </label>
                      <div className="grid grid-cols-5 gap-2">
                        {[20, 50, 100, 500, 1000].map((note) => {
                          let bgClass = "bg-[#daf2e3] border-[#aee4c5] text-[#1c643b] hover:bg-[#c9ebd6] hover:border-[#8cd7ad]"; // Green Banknote (฿20)
                          if (note === 50) {
                            bgClass = "bg-[#dff0ff] border-[#bfe1ff] text-[#004b93] hover:bg-[#cbe5ff] hover:border-[#9ecfff]"; // Blue Banknote (฿50)
                          } else if (note === 100) {
                            bgClass = "bg-[#ffe2e2] border-[#ffc4c4] text-[#a41a1a] hover:bg-[#ffd1d1] hover:border-[#ffa3a3]"; // Red Banknote (฿100)
                          } else if (note === 500) {
                            bgClass = "bg-[#f4e8ff] border-[#e8ccff] text-[#5b1e9b] hover:bg-[#ecdcff] hover:border-[#d7aefe]"; // Purple Banknote (฿500)
                          } else if (note === 1000) {
                            bgClass = "bg-[#f1efeb] border-[#e2ddd5] text-[#554b3c] hover:bg-[#e7e2d9] hover:border-[#ccc3b3]"; // Grayish Brown Banknote (฿1000)
                          }

                          const isInsufficient = note < cartTotals.subtotal;

                          return (
                            <button
                              key={note}
                              type="button"
                              onClick={() => setCashInput(note.toString())}
                              className={`py-2 rounded-lg border flex flex-col items-center justify-center transition-all duration-150 active:scale-95 ${bgClass} ${isInsufficient ? 'opacity-30' : 'font-semibold shadow-2xs'}`}
                            >
                              <span className="text-[9px] uppercase font-bold tracking-tight opacity-75">แบงก์</span>
                              <span className="text-xs font-black font-mono">฿{note}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Logical rounding shortcuts or increments */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          ➕ บวกยอดเงินสะสม หรือ ปัดเศษเงินทอน
                        </label>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {[10, 20, 50, 100].map((addVal) => (
                          <button
                            key={addVal}
                            type="button"
                            onClick={() => {
                              const current = parseFloat(cashInput) || 0;
                              setCashInput((current + addVal).toString());
                            }}
                            className="flex-1 py-1.5 px-2 border border-slate-200 hover:bg-slate-50 bg-white text-slate-700 rounded-lg text-xs font-mono font-bold transition active:scale-95 flex items-center justify-center gap-1.5 shadow-2xs"
                          >
                            <span>+฿{addVal}</span>
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setCashInput('')}
                          className="px-3 py-1.5 border border-rose-200 hover:bg-rose-50 bg-white text-rose-600 rounded-lg text-xs font-bold transition active:scale-95 shadow-2xs"
                        >
                          ล้างค่า
                        </button>
                      </div>

                      {/* Intelligent shortcuts */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        {nextFifty > cartTotals.subtotal && nextFifty !== nextHundred && (
                          <button
                            type="button"
                            onClick={() => setCashInput(nextFifty.toString())}
                            className="py-1.5 px-3 bg-purple-50/70 hover:bg-purple-100/70 border border-purple-100 text-purple-700 rounded-lg text-[11px] font-bold flex justify-between items-center transition"
                          >
                            <span>ปัดยอดจ่ายหลักสิบ (฿{nextFifty})</span>
                            <span className="font-mono text-[9px] opacity-80 font-normal">ทอน ฿{(nextFifty - cartTotals.subtotal).toFixed(2)}</span>
                          </button>
                        )}
                        {nextHundred > cartTotals.subtotal && (
                          <button
                            type="button"
                            onClick={() => setCashInput(nextHundred.toString())}
                            className="py-1.5 px-3 bg-indigo-50/70 hover:bg-indigo-100/70 border border-indigo-100 text-indigo-700 rounded-lg text-[11px] font-bold flex justify-between items-center transition col-span-2 sm:col-span-1"
                          >
                            <span>ปัดยอดจ่ายหลักร้อย (฿{nextHundred})</span>
                            <span className="font-mono text-[9px] opacity-80 font-normal">ทอน ฿{(nextHundred - cartTotals.subtotal).toFixed(2)}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Calculations status and change indicator */}
                    {cashInput && (
                      <div className="pt-2 border-t border-slate-100/80">
                        {numericCashInput < cartTotals.subtotal ? (
                          <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center justify-between text-xs text-rose-600 font-semibold">
                            <span>ยอดเงินสดขาดอีก (Still Owed)</span>
                            <span className="font-mono font-bold text-sm">
                              -฿{(cartTotals.subtotal - numericCashInput).toLocaleString(undefined, {minimumFractionDigits: 2})}
                            </span>
                          </div>
                        ) : numericCashInput === cartTotals.subtotal ? (
                          <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-between text-xs text-emerald-800 font-bold">
                            <span className="flex items-center gap-1">🎉 รับเงินพอดีตามยอด</span>
                            <span className="font-mono text-sm text-emerald-600">ไม่ต้องทอนเงิน</span>
                          </div>
                        ) : (
                          <div className="p-3.5 bg-emerald-500 border border-[#10b981] rounded-xl flex items-center justify-between shadow-xs text-white">
                            <span className="text-xs font-bold flex items-center gap-1.5">
                              <span>💰</span> เงินทอนลูกค้า (Change Amount)
                            </span>
                            <span className="font-mono font-black text-xl tracking-tight">
                              ฿{changeAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                );
              })()}

              {/* 2. QR Code EMVCo PromptPay Visualizer Display block */}
              {paymentMethod === 'QR Code' && (
                <div className="flex flex-col items-center py-4 px-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                  
                  {/* Outer PromptPay badge card mockup */}
                  <div className="bg-[#0c3167] text-white py-2 px-10 rounded-xl font-bold flex flex-col items-center w-full max-w-xs text-center shadow-xs">
                    <span className="text-[10px] uppercase tracking-widest font-normal opacity-85">THAI SCAN TO PAY</span>
                    <h4 className="text-sm font-semibold tracking-wide">Prompt Pay</h4>
                  </div>

                  {/* QR Image fetching */}
                  <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center">
                    {promptPayIdInput ? (
                      <img 
                        src={getPromptPayQRUrl(promptPayIdInput, parseFloat(qrAmountInput) || 0)} 
                        alt="PromptPay Scan" 
                        referrerPolicy="no-referrer"
                        className="w-44 h-44 object-contain"
                      />
                    ) : (
                      <div className="w-44 h-44 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 text-slate-400 text-center text-[11px] px-3 font-semibold">
                        กรุณาระบุเลขพร้อมเพย์เพื่อสร้าง QR Code
                      </div>
                    )}
                    <div className="mt-3 text-center border-t border-slate-50 pt-2 w-full">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ยอดที่นำไปสร้างรหัส QR (QR Amount)</p>
                      <p className="text-xl font-extrabold text-[#0c3167] font-mono">
                        ฿{(parseFloat(qrAmountInput) || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </p>
                    </div>
                  </div>

                  {/* Inputs and custom controls */}
                  <div className="w-full max-w-sm space-y-4 bg-white p-4 rounded-xl border border-slate-100 shadow-2xs">
                    
                    {/* PromptPay ID Input */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        1. บัญชี / เบอร์ PromptPay ร้านค้า
                      </label>
                      <input 
                        type="text" 
                        value={promptPayIdInput}
                        onChange={(e) => setPromptPayIdInput(e.target.value.replace(/[^0-9\-]/g, ""))}
                        placeholder="เบอร์โทร 10 หลัก หรือ เลขประชาชน 13 หลัก"
                        className="w-full text-center py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-[#0c3167] focus:bg-white"
                      />
                    </div>

                    {/* QR Amount Input */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          2. ระบุยอดที่ต้องการชำระ (฿)
                        </label>
                        {parseFloat(qrAmountInput) !== cartTotals.subtotal && (
                          <button
                            type="button"
                            onClick={() => setQrAmountInput(cartTotals.subtotal.toString())}
                            className="text-[10px] text-purple-600 font-extrabold hover:underline"
                          >
                            ใช้ยอดเต็มบิล (฿{cartTotals.subtotal.toLocaleString()})
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold font-mono">฿</span>
                        <input 
                          type="text" 
                          readOnly
                          value={qrAmountInput}
                          onClick={handleQrAmountInputNumpad}
                          placeholder="0.00"
                          className="w-full text-center py-2 pl-7 pr-10 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-[#0c3167] focus:bg-white text-slate-800 cursor-pointer hover:bg-slate-100"
                        />
                        <button
                          type="button"
                          onClick={handleQrAmountInputNumpad}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-purple-650 transition cursor-pointer"
                          title="เปิดสัมผัสเพื่อระบุยอดจ่ายพร้อมเพย์ด้วยแป้นพิมพ์ตัวเลข"
                        >
                          <Keyboard className="w-5 h-5 text-slate-400 hover:text-purple-550" />
                        </button>
                      </div>
                    </div>

                    <div className="pt-1 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setQrAmountInput(cartTotals.subtotal.toString())}
                        className="flex-1 py-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition-colors"
                      >
                        ยอดเต็มบิล
                      </button>
                      <button
                        type="button"
                        onClick={() => setQrAmountInput((Math.floor(cartTotals.subtotal / 2)).toString())}
                        className="flex-1 py-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition-colors"
                      >
                        แบ่งจ่ายครึ่งหนึ่ง
                      </button>
                      <button
                        type="button"
                        onClick={() => setQrAmountInput((cartTotals.subtotal + 20).toString())}
                        className="flex-1 py-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition-colors"
                      >
                        บวกค่าส่ง ฿20
                      </button>
                    </div>

                    <div className="text-[10px] text-slate-400 text-center leading-relaxed border-t border-slate-50 pt-2.5">
                      * ระบบจะคำนวณรหัสพร้อมเพย์สำหรับสแกนอัตโนมัติตามมาตรฐาน EMVCo เมื่อสแกนในธนาคารยอดจะเด้งขึ้นมาทันทีโดยไม่ต้องใส่ยอดเงินเอง
                    </div>

                  </div>

                </div>
              )}

              {/* 3. TrueMoney Wallet Display block */}
              {paymentMethod === 'TrueMoney' && (
                <div className="space-y-4">
                  <div className="flex flex-col items-center py-4 px-6 bg-orange-50/40 rounded-2xl border border-orange-100 space-y-4">
                    
                    {/* TrueMoney Brand Header */}
                    <div className="bg-[#ff8200] text-white py-2 px-10 rounded-xl font-bold flex flex-col items-center w-full max-w-xs text-center shadow-xs">
                      <span className="text-[10px] uppercase tracking-widest font-normal opacity-95">E-WALLET PAYMENT</span>
                      <h4 className="text-sm font-extrabold tracking-wide">TrueMoney Wallet</h4>
                    </div>

                    {/* Simulation Panel Card */}
                    <div className="bg-white p-4 rounded-xl border border-orange-150 w-full max-w-sm space-y-3.5">
                      <div className="text-center">
                        <p className="text-[11px] font-bold text-slate-400">ยอดเงินที่ต้องชำระผ่าน Wallet</p>
                        <p className="text-2xl font-black text-[#ff8200] font-mono mt-0.5">
                          ฿{cartTotals.subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-600">เบอร์บัญชีทรูมันนี่ร้านค้า (สำหรับตรวจสอบ/โยนยอด)</label>
                        <input 
                          type="text" 
                          value={trueMoneyPhoneInput}
                          onChange={(e) => setTrueMoneyPhoneInput(e.target.value.replace(/[^0-9]/g, ""))}
                          placeholder="กรอกเบอร์วอลเล็ท 10 หลัก"
                          className="w-full text-center py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-[#ff8200] focus:outline-hidden focus:ring-2 focus:ring-[#ff8200]"
                        />
                      </div>

                      <div className="bg-orange-50 text-orange-850 p-2 text-[10px] text-center rounded-lg font-medium leading-relaxed">
                        ⚠️ หน้าจำลองสำหรับ POS เมื่อลูกค้ายอมรับการโอนเงินหรือสแกนหักจากแอพ TrueMoney เรียบร้อยแล้ว กรุณากดปุ่ม <strong>"ยืนยันการชำระเงินผ่าน Wallet จำลอง"</strong> เพื่อทำการบันทึกยอดเข้าระบบทันที
                      </div>
                    </div>
                  </div>

                  {/* Production Developer API Integration Guide Accordion */}
                  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                    <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                      <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                        ⚙️ คู่มือการเชื่อมระบบ TrueMoney API ต่อยอดสู่โปรดักชันจริง (Developer Guide)
                      </span>
                    </div>
                    <div className="p-4 text-xs space-y-4 max-h-60 overflow-y-auto leading-relaxed text-slate-600">
                      <div>
                        <h5 className="font-bold text-slate-800 text-xs mb-1">1. เลือกเชื่อมต่อผ่าน Payment Gateway ได้รับอนุญาต</h5>
                        <p className="pl-3">
                          หากต้องการตัดยอดเงินจากกระเป๋าลูกค้าระดับทางการ สามารถเลือกเชื่อมต่อผ่านพอร์ทัลดังนี้:
                          <br />• <strong>Opn Payments (Omise)</strong> - แนะนำหลัก สมัครใช้ได้ง่ายครอบคลุมเอกสารเกตเวย์
                          <br />• <strong>GB Prime Pay</strong> - ค่าบริการร้อยละถูก ซัพพอร์ตไทยดีมาก
                          <br />• <strong>2C2P / Omise API</strong> - เหมาะกับรูปแบบแฟรนไชส์ขนาดใหญ่
                        </p>
                      </div>

                      <div>
                        <h5 className="font-bold text-slate-800 text-xs mb-1">2. ตรวจสอบขั้นตอน Client-Side Source Creation (บนแท็บเล็ต POS)</h5>
                        <p className="pl-3">
                          ส่งยอดไปยัง Tokenizer Gateway API เพื่อหักเงินแบบ Dynamic Charge จากเบอร์ลูกค้า:
                        </p>
                        <pre className="mt-2 p-2 bg-slate-900 text-slate-200 rounded-xl font-mono text-[9px] overflow-x-auto">
{`Omise.createSource('truemoney', {
  amount: ${cartTotals.subtotal} * 100, // แปลงเป็นหน่วยสตางค์ (เช่น 100 บาท => 10000 สตางค์)
  currency: 'thb',
  phone_number: '${trueMoneyPhoneInput || '0812345678'}'
}, function(statusCode, response) {
  if (response.object === 'source') {
    // โยน source.id เพื่อเรียก Charge ผ่าน Backend ของคุณอย่างปลอดภัย
    apiCallToYourBackend(response.id);
  }
});`}
                        </pre>
                      </div>

                      <div>
                        <h5 className="font-bold text-slate-800 text-xs mb-1">3. ติดตั้งโค้ดเรียกเก็บเงินในเซิร์ฟเวอร์ Backend (Express Handler)</h5>
                        <p className="pl-3">
                          รับ Token มาจากหน้าร้านค้าด้านบนแล้วยิงแจ้งเตือนเด้งรับเงินในเกตเวย์:
                        </p>
                        <pre className="mt-2 p-2 bg-slate-900 text-slate-200 rounded-xl font-mono text-[9px] overflow-x-auto">
{`// API Route: POST /api/payments/truemoney
import omise from 'omise';
const omiseClient = omise({ publicKey: 'pkey_test_...', secretKey: 'skey_test_...' });

app.post('/api/payments/truemoney', async (req, res) => {
  const { sourceId, amount, invoiceId } = req.body;
  try {
    const charge = await omiseClient.charges.create({
      amount: amount * 100,
      currency: 'thb',
      source: sourceId,
      return_uri: 'https://myshop.com/payment/verify?invoice=' + invoiceId
    });
    // โอนย้ายลูกค้าเพื่อกรอกรหัสและกดยินยอมตัดเงินในแอพ TrueMoney
    res.json({ authorize_uri: charge.authorize_uri, status: charge.status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});`}
                        </pre>
                      </div>

                      <div>
                        <h5 className="font-bold text-slate-800 text-xs mb-1">4. การตั้งค่า Webhook เพื่อปรับการชำระเงินอัตโนมัติ</h5>
                        <p className="pl-3">
                          เซิฟเวอร์เกตเวย์จะกวักมือเรียกมายังเซิร์ฟเวอร์ของคุณทันทีที่ยืนยันรหัส OTP และตัดเงินผ่าน TrueMoney วอลเล็ทสำเร็จ:
                        </p>
                        <pre className="mt-2 p-2 bg-slate-900 text-slate-200 rounded-xl font-mono text-[9px] overflow-x-auto">
{`app.post('/api/webhooks/truemoney', (req, res) => {
  const payload = req.body;
  if (payload.key === 'charge.complete' && payload.data.status === 'successful') {
    const source = payload.data.source;
    if (source && source.type === 'truemoney') {
      // 1. ค้นหาบิลเลขที่ใบเสร็จสินค้าในฐานข้อมูล
      // 2. อัพเดตชำระเงินเรียบร้อย "Paid via TrueMoney Wallet"
      // 3. หักสินค้าในคลัง พิมพ์ใบรับเงิน และสะสมแต้มสมาชิก
      console.log('หักชำระทรูมันนี่สำเร็จ: ', source.phone_number);
    }
  }
  res.sendStatus(200);
});`}
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Bottom Checkout Actions */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex gap-2">
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl transition text-sm font-medium"
              >
                ย้อนกลับ
              </button>
              <button
                onClick={handleConfirmPayment}
                disabled={isProcessingCheckout || (paymentMethod === 'Cash' && (!cashInput || parseFloat(cashInput) < cartTotals.subtotal)) || (paymentMethod === 'TrueMoney' && trueMoneyPhoneInput.length < 10)}
                className="flex-1 py-2.5 bg-gradient-to-r from-pink-400 to-purple-400 hover:from-pink-500 hover:to-purple-500 disabled:opacity-40 text-white font-bold rounded-xl transition shadow-md flex items-center justify-center gap-2 text-sm"
              >
                <Check className="w-4 h-4" />
                {paymentMethod === 'Cash' ? 'ยืนยันรับค่าเงินสด' : paymentMethod === 'TrueMoney' ? 'ยืนยันการชำระเงินผ่าน Wallet จำลอง' : 'จำลองการชำระเงินผ่าน QR สำเร็จ'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 4. Complete Order thermal receipt popup presentation */}
      {lastCompletedSale && (
        <BillingReceiptModal 
          sale={lastCompletedSale} 
          onClose={() => setLastCompletedSale(null)} 
        />
      )}

      {/* 5. Device Camera-based Barcode Scanner Modal with synthetic audio feedback */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        products={products}
        onProductScanned={handleAddToCartWithAlert}
      />

      {/* 6. Active Cart Instant Thermal Receipt (Print-Only) */}
      {cart.length > 0 && (
        <div className="print-only fixed inset-0 bg-white z-999 p-6 font-mono text-xs leading-relaxed text-black">
          <div className="w-full max-w-[58mm] mx-auto text-stone-900">
            {/* Header */}
            <div className="text-center mb-4 pb-4 border-b border-dashed border-stone-400">
              <h2 className="font-extrabold text-xs uppercase tracking-tight">THAI STORE & POS</h2>
              <p className="text-[10px] text-stone-500 mt-0.5">ใบแสดงรายการสินค้าที่เลือก</p>
              <p className="text-[9px] text-stone-400">พิมพ์วันที่: {new Date().toLocaleString('th-TH')}</p>
            </div>
            
            {/* Document details / Member information */}
            <div className="mb-3 space-y-0.5 text-[10px] text-stone-600">
              <div><strong>ประเภทเอกสาร:</strong> ใบเสร็จแบบย่อ (Thermal Receipt) / ชั่วคราว</div>
              {cartMember && (
                <div className="border-t border-stone-200 pt-1 mt-1 font-sans">
                  <strong>สมาชิก:</strong> {cartMember.name}
                  <div className="text-[9px] font-mono text-stone-500">เบอร์โทร: {cartMember.phone}</div>
                </div>
              )}
            </div>

            {/* Selected items table style */}
            <table className="w-full text-left mb-4 border-t border-b border-dashed border-stone-400 py-1.5 text-[10px]">
              <thead>
                <tr className="font-bold text-stone-500">
                  <th className="py-0.5">รายการ</th>
                  <th className="text-right py-0.5">จำนวน</th>
                  <th className="text-right py-0.5">รวม (฿)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dotted divide-stone-300 font-sans">
                {cart.map((item, idx) => (
                  <tr key={idx} className="font-sans">
                    <td className="py-1">
                      <span className="font-medium text-stone-800 text-[10px]">{item.product.name}</span>
                      <div className="text-[9px] font-mono text-slate-400">@{item.product.price} / {item.product.unit}</div>
                    </td>
                    <td className="text-right py-1 font-mono text-[10px]">{item.quantity}</td>
                    <td className="text-right py-1 font-mono text-[10px]">{(item.product.price * item.quantity).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Calculations summaries */}
            <div className="space-y-1 text-[10px]">
              <div className="flex justify-between font-bold border-b border-dashed border-stone-300 pb-1.5 text-stone-800">
                <span>ยอดรวมทั้งสิ้น (Total):</span>
                <span>฿{cartTotals.subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              </div>
              {cartMember && cartTotals.pointsEarned > 0 && (
                <div className="flex justify-between text-emerald-700 font-sans font-semibold pt-1">
                  <span>คะแนนสะสมที่จะได้รับ:</span>
                  <span>+{cartTotals.pointsEarned} แต้ม</span>
                </div>
              )}
            </div>

            {/* Footnotes */}
            <div className="text-center mt-6 pt-3 border-t border-dashed border-stone-300 text-[9px] text-stone-400">
              <p>ขอบคุณที่เลือกช้อป / THANK YOU</p>
              <p className="mt-0.5">ระบบร้านค้า {settings?.nameEng || 'Thai Store & POS'} ({settings?.nameThai || 'ระบบบริหารหน้าร้าน คลังพัสดุและฐานสมาชิก'})</p>
            </div>
          </div>
        </div>
      )}

      {/* 7. Low Stock Alerts Modal (Reorder Point warning notification) */}
      {lowStockAlertProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-55 flex items-center justify-center p-4 animate-fade-in no-print bg-opacity-70">
          <div className="bg-white rounded-3xl max-w-md w-full border border-pink-50 shadow-2xl p-6 relative overflow-hidden transform transition-all duration-300 scale-100">
            
            {/* Top decorative gradient bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-rose-400 to-pink-500" />
            
            <button 
              onClick={() => setLowStockAlertProduct(null)}
              className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              title="ปิดการแจ้งเตือน"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-start gap-4.5 mt-1.5 font-sans">
              <div className="p-3 bg-amber-50 text-amber-500 rounded-2xl border border-amber-100 shadow-2xs shrink-0">
                <AlertTriangle className="w-5.5 h-5.5 animate-pulse" />
              </div>
              
              <div className="space-y-1 flex-1 min-w-0">
                <span className="text-[10px] font-bold tracking-wider uppercase text-amber-600 bg-amber-50 border border-amber-100/50 px-2 py-0.5 rounded-md select-none inline-block">
                  สต็อกเตือนระดับต่ำ (Reorder Warning)
                </span>
                <h3 className="font-extrabold text-sm text-slate-800 leading-snug">
                  สินค้าใกล้ถึงจุดต่ำสุดที่กำหนดไว้
                </h3>
              </div>
            </div>

            {/* Alert Details Card info */}
            <div className="bg-slate-50/70 border border-pink-50/20 rounded-2xl p-4 mt-4 space-y-3 font-sans">
              <div className="flex items-center gap-2.5">
                {lowStockAlertProduct.product.image ? (
                  <img 
                    src={lowStockAlertProduct.product.image} 
                    alt={lowStockAlertProduct.product.name} 
                    className="w-10 h-10 object-cover rounded-lg border border-slate-200" 
                  />
                ) : (
                  <div className="w-10 h-10 bg-white border border-pink-50 rounded-lg flex items-center justify-center text-slate-400">
                    <Boxes className="w-5 h-5 stroke-1" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 truncate">{lowStockAlertProduct.product.name}</p>
                  <p className="text-[10px] text-slate-450 font-mono mt-0.5">หมวดหมู่: {lowStockAlertProduct.product.category || 'ทั่วไป'}</p>
                </div>
              </div>

              {/* Dynamic Warning text */}
              <p className="text-xs text-slate-600 leading-relaxed">
                การหยิบสินค้าชิ้นนี้ใส่ตะกร้า (จำนวน <strong className="font-semibold text-purple-700 font-mono">{lowStockAlertProduct.nextQty}</strong> {lowStockAlertProduct.product.unit}) จะทำให้เหลือสต็อกขายได้ลดลงเหลือ <strong className="text-rose-600 font-mono font-bold text-sm bg-rose-50/50 px-1.5 py-0.5 rounded-md">{lowStockAlertProduct.remainingStock}</strong> {lowStockAlertProduct.product.unit} ซึ่ง <strong>น้อยกว่าหรือเท่ากับจุดต่ำสุด</strong> (<strong className="font-mono">{lowStockAlertProduct.product.safetyStock}</strong> {lowStockAlertProduct.product.unit}) ที่ทางร้านกำหนดไว้
              </p>

              {/* Compare status stats */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-dashed border-slate-200">
                <div className="p-2 bg-white rounded-xl border border-slate-150">
                  <p className="text-[9px] font-bold text-slate-400 uppercase font-sans">สต็อกทั้งหมดขณะนี้</p>
                  <p className="text-xs font-black font-mono text-slate-700 mt-0.5">{lowStockAlertProduct.product.stock} {lowStockAlertProduct.product.unit}</p>
                </div>
                <div className="p-2 bg-white rounded-xl border border-slate-150">
                  <p className="text-[9px] font-bold text-slate-400 uppercase font-sans">จุดสั่งซื้อเพิ่ม (Reorder)</p>
                  <p className="text-xs font-black font-mono text-purple-600 mt-0.5">{lowStockAlertProduct.product.safetyStock} {lowStockAlertProduct.product.unit}</p>
                </div>
              </div>
            </div>

            {/* Hint text bottom */}
            <p className="text-[10px] text-slate-400 text-center mt-3 font-sans">
              * ระบบสามารถดำเนินการขายได้ปกติ โปรดตรวจสอบเพื่อดำเนินการเติมสินค้าต่อไป
            </p>

            {/* Action buttons */}
            <div className="mt-4 font-sans">
              <button
                onClick={() => setLowStockAlertProduct(null)}
                className="w-full py-2.5 bg-gradient-to-r from-amber-400 to-rose-400 hover:from-amber-500 hover:to-rose-500 text-white font-bold text-xs rounded-xl transition duration-150 cursor-pointer shadow-xs text-center"
              >
                รับทราบและขายสินค้าต่อ
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
