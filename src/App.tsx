import React, { useState } from 'react';
import { PosProvider, usePos } from './context/PosContext';
import { StorePosTab } from './components/StorePosTab';
import { ProductManagementTab } from './components/ProductManagementTab';
import { MemberManagementTab } from './components/MemberManagementTab';
import { SalesHistoryTab } from './components/SalesHistoryTab';
import { 
  Store, Layers, Users, History, AlertTriangle, 
  CloudRain, CloudLightning, LogOut, CheckCircle, 
  RefreshCw, Database, KeyRound, Settings2, Palette,
  Image, Type, Upload, Check, X, CreditCard
} from 'lucide-react';
import Swal from 'sweetalert2';
import { THEME_PRESETS } from './utils/theme';


const AppContent: React.FC = () => {
  const { 
    user, authLoading, loginWithGoogle, logout,
    syncStatus, triggerManualSync, seedInitialData,
    products, error, loading,
    settings, updateSettings
  } = usePos();

  const [layoutMode, setLayoutMode] = useState<'front' | 'back'>('front');
  const [activeTab, setActiveTab ] = useState<'pos' | 'stock' | 'members' | 'sales' | 'settings'>('pos');
  const [prevUser, setPrevUser] = useState<any>(user);

  // Settings customisation modal states
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsForm, setSettingsForm ] = useState({
    logo: '',
    nameEng: '',
    nameThai: '',
    themeColor: 'purple' as 'purple' | 'pink' | 'blue' | 'emerald' | 'orange',
    promptPayId: '',
    trueMoneyPhone: '',
    dbProvider: 'firebase' as 'firebase' | 'supabase',
    supabaseUrl: '',
    supabaseAnonKey: ''
  });

  // Keep settings form in-sync with loaded values from localStorage/Firestore
  React.useEffect(() => {
    if (settings) {
      setSettingsForm({
        logo: settings.logo || '🛍️',
        nameEng: settings.nameEng || 'Thai Store & POS',
        nameThai: settings.nameThai || 'ระบบบริหารหน้าร้าน คลังพัสดุและฐานสมาชิก',
        themeColor: settings.themeColor || 'purple',
        promptPayId: settings.promptPayId || '0812345678',
        trueMoneyPhone: settings.trueMoneyPhone || '0812345678',
        dbProvider: settings.dbProvider || 'firebase',
        supabaseUrl: settings.supabaseUrl || '',
        supabaseAnonKey: settings.supabaseAnonKey || ''
      });
    }
  }, [settings]);

  const theme = THEME_PRESETS[settings?.themeColor || 'purple'];

  // Key event listeners for rapid switching (F1-F4)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if target is input
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }
      if (e.key === 'F1') {
        e.preventDefault();
        setLayoutMode('front');
        setActiveTab('pos');
      } else if (e.key === 'F2') {
        e.preventDefault();
        setLayoutMode('back');
        setActiveTab('stock');
      } else if (e.key === 'F3') {
        e.preventDefault();
        setLayoutMode('back');
        setActiveTab('members');
      } else if (e.key === 'F4') {
        e.preventDefault();
        setLayoutMode('back');
        setActiveTab('sales');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Monitor auth changes for SweetAlert feedback and reset tab if logged out
  React.useEffect(() => {
    if (user && !prevUser) {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: `ยินดีต้อนรับคุณ ${user.displayName || 'พนักงานขาย'}`,
        text: 'เชื่อมต่อและซิงค์ข้อมูลกับระบบคลาวด์แล้ว ☁️',
        showConfirmButton: false,
        timer: 3500,
        timerProgressBar: true,
      });
    } else if (!user && prevUser) {
      setLayoutMode('front');
      setActiveTab('pos');
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'info',
        title: 'ออกจากระบบสำเร็จ',
        text: 'ระบบเข้าสู่โหมดออฟไลน์ (แก้ไขข้อมูลได้ แต่อนาคตต้องล็อกอินเพื่อคลาวด์)',
        showConfirmButton: false,
        timer: 4000,
        timerProgressBar: true,
      });
    }

    setPrevUser(user);
  }, [user, prevUser]);

  const handleSeed = async () => {
    Swal.fire({
      title: 'นำเข้าข้อมูลร้านค้าจำลอง?',
      text: 'คุณต้องการนำเข้าข้อมูลสินค้า สมาชิก และหน่วยนับจำลอง (ชาไทย, ครัวซองต์, มัทฉะ, ฯลฯ) เพื่อสัมผัสวิธีใช้งานทันทีใช่หรือไม่?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'ใช่, นำข้อมูลเข้าระบบ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#9333ea',
      cancelButtonColor: '#64748b',
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await seedInitialData();
          Swal.fire({
            icon: 'success',
            title: 'พรั่งพร้อมใช้ข้อมูลจำลอง',
            text: 'นำเข้าสินค้าชุดตัวอย่าง ชา กาแฟ และระบบ CRM สมาชิก พร้อมทดลองใช้ได้ทันที!',
            confirmButtonColor: '#9333ea',
          });
        } catch (e) {
          Swal.fire({
            icon: 'error',
            title: 'เกิดข้อผิดพลาดในการโหลด',
            text: 'กรุณาลองใหม่อีกครั้งในระบบ',
            confirmButtonColor: '#ef4444',
          });
        }
      }
    });
  };

  const handleLoginWithAlert = () => {
    Swal.fire({
      title: 'เข้าสู่ระบบร้านค้าอัจฉริยะ',
      html: `
        <div className="space-y-3 text-center">
          <p className="text-slate-600 text-xs">เพื่อสำรองวิสูตร สินค้าคลัง ประวัติการเงิน และยอดขายของคุณไว้บนคลาวด์อย่างปลอดภัย ไร้กังวลแม้เปลี่ยนเครื่อง</p>
          <div className="p-3 bg-fuchsia-50 rounded-2xl border border-fuchsia-100 flex items-center justify-center gap-1.5 mt-2.5">
            <span className="text-fuchsia-600 font-extrabold text-xs">☁️ ระบบซิงค์อัตโนมัติ (Google Cloud Firestore)</span>
          </div>
        </div>
      `,
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: '🚀 ล็อกอินด้วย Google Account',
      cancelButtonText: 'ใช้งานแบบออฟไลน์/ผู้เยือนต่อ',
      confirmButtonColor: '#9333ea',
      cancelButtonColor: '#64748b',
      customClass: {
        popup: 'rounded-3xl border border-pink-50 shadow-xl font-sans',
        confirmButton: 'rounded-xl font-sans text-xs px-4 py-2.5 font-bold',
        cancelButton: 'rounded-xl font-sans text-xs px-4 py-2.5 font-bold'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        loginWithGoogle().catch((err: any) => {
          console.error("Auth failure caught in UI alert:", err);
          const isUnauthorizedDomain = err?.code === 'auth/unauthorized-domain' || 
                                       err?.message?.includes('auth/unauthorized-domain') ||
                                       (err instanceof Error && err.message.includes('auth/unauthorized-domain'));
          
          if (isUnauthorizedDomain) {
            Swal.fire({
              icon: 'error',
              title: 'โดเมนยังไม่ได้รับอนุญาต (Unauthorized Domain)',
              html: `
                <div class="text-left font-sans text-xs space-y-3 leading-relaxed text-slate-705">
                  <p class="font-bold text-rose-600 text-sm">❌ ตรวจพบข้อผิดพลาดด้านความปลอดภัยโดเมนของ Firebase Auth</p>
                  <p>ระบบตรวจพบว่าโดเมนปัจจุบันที่คุณพยายามล็อกอิน <strong>ไม่ได้บันทึกอยู่ใน รายการโดเมนที่ได้รับอนุญาต (Authorized Domains)</strong> ในหน้าการตั้งค่า Firebase Authentication ของคุณ</p>
                  
                  <div class="bg-slate-50 border border-slate-150 rounded-xl p-3 space-y-2 mt-2">
                    <p class="font-bold text-slate-800">🛠️ วิธีแก้ไขความปลอดภัยบน Firebase Console:</p>
                    <ol class="list-decimal pl-4 space-y-1 text-[11px] text-slate-700">
                      <li>เปิด <strong>Firebase Console</strong> ของโปรเจกต์คุณ</li>
                      <li>ไปที่แถบเมนู <strong>Build > Authentication</strong> ในเมนูด้านซ้าย</li>
                      <li>คลิกเลือกแท็บ <strong>Settings</strong> ด้านบนของหน้าจอ</li>
                      <li>คลิกเลือกเมนูย่อย <strong>Authorized domains</strong> และกดปุ่ม <strong>Add domain</strong></li>
                      <li>คัดลอกโดแมนต่อไปนี้ลงในฟิลด์เพื่อรับรองสิทธิ์:</li>
                    </ol>
                    <div class="bg-slate-800 text-slate-100 p-2.5 rounded-lg font-mono text-[10px] break-all select-all leading-tight">
                      localhost<br/>
                      ais-dev-j3z544l2rahfuh6vzuix2s-542200585091.asia-east1.run.app<br/>
                      ais-pre-j3z544l2rahfuh6vzuix2s-542200585091.asia-east1.run.app<br/>
                      (รวมถึงโดเมน Vercel ของคุณเอง เช่น <strong>your-app.vercel.app</strong>)
                    </div>
                  </div>

                  <div class="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1 mt-2.5">
                    <p class="font-bold text-amber-900 flex items-center gap-1">💡 ปัญหา Browser Sandbox (COOP) ใน AI Studio:</p>
                    <p class="text-[11px] text-amber-800">เพื่อแก้ปัญหา Sandbox Iframe บล็อคหน้าต่างป็อปอัป ให้คลิกปุ่ม <strong>"Open in New Tab" (เปิดในแท็บใหม่)</strong> มุมขวาบนพรีวิวแผงแชต เพื่อเข้าใช้งานในหน้าต่างเดี่ยว จะทำให้ Google Login สำเร็จได้อย่างราบรื่นครับ</p>
                  </div>
                </div>
              `,
              confirmButtonText: 'เข้าอกเข้าใจวิธีแก้ไข',
              confirmButtonColor: '#9333ea',
              customClass: {
                popup: 'rounded-3xl border border-rose-50 shadow-xl font-sans w-full max-w-lg',
                confirmButton: 'rounded-xl font-sans text-xs px-5 py-2.5 font-bold',
              }
            });
          } else {
            Swal.fire({
              icon: 'error',
              title: 'เชื่อมต่อและเข้าสิทธิ์ล้มเหลว',
              html: `
                <div class="text-left font-sans text-xs space-y-2 leading-relaxed text-slate-700">
                  <p>ไม่สามารถดำเนินการเข้าสู่ระบบด้วย Google ได้ มีความขัดข้องชั่วขณะ:</p>
                  <p class="font-mono text-[10px] text-rose-600 bg-rose-50 p-2 rounded-lg break-words">${err?.message || err || 'Network connection / Sandbox timeout'}</p>
                  <p class="mt-2 text-amber-600 font-bold">💡 ข้อแนะนำ:</p>
                  <p class="text-[11px]">หากใช้งานบนแผงพรีวิว AI Studio ให้กดปุ่ม <strong>"Open in New Tab" (เปิดในแท็บใหม่)</strong> ที่มุมขวาบนของพรีวิว เพื่อความอิสระของเบราว์เซอร์ป๊อปอัพในการรับรองประวัติสิทธิ์</p>
                </div>
              `,
              confirmButtonText: 'ตกลง',
              confirmButtonColor: '#ef4444'
            });
          }
        });
      }
    });
  };

  const handleLogoutWithAlert = () => {
    Swal.fire({
      title: 'ยืนยันเพื่อออกจากระบบ',
      text: 'คุณต้องการออกจากระบบบัญชีร้านค้าหลักของคุณหรือไม่? ข้อมูลล่าสุดที่ยังไม่ได้ซิงค์จะยังเก็บไว้ในเครื่องประมวลข้อมูลออฟไลน์ชั่วคราว',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ออกจากระบบ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      customClass: {
        popup: 'rounded-3xl border border-pink-50 shadow-xl font-sans',
        confirmButton: 'rounded-xl font-sans text-xs px-4 py-2.5 font-bold',
        cancelButton: 'rounded-xl font-sans text-xs px-4 py-2.5 font-bold'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        logout();
      }
    });
  };

  const handleLogoFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Downscale to max 160x160 for beautiful crisp logo keeping aspect ratio
          const maxDim = 160;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            try {
              // Output as highly compressed JPEG
              const compressed = canvas.toDataURL('image/jpeg', 0.8);
              setSettingsForm(prev => ({ ...prev, logo: compressed }));
            } catch (canvasErr) {
              // Fallback to original if canvas taint or error
              setSettingsForm(prev => ({ ...prev, logo: event.target?.result as string }));
            }
          } else {
            setSettingsForm(prev => ({ ...prev, logo: event.target?.result as string }));
          }
        };
        img.src = event.target.result;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleLogoFile(file);
    }
  };

  const handleLogoDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleLogoFile(file);
    }
  };

  // Show dynamic splash screen on auth checks
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-700 p-6 text-center">
        <RefreshCw className="w-10 h-10 animate-spin text-slate-450 mb-4" />
        <h3 className="text-lg font-extrabold tracking-wide text-slate-800">กำลังเตรียมระบบร้านค้าและสต็อก...</h3>
        <p className="text-xs text-slate-400 mt-1">กรุณารอสักครู่ ระบบกำลังตรวจสอบสิทธิ์และการเชื่อมต่อ</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme.lightBg} flex flex-col font-sans transition-colors duration-300`}>
      
      {/* Dynamic Style Injector for strict pastel non-gradient compliance */}
      <style>{`
        :root {
          --theme-primary: ${theme.id === 'purple' ? '#c084fc' : theme.id === 'pink' ? '#f472b6' : theme.id === 'blue' ? '#38bdf8' : theme.id === 'emerald' ? '#34d399' : '#fb923c'};
          --theme-primary-hover: ${theme.id === 'purple' ? '#a855f7' : theme.id === 'pink' ? '#ec4899' : theme.id === 'blue' ? '#0ea5e9' : theme.id === 'emerald' ? '#10b981' : '#f97316'};
          --theme-accent: ${theme.id === 'purple' ? '#faf5ff' : theme.id === 'pink' ? '#fff1f2' : theme.id === 'blue' ? '#f0f9ff' : theme.id === 'emerald' ? '#f0fdf4' : '#fff7ed'};
          --theme-primary-text: ${theme.primaryBtnTextHex};
        }
        
        /* Eliminate unrequested gradients and force flat solid tone */
        .bg-gradient-to-r, [class*="bg-gradient-to-"] {
          background-image: none !important;
          background-color: var(--theme-primary) !important;
          color: var(--theme-primary-text) !important;
        }

        /* Primary button flat pastel state styling updates */
        .bg-gradient-to-r:hover, [class*="bg-gradient-to-"]:hover {
          background-image: none !important;
          background-color: var(--theme-primary-hover) !important;
          color: var(--theme-primary-text) !important;
        }

        .border-pink-50, .border-purple-100, .border-purple-200, .border-purple-100/50, .border-pink-100 {
          border-color: ${theme.id === 'purple' ? '#f3e8ff' : theme.id === 'pink' ? '#ffe4e6' : theme.id === 'blue' ? '#e0f2fe' : theme.id === 'emerald' ? '#dcfce7' : '#ffedd5'} !important;
        }

        .text-purple-950, .text-purple-700, .text-purple-600, .text-purple-500 {
          color: ${theme.id === 'purple' ? '#581c87' : theme.id === 'pink' ? '#881337' : theme.id === 'blue' ? '#1e3a8a' : theme.id === 'emerald' ? '#064e3b' : '#7c2d12'} !important;
        }

        .bg-pink-100, .bg-purple-100, .bg-purple-50, .bg-purple-50/50 {
          background-color: var(--theme-accent) !important;
        }

        .text-pink-500, .text-purple-400 {
          color: var(--theme-primary) !important;
        }

        .border-purple-400 {
          border-color: var(--theme-primary) !important;
        }

        .hover:text-purple-600:hover {
          color: var(--theme-primary-hover) !important;
        }
      `}</style>
      
      {/* RENDER LAYOUT BASED ON FRONT OR BACK MODE */}
      {layoutMode === 'front' ? (
        <div className="flex flex-col flex-1">
          {/* HEADER SPECIFIC FOR FRONT STORE */}
          <header className="bg-white/95 backdrop-blur-md border-b border-pink-50 shadow-2xs py-3.5 px-6 sticky top-0 z-45 no-print">
            <div className="max-w-full mx-auto flex flex-col md:flex-row items-center justify-between gap-3 px-2">
              
              {/* Logo & Store Name */}
              <div className="flex items-center gap-3">
                {settings?.logo?.startsWith('data:image') || settings?.logo?.startsWith('http') ? (
                  <img 
                    src={settings.logo} 
                    className="w-10 h-10 object-cover rounded-xl border border-slate-150 shadow-2xs shrink-0" 
                    alt="Store Logo" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-10 h-10 flex items-center justify-center text-2xl bg-white shadow-3xs rounded-xl border border-slate-150 shrink-0 select-none">
                    {settings?.logo || '🛍️'}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="font-extrabold text-base tracking-tight uppercase text-purple-950">{settings?.nameEng || 'Thai Store & POS'}</h1>
                    <span className="bg-emerald-50 text-emerald-750 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full select-none flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                      เปิดหน้าร้าน POS
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 font-medium">{settings?.nameThai || 'ระบบบริหารหน้าร้าน คลังพัสดุและฐานสมาชิก'}</p>
                </div>
              </div>

              {/* Status and Actions Bar */}
              <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                
                {/* Seed trigger indicator if layout is empty */}
                {products.length === 0 && (
                  <button
                    onClick={handleSeed}
                    className="py-1.5 px-3 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95 shrink-0"
                  >
                    <Database className="w-3.5 h-3.5" />
                    นำข้อมูลตัวอย่างเข้า POS
                  </button>
                )}

                {/* Sync status */}
                {user ? (
                  <button
                    onClick={triggerManualSync}
                    disabled={syncStatus.isSyncing}
                    className={`py-1.5 px-3 rounded-full border text-[10px] font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                      syncStatus.pendingCount > 0 
                        ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 animate-pulse' 
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-current ${syncStatus.isSyncing ? 'animate-spin' : ''}`} />
                    {syncStatus.isSyncing ? 'ซิ๊งค์...' : syncStatus.pendingCount > 0 ? `รอซิงค์ ${syncStatus.pendingCount} รายการ` : 'เชื่อมคลาวด์แล้ว'}
                  </button>
                ) : (
                  <div 
                    className="py-1.5 px-3 rounded-full border bg-slate-50 text-slate-500 border-slate-200 text-[10px] font-semibold flex items-center gap-1.5 cursor-pointer shrink-0 hover:bg-slate-100"
                    onClick={handleLoginWithAlert}
                  >
                    <Database className="w-3.5 h-3.5 text-slate-450" />
                    <span>ใช้แบบออฟไลน์ (คลิกล็อกอิน)</span>
                  </div>
                )}

                {/* SWITCH TO BACK OFFICE BUTTON */}
                <button
                  onClick={() => {
                    setLayoutMode('back');
                    setActiveTab('stock');
                  }}
                  className="py-2 px-4 bg-purple-600 hover:bg-purple-700 border border-purple-500 text-white font-extrabold text-[12px] rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer transform active:scale-95 duration-100"
                >
                  <Settings2 className="w-4 h-4 text-purple-200 animate-spin-pulse" />
                  <span>⚙️ ระบบหลังบ้าน (Back Office)</span>
                  <span className="text-[9px] font-mono font-bold bg-purple-800 text-purple-100 px-1 py-0.2 rounded-sm ml-0.5 select-none">F2</span>
                </button>

                {/* Profile section */}
                <div className="flex items-center gap-2 pl-2 border-l border-slate-150">
                  {user ? (
                    <>
                      <div className="text-right hidden sm:block">
                        <p className="text-xs font-bold text-slate-700 line-clamp-1">{user.displayName || 'แคชเชียร์'}</p>
                      </div>
                      {user.photoURL ? (
                        <img 
                          src={user.photoURL} 
                          alt="User" 
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 rounded-full border border-pink-100 shadow-2xs shrink-0" 
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-pink-100 text-pink-700 flex items-center justify-center text-xs font-bold shrink-0">
                          OP
                        </div>
                      )}
                      <button
                        onClick={handleLogoutWithAlert}
                        className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-lg shrink-0"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleLoginWithAlert}
                      className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-xl transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-3xs"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                      <span>ล็อกอิน</span>
                    </button>
                  )}
                </div>

              </div>

            </div>
          </header>

          {/* MAIN POS VIEW */}
          <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-full w-full mx-auto pb-12">
            <StorePosTab />
          </main>
        </div>
      ) : (
        /* BACK OFFICE SYSTEM MODE */
        <div className="flex flex-col md:flex-row flex-1 min-h-[calc(100vh-50px)]">
          
          {/* SIDEBAR NAVIGATION PANEL */}
          <aside className="w-full md:w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 shrink-0 no-print">
            
            {/* Sidebar Branding Header */}
            <div className="p-5 border-b border-slate-800 flex items-center gap-3">
              {settings?.logo?.startsWith('data:image') || settings?.logo?.startsWith('http') ? (
                <img 
                  src={settings.logo} 
                  className="w-9 h-9 object-cover rounded-xl border border-slate-700 shadow-2xs" 
                  alt="Store Logo" 
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-9 h-9 flex items-center justify-center text-xl bg-slate-800 rounded-xl border border-slate-700 shrink-0 select-none">
                  {settings?.logo || '🛍️'}
                </div>
              )}
              <div>
                <h2 className="font-extrabold text-sm tracking-tight text-white line-clamp-1">{settings?.nameEng || 'Thai Store & POS'}</h2>
                <span className="text-[10px] text-fuchsia-400 font-bold flex items-center gap-1 mt-0.5 uppercase tracking-wider">
                  <Settings2 className="w-3 h-3" />
                  จัดการหลังบ้าน
                </span>
              </div>
            </div>

            {/* Navigation Lists */}
            <nav className="p-4 flex-1 space-y-1">
              
              <div className="text-[9px] uppercase tracking-widest text-slate-500 font-bold px-3 py-1.5 select-none font-mono">
                คลังและ CRM
              </div>

              {/* 1. Inventory & Stocks */}
              <button
                onClick={() => setActiveTab('stock')}
                className={`w-full py-2.5 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                  activeTab === 'stock' 
                    ? 'bg-purple-600 text-white shadow-md font-extrabold' 
                    : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Layers className="w-4 h-4 shrink-0 text-purple-400" />
                  <span>คลังสินค้าและหน่วยนับ</span>
                </span>
                <span className="text-[8px] font-mono bg-slate-800 text-slate-400 px-1 py-0.5 rounded-sm select-none">F2</span>
              </button>

              {/* 2. Customer Loyalty CRM */}
              <button
                onClick={() => setActiveTab('members')}
                className={`w-full py-2.5 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                  activeTab === 'members' 
                    ? 'bg-purple-600 text-white shadow-md font-extrabold' 
                    : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Users className="w-4 h-4 shrink-0 text-purple-400" />
                  <span>สมาชิกลูกค้า & CRM</span>
                </span>
                <span className="text-[8px] font-mono bg-slate-800 text-slate-400 px-1 py-0.5 rounded-sm select-none">F3</span>
              </button>

              {/* 3. Sales ledger audit reports */}
              <button
                onClick={() => setActiveTab('sales')}
                className={`w-full py-2.5 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                  activeTab === 'sales' 
                    ? 'bg-purple-600 text-white shadow-md font-extrabold' 
                    : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2">
                  <History className="w-4 h-4 shrink-0 text-purple-400" />
                  <span>รายงานธุรกรรมการเงิน</span>
                </span>
                <span className="text-[8px] font-mono bg-slate-800 text-slate-400 px-1 py-0.5 rounded-sm select-none">F4</span>
              </button>

              <div className="pt-4 text-[9px] uppercase tracking-widest text-slate-500 font-bold px-3 py-1.5 select-none font-mono">
                การตั้งค่าร้าน
              </div>

              {/* 4. Brand customizer tab */}
              <button
                onClick={() => setActiveTab('settings')}
                className={`w-full py-2.5 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                  activeTab === 'settings' 
                    ? 'bg-purple-600 text-white shadow-md font-extrabold' 
                    : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Palette className="w-4 h-4 shrink-0 text-purple-400" />
                  <span>ตั้งค่าแบรนด์ & รับเงิน</span>
                </span>
                <span className="text-[8px] text-slate-500 font-serif">⚙️</span>
              </button>

            </nav>

            {/* Offline and backup status in sidebar bottom */}
            <div className="p-4 bg-slate-950 border-t border-slate-850 space-y-3">
              
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">การเชื่อมคลาวด์</span>
                {user ? (
                  <span className="text-[9px] text-emerald-400 font-bold flex items-center gap-1">☁️ ดำเนินการปกติ</span>
                ) : (
                  <span className="text-[9px] text-amber-500 font-bold flex items-center gap-1">⚠️ ออฟไลน์โหมด</span>
                )}
              </div>

              {!user && (
                <button
                  onClick={handleLoginWithAlert}
                  className="w-full py-1.5 px-3 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-650 text-purple-200 rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                >
                  ☁️ เข้าสู่ระบบคลาวด์ที่นี่
                </button>
              )}

              {/* STICKY SIDEBAR FOOTER: OPEN FRONT POS */}
              <button
                onClick={() => {
                  setLayoutMode('front');
                  setActiveTab('pos');
                }}
                className="w-full mt-2 py-3 px-4 bg-[#c084fc] hover:bg-[#a855f7] hover:scale-[1.02] text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer duration-150"
              >
                <Store className="w-4 h-4 text-slate-950" />
                <span>🛒 ไปหน้าหน้าร้าน (Active POS)</span>
                <span className="text-[8px] font-mono bg-slate-950 text-[#c084fc] font-bold px-1 py-0.5 rounded-sm select-none">F1</span>
              </button>

            </div>

          </aside>

          {/* MAIN DASHBOARD CONTENT PANEL */}
          <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto max-w-full">
            
            {/* Header description of selected action path */}
            <div className="mb-6 pb-4 border-b border-light flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print border-slate-200">
              <div>
                <h3 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                  {activeTab === 'stock' && (
                    <>
                      <Layers className="w-5 h-5 text-purple-600" />
                      <span>คลังสินค้าและกำหนดหน่วยนับ</span>
                    </>
                  )}
                  {activeTab === 'members' && (
                    <>
                      <Users className="w-5 h-5 text-purple-600" />
                      <span>ระบบฐานข้อมูลพนักงาน & สมาชิก</span>
                    </>
                  )}
                  {activeTab === 'sales' && (
                    <>
                      <History className="w-5 h-5 text-purple-600" />
                      <span>รายงานระบบบัญชี ประวัติขาย และยอดสะสม</span>
                    </>
                  )}
                  {activeTab === 'settings' && (
                    <>
                      <Palette className="w-5 h-5 text-purple-600" />
                      <span>แบรนด์ดิ้งร้าน และช่องทางรับโอนชำระเงิน</span>
                    </>
                  )}
                </h3>
                <p className="text-xs text-slate-450 mt-1">
                  {activeTab === 'stock' && 'ตรวจสอบจำนวนสต็อกคลัง บันทึกสินค้า บาร์โค้ด และจัดประเภทอย่างง่าย'}
                  {activeTab === 'members' && 'บันทึกประวัติ เพิ่มแต้ม แจกสิทธิ์ลดราคาสำหรับลูกค้า VIP'}
                  {activeTab === 'sales' && 'การกรองวันที่ บันทึกแบบโอน / เงินสด รายงานตัวเงินและการพรูฟรีเซ็ป'}
                  {activeTab === 'settings' && 'เปลี่ยนชื่อภาษาไทย/อังกฤษ ตกแต่งพาเลทดึงใจ และจูน QR PromptPay ลิงค์ด่วน'}
                </p>
              </div>

              {/* Profile status inside Dashboard */}
              <div className="flex items-center gap-2.5 shrink-0">
                {user ? (
                  <div className="text-right text-xs">
                    <span className="font-bold text-slate-700 block">{user.displayName || 'ผู้จัดการ'}</span>
                    <span className="text-[10px] text-purple-600 font-bold block">{user.email || 'manager@store.com'}</span>
                  </div>
                ) : (
                  <span className="text-[10px] bg-amber-50 border border-amber-200 text-amber-800 px-2.5 py-1 rounded-full font-bold">
                    ⚠️ โหมดทำงานออฟไลน์
                  </span>
                )}
              </div>
            </div>

            {/* TAB RENDERING */}
            <div className="bg-transparent">
              {activeTab === 'stock' && <ProductManagementTab />}
              {activeTab === 'members' && <MemberManagementTab />}
              {activeTab === 'sales' && <SalesHistoryTab />}
              
              {/* EMBEDDED INLINE BRAND SETTINGS */}
              {activeTab === 'settings' && (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6">
                  
                  {/* Branding Text names */}
                  <div className="space-y-4 font-sans">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Type className="w-4 h-4 text-slate-450" />
                      <span>แก้ไขรายละเอียดหัวข้อและชื่อเวปไซต์</span>
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1.5">ชื่อร้านภาษาอังกฤษ (English Brand Title)</label>
                        <input 
                          type="text" 
                          value={settingsForm.nameEng}
                          onChange={(e) => setSettingsForm(prev => ({ ...prev, nameEng: e.target.value }))}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-purple-200 focus:bg-white transition-all"
                          placeholder="เช่น Cozy Cafe & Bistro"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1.5">ชื่อรายละเอียดภาษาไทย (Thai Description Subtitle)</label>
                        <input 
                          type="text" 
                          value={settingsForm.nameThai}
                          onChange={(e) => setSettingsForm(prev => ({ ...prev, nameThai: e.target.value }))}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-purple-200 focus:bg-white transition-all"
                          placeholder="เช่น ระบบดูแลร้านโชว์ห่วย ยุคใหม่ ทันใจ"
                        />
                      </div>
                    </div>
                  </div>

                  <hr className="border-slate-100" />

                  {/* Payment accounts */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-slate-450" />
                      <span>ช่องทางการโอนชำระเงินของร้านค้า</span>
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1.5">เลขพร้อมเพย์บุคคล/นิติบุคคล (PromptPay ID/Phone-no)</label>
                        <input 
                          type="text" 
                          value={settingsForm.promptPayId}
                          onChange={(e) => setSettingsForm(prev => ({ ...prev, promptPayId: e.target.value }))}
                          className="w-full px-4 py-2.5 bg-slate-55 border border-slate-200 rounded-xl text-xs font-mono font-semibold focus:outline-hidden focus:ring-2 focus:ring-purple-200 focus:bg-white transition-all"
                          placeholder="เช่น 0899999999"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1.5">เบอร์รับ TrueMoney Wallet (ถ้ารองรับ)</label>
                        <input 
                          type="text" 
                          value={settingsForm.trueMoneyPhone}
                          onChange={(e) => setSettingsForm(prev => ({ ...prev, trueMoneyPhone: e.target.value }))}
                          className="w-full px-4 py-2.5 bg-slate-55 border border-slate-200 rounded-xl text-xs font-mono font-semibold focus:outline-hidden focus:ring-2 focus:ring-purple-200 focus:bg-white transition-all"
                          placeholder="เช่น 0899999999"
                        />
                      </div>
                    </div>
                  </div>

                  <hr className="border-slate-100" />

                  {/* Logo Picker */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Image className="w-4 h-4 text-slate-450" />
                      <span>โลโก้หลักของหน้าร้าน</span>
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                      <div className="md:col-span-4 flex flex-col items-center justify-center p-4 bg-slate-50/50 rounded-2xl border border-slate-100 text-center">
                        <span className="text-[10px] text-slate-400 font-bold mb-2 uppercase tracking-tight">โลโก้ปัจจุบัน</span>
                        
                        {settingsForm.logo.startsWith('data:image') || settingsForm.logo.startsWith('http') ? (
                          <div className="relative group">
                            <img 
                              src={settingsForm.logo} 
                              className="w-20 h-20 object-cover rounded-2xl border border-slate-200 shadow-sm" 
                              alt="Store Logo Preview" 
                              referrerPolicy="no-referrer"
                            />
                            <button 
                              onClick={() => setSettingsForm(prev => ({ ...prev, logo: '🛍️' }))}
                              className="absolute -top-1.5 -right-1.5 bg-rose-500 hover:bg-rose-600 text-white p-1 rounded-full shadow-md text-[9px] font-bold cursor-pointer transition-transform hover:scale-110"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="w-16 h-16 flex items-center justify-center text-4xl bg-white shadow-3xs rounded-2xl border border-slate-200 select-none">
                            {settingsForm.logo || '🛍️'}
                          </div>
                        )}
                      </div>

                      <div className="md:col-span-8 space-y-3">
                        <div>
                          <span className="block text-[11px] font-bold text-slate-500 mb-1.5">เลือกใช้สัญลักษณ์อีโมจิด่วน (Pastel Emojis)</span>
                          <div className="flex flex-wrap gap-1.5">
                            {['🛍️', '☕', '🥐', '🍵', '🍕', '🍦', '🎨', '📚', '👕', '🔋', '🐱', '🌸', '🍔', '🥤', '💅', '🧸'].map(emoji => (
                              <button
                                key={emoji}
                                onClick={() => setSettingsForm(prev => ({ ...prev, logo: emoji }))}
                                type="button"
                                className={`w-9 h-9 flex items-center justify-center text-lg rounded-xl transition-all cursor-pointer ${settingsForm.logo === emoji ? 'bg-purple-100 border-2 border-purple-400 scale-105 shadow-3xs hover:scale-105' : 'bg-slate-50 hover:bg-slate-100 border border-slate-200'}`}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 mb-1">พิมพ์สัญลักษณ์อื่น</label>
                            <input 
                              type="text"
                              maxLength={3}
                              value={settingsForm.logo.length <= 3 && !settingsForm.logo.startsWith('data:') ? settingsForm.logo : ''}
                              onChange={(e) => {
                                if (e.target.value.trim()) {
                                  setSettingsForm(prev => ({ ...prev, logo: e.target.value.trim() }));
                                }
                              }}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-purple-300 focus:outline-hidden"
                              placeholder="เช่น 🍩"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 mb-1">อัปโหลดไฟล์รูปภาพ (.PNG, .JPG)</label>
                            <div 
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={handleLogoDrop}
                              onClick={() => document.getElementById('settings-logo-file-inline')?.click()}
                              className="border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 rounded-xl p-3 text-center cursor-pointer flex flex-col items-center justify-center gap-1 transition-colors"
                            >
                              <Upload className="w-4 h-4 text-slate-450" />
                              <span className="text-[10px] font-bold text-slate-500">ลากหรือคลิกที่นี่เพื่ออัปโหลด</span>
                              <input 
                                id="settings-logo-file-inline"
                                type="file" 
                                accept="image/*"
                                onChange={handleLogoUpload}
                                className="hidden"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <hr className="border-slate-100" />

                  {/* Themes options */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Palette className="w-4 h-4 text-slate-450" />
                      <span>ชุดสีตกแต่งระบบ (Pastel Flat Theme Color)</span>
                    </h4>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {(Object.keys(THEME_PRESETS) as Array<keyof typeof THEME_PRESETS>).map((presetKey) => {
                        const preset = THEME_PRESETS[presetKey];
                        const isActive = settingsForm.themeColor === presetKey;
                        return (
                          <button
                            key={presetKey}
                            type="button"
                            onClick={() => setSettingsForm(prev => ({ ...prev, themeColor: presetKey }))}
                            className={`p-3 rounded-2xl border text-left transition-all relative flex flex-col items-center justify-center text-center gap-2 cursor-pointer ${isActive ? 'border-purple-400 bg-purple-50/50 shadow-3xs font-extrabold' : 'border-slate-200 hover:bg-slate-50'}`}
                          >
                            <div 
                              className="w-10 h-10 rounded-full border border-black/5 flex items-center justify-center text-white" 
                              style={{ backgroundColor: preset.btnPrimaryHex }}
                            >
                              {isActive && <Check className="w-4 h-4 stroke-[3px] text-white" />}
                            </div>
                            <span className="text-[10px] text-slate-650 tracking-tight">{preset.name.split(' / ')[0]}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Save button inline */}
                  <div className="pt-4 border-t border-slate-100 flex justify-end">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await updateSettings(settingsForm);
                          Swal.fire({
                            icon: 'success',
                            title: 'บันทึกสำเร็จ!',
                            text: 'เปลี่ยนการตั้งค่าแบรนดิ่งร้าน และโทนสีเรียบเสร็จสมบูรณ์ 🎨✨',
                            confirmButtonColor: theme.btnPrimaryHex,
                          });
                        } catch (e) {
                          Swal.fire({
                            icon: 'error',
                            title: 'ไม่สามารถบันทึกได้',
                            text: 'กรุณาตรวจสอบการซิงค์หรือโครงข่ายอินเตอร์เน็ต',
                            confirmButtonColor: '#ff2c55'
                          });
                        }
                      }}
                      className="py-2.5 px-6 font-bold text-white rounded-xl text-xs shadow-xs hover:shadow-md transition-all cursor-pointer transform active:scale-95 bg-purple-600 hover:bg-purple-700"
                    >
                      💾 บันทึกเปลี่ยนการตั้งค่าแบรนด์ร้าน
                    </button>
                  </div>

                </div>
              )}

            </div>

          </main>
        </div>
      )}

      {/* ⚙️ SYSTEM BRAND & COLOR THEME CUSTOMIZATION MODAL */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs z-55 flex items-center justify-center p-4 animate-fade-in no-print bg-opacity-75">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-100 shadow-2xl relative overflow-hidden transform transition-all duration-300 scale-100 font-sans flex flex-col max-h-[90vh]">
            
            {/* Top design aesthetic accent (Solid flat color instead of gradient!) */}
            <div className="h-2 w-full" style={{ backgroundColor: theme.btnPrimaryHex }} />

            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl" style={{ backgroundColor: `${theme.btnPrimaryHex}15`, color: theme.btnPrimaryHex }}>
                  <Settings2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800">ปรับแต่งตั้งค่าแบรนด์ & สีระบบ</h3>
                  <p className="text-[10px] text-slate-450 font-medium">จัดการโลโก้ ชื่อระบบภาษาไทย/อังกฤษ และธีมปุ่มกดแบบพาสเทล</p>
                </div>
              </div>
              <button 
                onClick={() => setIsSettingsModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                title="ปิดหน้าต่าง"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Body - Scrollable */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-705 text-sm">
              
              {/* 1. Branding Text names (Thai and English) */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Type className="w-4 h-4 text-slate-450" />
                  <span>แก้ไขข้อมูลหัวข้อและชื่อระบบ</span>
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1.5">ชื่อระบบภาษาอังกฤษ (English Name)</label>
                    <input 
                      type="text" 
                      value={settingsForm.nameEng}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, nameEng: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-slate-200 focus:bg-white transition-all"
                      placeholder="เช่น My Cozy Store & POS"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1.5">ชื่อระบบภาษาไทย (Thai Name Subtitle)</label>
                    <input 
                      type="text" 
                      value={settingsForm.nameThai}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, nameThai: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-slate-200 focus:bg-white transition-all"
                      placeholder="เช่น ระบบดูแลร้านค้าคาเฟ่ และคลังสต็อกอัจฉริยะ"
                    />
                  </div>
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* ข้อมูลบัญชีรับเงินของร้านค้า (Payment Credentials) */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-slate-450" />
                  <span>ข้อมูลบัญชีรับเงินของร้านค้า (Payment Credentials)</span>
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1.5">เบอร์โทรศัพท์ / เลขประจำตัวพร้อมเพย์ (PromptPay ID)</label>
                    <input 
                      type="text" 
                      value={settingsForm.promptPayId}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, promptPayId: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold focus:outline-hidden focus:ring-2 focus:ring-slate-200 focus:bg-white transition-all"
                      placeholder="เช่น 0812345678"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1.5">เบอร์บัญชี TrueMoney Wallet ทั่วไป</label>
                    <input 
                      type="text" 
                      value={settingsForm.trueMoneyPhone}
                      onChange={(e) => setSettingsForm(prev => ({ ...prev, trueMoneyPhone: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold focus:outline-hidden focus:ring-2 focus:ring-slate-200 focus:bg-white transition-all"
                      placeholder="เช่น 0812345678"
                    />
                  </div>
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* 🔌 CONFIGURATION FOR DATABASE PROVIDER (FIREBASE vs SUPABASE) */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-slate-450" />
                  <span>ระบบหลังบ้านเชื่อมข้อมูล (Database Provider)</span>
                </h4>
                
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-4">
                  <div>
                    <span className="block text-[11px] font-bold text-slate-500 mb-1.5">เลือกฐานข้อมูลหลักที่ใช้งาน</span>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setSettingsForm(prev => ({ ...prev, dbProvider: 'firebase' }))}
                        className={`py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all cursor-pointer ${settingsForm.dbProvider === 'firebase' ? 'bg-purple-650 border-purple-650 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-705 hover:bg-slate-100'}`}
                      >
                        🔥 Firebase Firestore
                      </button>
                      <button
                        type="button"
                        onClick={() => setSettingsForm(prev => ({ ...prev, dbProvider: 'supabase' }))}
                        className={`py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all cursor-pointer ${settingsForm.dbProvider === 'supabase' ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-705 hover:bg-slate-100'}`}
                      >
                        ⚡ Supabase (PostgreSQL)
                      </button>
                    </div>
                  </div>

                  {settingsForm.dbProvider === 'supabase' && (
                    <div className="space-y-3.5 animate-fade-in border-t border-slate-200/50 pt-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">Supabase Project URL</label>
                        <input 
                          type="text" 
                          value={settingsForm.supabaseUrl}
                          onChange={(e) => setSettingsForm(prev => ({ ...prev, supabaseUrl: e.target.value }))}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:outline-hidden focus:ring-1 focus:ring-emerald-300"
                          placeholder="เช่น https://your-project.supabase.co"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">Supabase Anon (Public) Key</label>
                        <input 
                          type="password" 
                          value={settingsForm.supabaseAnonKey}
                          onChange={(e) => setSettingsForm(prev => ({ ...prev, supabaseAnonKey: e.target.value }))}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:outline-hidden focus:ring-1 focus:ring-emerald-300"
                          placeholder="รหัส API Anon Key ของโปรเจกต์ Supabase"
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
                        * หมายเหตุ: คุณสามารถดึงข้อมูลค่าพารามิเตอร์เหล่านี้ได้จากหน้า <strong>Dashboard &gt; Settings &gt; API</strong> ของโปรเจกต์คุณใน Supabase เพื่อใช้จัดเก็บข้อมูลแบบ Relational Database แทน Firebase !
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* 2. Brand Logo & Favicon Picker */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Image className="w-4 h-4 text-slate-450" />
                  <span>โลโก้ร้านค้าและ Favicon บราวเซอร์</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                  {/* Left Logo display & favicon confirmation info */}
                  <div className="md:col-span-4 flex flex-col items-center justify-center p-4 bg-slate-50/50 rounded-2xl border border-slate-100 text-center">
                    <span className="text-[10px] text-slate-400 font-bold mb-2 uppercase tracking-tight">โลโก้ปัจจุบัน</span>
                    
                    {settingsForm.logo.startsWith('data:image') || settingsForm.logo.startsWith('http') ? (
                      <div className="relative group">
                        <img 
                          src={settingsForm.logo} 
                          className="w-20 h-20 object-cover rounded-2xl border border-slate-205 shadow-sm" 
                          alt="Store Logo Preview" 
                          referrerPolicy="no-referrer"
                        />
                        <button 
                          onClick={() => setSettingsForm(prev => ({ ...prev, logo: '🛍️' }))}
                          className="absolute -top-1.5 -right-1.5 bg-rose-500 hover:bg-rose-600 text-white p-1 rounded-full shadow-md text-[9px] font-bold cursor-pointer hover:scale-105"
                          title="ล้างโลโก้รูปภาพ"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-16 h-16 flex items-center justify-center text-4xl bg-white shadow-xs rounded-2xl border border-slate-200 select-none">
                        {settingsForm.logo || '🛍️'}
                      </div>
                    )}
                    
                    <p className="text-[9px] text-slate-400 mt-3.5 leading-relaxed font-medium">ระบบจะคำนวณกราฟิกไอคอนและเปลี่ยนไอคอน Browser Favicon ให้คุณทันที ⚡</p>
                  </div>

                  {/* Middle and Right selectors */}
                  <div className="md:col-span-8 space-y-3.5">
                    <div>
                      <span className="block text-[11px] font-bold text-slate-500 mb-1.5">ไอคอนด่วนสไตล์โมเดิร์น (Cute Pastel Emoji)</span>
                      <div className="flex flex-wrap gap-1.5">
                        {['🛍️', '☕', '🥐', '🍵', '🍕', '🍦', '🎨', '📚', '👕', '🔋', '🐱', '🌸', '🍔', '🥤', '💅', '🧸'].map(emoji => (
                          <button
                            key={emoji}
                            onClick={() => setSettingsForm(prev => ({ ...prev, logo: emoji }))}
                            type="button"
                            className={`w-9 h-9 flex items-center justify-center text-lg rounded-xl transition-all cursor-pointer ${settingsForm.logo === emoji ? 'bg-purple-100 border-2 border-purple-400 scale-105 shadow-3xs' : 'bg-slate-50/60 hover:bg-slate-100 border border-slate-200/50'}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">พิมพ์อีโมจิอื่นที่ต้องการ</label>
                        <input 
                          type="text"
                          maxLength={3}
                          value={settingsForm.logo.length <= 3 && !settingsForm.logo.startsWith('data:') ? settingsForm.logo : ''}
                          onChange={(e) => {
                            if (e.target.value.trim()) {
                              setSettingsForm(prev => ({ ...prev, logo: e.target.value.trim() }));
                            }
                          }}
                          className="w-full px-3 py-2 bg-slate-55 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-purple-300 focus:outline-hidden"
                          placeholder="พิมพ์สัญลักษณ์ เช่น 🍩"
                        />
                      </div>

                      {/* Manual upload area adhering to touch targets and Drag & Drop */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">อัปโหลดภาพโลโก้แบรนด์ (.PNG, .JPG)</label>
                        <div 
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={handleLogoDrop}
                          onClick={() => document.getElementById('settings-logo-file')?.click()}
                          className="border border-dashed border-slate-300 bg-slate-50/80 hover:bg-slate-100 hover:border-slate-400 rounded-xl p-3 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1"
                        >
                          <Upload className="w-4 h-4 text-slate-400" />
                          <span className="text-[10px] font-bold text-slate-500">คลิกหรือลากรูปมาวาง</span>
                          <span className="text-[8px] text-slate-400">แปลงเป็น Base64 ทันใจ</span>
                          <input 
                            id="settings-logo-file"
                            type="file" 
                            accept="image/*"
                            onChange={handleLogoUpload}
                            className="hidden"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* 3. Pastel Color Tone Settings (Strictly flat colors, NO gradients!) */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Palette className="w-4 h-4 text-slate-450" />
                  <span>เปลี่ยนโทนสีของระบบ (Flat Pastel Palette - No Gradients)</span>
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {(Object.keys(THEME_PRESETS) as Array<keyof typeof THEME_PRESETS>).map((presetKey) => {
                    const preset = THEME_PRESETS[presetKey];
                    const isActive = settingsForm.themeColor === presetKey;
                    return (
                      <button
                        key={presetKey}
                        type="button"
                        onClick={() => setSettingsForm(prev => ({ ...prev, themeColor: presetKey }))}
                        className={`p-3 rounded-2xl border text-left transition-all relative flex flex-col items-center justify-center text-center gap-2 cursor-pointer ${isActive ? 'border-slate-400 bg-slate-50 shadow-xs scale-102 font-bold' : 'border-slate-200 hover:bg-slate-50/50'}`}
                      >
                        {/* Bullet color circle flat solid */}
                        <div 
                          className="w-10 h-10 rounded-full border border-black/5 flex items-center justify-center text-white" 
                          style={{ backgroundColor: preset.btnPrimaryHex }}
                        >
                          {isActive && <Check className="w-5 h-5 drop-shadow-xs text-white stroke-[3px]" />}
                        </div>
                        <span className="text-[10px] font-bold text-slate-600 tracking-tight">{preset.name.split(' / ')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Footer buttons */}
            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex items-center gap-3 justify-end no-print">
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(false)}
                className="py-2.5 px-4 bg-white border border-slate-200 text-slate-650 font-bold rounded-xl text-xs hover:bg-slate-100 transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await updateSettings(settingsForm);
                    setIsSettingsModalOpen(false);
                    Swal.fire({
                      icon: 'success',
                      title: 'ปรับปรุงข้อมูลระบบสำเร็จ!',
                      text: 'เปลึ่ยนชื่อและโทนสีพาสเทลใหม่เรียบร้อยแล้วครับ 🎨✨',
                      confirmButtonColor: theme.btnPrimaryHex,
                      customClass: {
                        popup: 'rounded-3xl border shadow-xl'
                      }
                    });
                  } catch (e) {
                    Swal.fire({
                      icon: 'error',
                      title: 'ไม่สามารถบันทึกได้',
                      text: 'กรุณาตรวจสอบคลื่นเชื่อมต่อหรือโหลดใหม่อีกครั้ง',
                      confirmButtonColor: '#ff2c55'
                    });
                  }
                }}
                className={`py-2.5 px-5 font-bold text-white rounded-xl text-xs transition-colors shadow-xs hover:shadow-md cursor-pointer`}
                style={{ backgroundColor: theme.btnPrimaryHex }}
              >
                บันทึกการเปลี่ยนแปลง
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default function App() {
  return (
    <PosProvider>
      <AppContent />
    </PosProvider>
  );
}
