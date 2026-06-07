import React, { useEffect, useRef, useState } from 'react';
import { 
  X, Barcode, Volume2, VolumeX, Keyboard, ShoppingBag, 
  Usb, Wifi, CheckCircle, AlertTriangle, Zap, ShoppingCart
} from 'lucide-react';
import { Product } from '../types';
import { usePos } from '../context/PosContext';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onProductScanned: (product: Product) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  products,
  onProductScanned
}) => {
  const { settings } = usePos();
  const themeAccentColor = settings?.themeColor || 'purple';
  
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [scannerMode, setScannerMode] = useState<'USB' | 'Wireless'>('USB');
  const [barcodeInput, setBarcodeInput] = useState('');
  
  const [lastScanned, setLastScanned] = useState<{
    product?: Product;
    barcode: string;
    success: boolean;
    timestamp: number;
  } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const lastScannedCodeRef = useRef<string>('');
  const lastScannedTimeRef = useRef<number>(0);

  // Play synthesized web audio beep feedback
  const playScanBeep = (isSuccess: boolean) => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      if (isSuccess) {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // crisp high beep (A5)
        gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.12);
        oscillator.stop(audioCtx.currentTime + 0.12);
      } else {
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(220, audioCtx.currentTime); // low alert buzz
        gainNode.gain.setValueAtTime(0.06, audioCtx.currentTime);
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.2);
        oscillator.stop(audioCtx.currentTime + 0.2);
      }
    } catch (e) {
      console.warn("AudioContext beep failed", e);
    }
  };

  // Keep input focused automatically so it always captures physical scanner wedge inputs
  useEffect(() => {
    if (!isOpen) return;

    setBarcodeInput('');
    setLastScanned(null);
    lastScannedCodeRef.current = '';
    lastScannedTimeRef.current = 0;

    const focusInput = () => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    };

    // Initial focus
    const timer = setTimeout(focusInput, 150);

    // Continuous refocus check interval (if user clicks away, pull focus back!)
    const interval = setInterval(() => {
      if (document.activeElement !== inputRef.current) {
        focusInput();
      }
    }, 800);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [isOpen]);

  // Handle incoming barcode string
  const handleProcessBarcode = (barcode: string) => {
    const cleanBarcode = barcode.trim();
    if (!cleanBarcode) return;

    const rightNow = Date.now();
    // Anti-bounce filter (prevent runaway physical multi-scans of exact same tag within 1.2s)
    if (cleanBarcode === lastScannedCodeRef.current && (rightNow - lastScannedTimeRef.current) < 1200) {
      setBarcodeInput('');
      return;
    }

    lastScannedCodeRef.current = cleanBarcode;
    lastScannedTimeRef.current = rightNow;

    const matchedProduct = products.find(p => p.barcode === cleanBarcode || p.id === cleanBarcode);

    if (matchedProduct) {
      onProductScanned(matchedProduct);
      playScanBeep(true);
      setLastScanned({
        product: matchedProduct,
        barcode: cleanBarcode,
        success: true,
        timestamp: rightNow
      });
    } else {
      playScanBeep(false);
      setLastScanned({
        barcode: cleanBarcode,
        success: false,
        timestamp: rightNow
      });
    }

    setBarcodeInput('');
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (barcodeInput.trim()) {
      handleProcessBarcode(barcodeInput);
    }
  };

  if (!isOpen) return null;

  // Set colors based on chosen workspace theme preset
  const isPurple = themeAccentColor === 'purple';
  const isPink = themeAccentColor === 'pink';
  const isBlue = themeAccentColor === 'blue';
  const isEmerald = themeAccentColor === 'emerald';
  const isOrange = themeAccentColor === 'orange';

  const primaryBtnTextHex = isPink ? '#4c0519' : isBlue ? '#081e51' : isEmerald ? '#022c22' : isOrange ? '#431407' : '#2e004f';
  const primaryBgHex = isPink ? '#f472b6' : isBlue ? '#38bdf8' : isEmerald ? '#34d399' : isOrange ? '#fb923c' : '#c084fc';
  const primaryHoverHex = isPink ? '#ec4899' : isBlue ? '#0ea5e9' : isEmerald ? '#10b981' : isOrange ? '#f97316' : '#a855f7';
  const lightAccentHex = isPink ? '#fff1f2' : isBlue ? '#f0f9ff' : isEmerald ? '#f0fdf4' : isOrange ? '#fff7ed' : '#faf5ff';

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto no-print">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col relative animate-scale-in font-sans">
        
        {/* Dynamic flat color indicator on top */}
        <div className="h-2 w-full" style={{ backgroundColor: primaryBgHex }} />

        {/* Header Controls */}
        <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl text-white" style={{ backgroundColor: `${primaryBgHex}30` }}>
              <Barcode className="w-5 h-5" style={{ color: primaryBgHex }} />
            </div>
            <div>
              <h3 className="font-extrabold text-sm tracking-tight">โหมดเชื่อมต่อเครื่องยิงบาร์โค้ด</h3>
              <p className="text-[10px] text-slate-400">สแกนรวดเร็วผ่านสาย USB & สัญญาณ Wireless</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle sound beep setting */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${soundEnabled ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' : 'border-slate-800 text-slate-500 hover:text-slate-400'}`}
              title={soundEnabled ? "ปิดเสียงตอบรับสแกน" : "เปิดเสียงตอบรับสแกน"}
            >
              {soundEnabled ? <Volume2 className="w-4.5 h-4.5" /> : <VolumeX className="w-4.5 h-4.5" />}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 border border-slate-850 hover:bg-slate-800 text-slate-450 hover:text-white rounded-xl transition-all cursor-pointer"
              title="ปิดโหมดสแกน"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

        {/* Hardware scan beam standby animation (No Camera!) */}
        <div className="relative bg-slate-950 w-full min-h-[180px] flex flex-col items-center justify-center overflow-hidden p-6 text-center select-none">
          
          {/* Subtle grid background to simulate radar radar scanner */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:24px_24px] opacity-15" />
          
          {/* Active laser swipe overlay */}
          <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-[50%] bg-gradient-to-r from-red-500/0 via-red-500/12 to-red-500/0 flex items-center justify-center pointer-events-none">
            <div className="w-full h-0.5 bg-red-500 shadow-[0_0_12px_#ef4444] animate-laser-sweep" />
          </div>

          {/* Radar indicator based on active mode */}
          <div className="relative z-10 flex flex-col items-center space-y-3.5">
            {/* Connection technology switch buttons (Aesthetic & practical) */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1.5 rounded-2xl">
              <button
                type="button"
                onClick={() => setScannerMode('USB')}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black tracking-wider flex items-center gap-1 transition-all cursor-pointer ${scannerMode === 'USB' ? 'bg-slate-850 text-white' : 'text-slate-500 hover:text-slate-350'}`}
              >
                <Usb className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                USB CABLE
              </button>
              <button
                type="button"
                onClick={() => setScannerMode('Wireless')}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black tracking-wider flex items-center gap-1 transition-all cursor-pointer ${scannerMode === 'Wireless' ? 'bg-slate-850 text-white' : 'text-slate-500 hover:text-slate-350'}`}
              >
                <Wifi className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                WIRELESS DONGLE / BT
              </button>
            </div>

            {/* Glowing Pulse status ring */}
            <div className="w-16 h-16 rounded-full flex items-center justify-center border border-slate-700/50 bg-slate-900 relative">
              <div 
                className="absolute inset-0 rounded-full animate-ping opacity-25" 
                style={{ backgroundColor: primaryBgHex }} 
              />
              <Zap className="w-7 h-7 animate-pulse text-amber-400" />
            </div>

            <div>
              <p className="text-xs font-black text-white tracking-wide uppercase">
                {scannerMode === 'USB' ? 'สแตนด์บายรับสัญญาณ USB Wedge...' : 'สแตนด์บายรับสัญญาณ Wireless Bluetooth...'}
              </p>
              <p className="text-[10px] text-slate-400 mt-1 max-w-xs mx-auto">
                ตัวเชื่อมต่อจำลองการพิมพ์ (Keyboard wedge) จับคู่สำเร็จ ยิงเลเซอร์สแกนสินค้าตัวจริงได้ทันที
              </p>
            </div>
          </div>

          {/* Hidden autofocus input buffer */}
          <form onSubmit={handleFormSubmit} className="absolute bottom-2 left-0 right-0 px-6 z-20">
            <div className="relative max-w-xs mx-auto">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-500 uppercase tracking-widest pointer-events-none select-none">BUFFER</span>
              <input
                ref={inputRef}
                type="text"
                placeholder="คลิกที่นี่หากต้องการพิมพ์รหัสคีย์มือแทนการยิง"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-center py-1.5 pl-14 pr-3 rounded-lg text-xs leading-none font-mono focus:outline-hidden focus:border-slate-650 transition-colors"
                autoComplete="off"
              />
            </div>
          </form>
        </div>

        {/* Dynamic sweep animation */}
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes hardwareLaser {
            0% { transform: translateY(-70px); opacity: 0.2; }
            50% { transform: translateY(70px); opacity: 1; }
            100% { transform: translateY(-70px); opacity: 0.2; }
          }
          .animate-laser-sweep {
            animation: hardwareLaser 2s infinite ease-in-out;
          }
        `}} />

        {/* Live Feedback Logs Panel */}
        <div className="p-5 space-y-3.5 bg-slate-950/80">
          
          {lastScanned ? (
            <div className={`p-4 rounded-2xl flex items-center gap-3 border transition-all ${
              lastScanned.success 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 font-sans' 
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400 font-sans'
            }`}>
              
              <div className="shrink-0">
                {lastScanned.success ? (
                  <div className="p-1.5 bg-emerald-500/15 rounded-full border border-emerald-500/30">
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                  </div>
                ) : (
                  <div className="p-1.5 bg-rose-500/15 rounded-full border border-rose-500/30">
                    <AlertTriangle className="w-5 h-5 text-rose-400 animate-pulse" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                {lastScanned.success ? (
                  <>
                    <h5 className="text-xs font-bold text-white leading-snug truncate">
                      ยิงสำเร็จ: {lastScanned.product?.name}
                    </h5>
                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400 font-medium">
                      <span className="font-mono px-1.5 py-0.5 rounded-md font-bold text-white" style={{ backgroundColor: `${primaryBgHex}35` }}>
                        ฿{lastScanned.product?.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                      <span>รหัสยิง: {lastScanned.barcode}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <h5 className="text-xs font-bold text-slate-100">
                      ไม่พบรหัสบาร์โค้ดนี้ในฐานข้อมูลคลัง
                    </h5>
                    <p className="text-[10px] text-rose-300 mt-1">
                      รหัสสแกนที่จับได้: <strong className="font-mono text-white bg-rose-500/20 px-1 py-0.5 rounded">{lastScanned.barcode}</strong> (คุณสามารถลงทะเบียนสินค้านี้เพิ่มได้ในแท็บสินค้า)
                    </p>
                  </>
                )}
              </div>

              {lastScanned.success && (
                <div className="shrink-0 bg-slate-900 border border-slate-800 text-slate-300 text-[9px] px-2.5 py-1.5 rounded-xl font-bold flex flex-col items-center">
                  <ShoppingBag className="w-3.5 h-3.5 mb-0.5" style={{ color: primaryBgHex }} />
                  <span>+1 ชิ้น</span>
                </div>
              )}

            </div>
          ) : (
            <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/40 text-slate-500 text-xs text-center flex flex-col items-center justify-center py-6 space-y-1.5">
              <ShoppingCart className="w-6 h-6 text-slate-700" />
              <p className="font-bold text-slate-400 text-[11px] uppercase tracking-wider">พร้อมสำหรับการยิงเลเซอร์</p>
              <p className="text-[10px] text-slate-500 max-w-xs leading-relaxed">
                เมื่อกดสแกนจากเครื่องอ่านพาร์ทเนอร์ ตัวอักษรจะอ่านเข้ารถเข็นหน้าร้านโดยอัตโนมัติ พร้อมส่งสัญญาณสั่นและบี๊บเสียงตอบรับแบบเรียลไทม์
              </p>
            </div>
          )}

          {/* Multi Scan helper instruction */}
          <div className="flex justify-between items-center text-[10px] text-slate-500 border-t border-slate-850 pt-3">
            <span className="flex items-center gap-1 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full animate-ping" style={{ backgroundColor: primaryBgHex }} />
              เครื่องยิงเชื่อมโยงแล้ว (Hardware Mode Active)
            </span>
            <span>กดปิดหน้าต่างเพื่อแสดงสรุปบิลตะกร้า</span>
          </div>

        </div>

        {/* Lower interactive manual emulator widget (No Gradients, High Contrast!) */}
        <div className="px-6 py-4 bg-slate-900 border-t border-slate-800/80 flex items-center justify-between gap-3 text-slate-300 text-xs">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-slate-500" />
            <span className="text-[10px] font-bold text-slate-400 uppercase">จำลองเครื่องยิง/ป้อนเลขคีย์บอร์ด</span>
          </div>
          
          <button 
            type="button"
            onClick={() => {
              if (barcodeInput.trim()) {
                handleProcessBarcode(barcodeInput);
              } else {
                // If input is empty, seed a mock barcode from existing stock as helper
                const withBarcode = products.filter(p => p.barcode);
                if (withBarcode.length > 0) {
                  const randomBarcode = withBarcode[Math.floor(Math.random() * withBarcode.length)].barcode;
                  if (randomBarcode) {
                    setBarcodeInput(randomBarcode);
                    // Process immediately simulating lightning fast hardware trigger
                    setTimeout(() => {
                      handleProcessBarcode(randomBarcode);
                    }, 100);
                  }
                } else {
                  setBarcodeInput('8850027012345');
                }
              }
            }}
            className="px-3.5 py-1.5 rounded-xl font-extrabold text-[10px] transition-all cursor-pointer shadow-3xs"
            style={{ 
              backgroundColor: primaryBgHex, 
              color: primaryBtnTextHex
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = primaryHoverHex}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = primaryBgHex}
          >
            {barcodeInput.trim() ? 'ยิงรหัสที่ป้อนไว้' : 'สุ่มยิงรหัสทดสอบ'}
          </button>
        </div>

      </div>
    </div>
  );
};
