export interface ThemePreset {
  id: 'purple' | 'pink' | 'blue' | 'emerald' | 'orange';
  name: string;
  // Backgrounds
  primaryBg: string; // solid pastel button bg
  primaryHoverBg: string;
  accentBg: string; // e.g. lighter card/accent container bg
  accentBorder: string;
  badgeBg: string; // e.g. text/border/bg for subtle metrics
  lightBg: string; // screen background tint
  
  // Texts
  textStrong: string;
  textAccent: string;
  textMuted: string;
  
  // Interactive Elements
  focusRing: string;
  borderFocus: string;
  tabActive: string;
  tabInactive: string;
  
  // Custom button styling for sweetalert & modal
  btnPrimaryHex: string; // Hex for sweetalert buttons
  primaryBtnText: string; // Tailwind class for high contrast text on primary button
  primaryBtnTextHex: string; // Hex code for high contrast text on primary buttons
}

export const THEME_PRESETS: Record<ThemePreset['id'], ThemePreset> = {
  purple: {
    id: 'purple',
    name: 'ม่วงพาสเทล / Lavender Purple',
    primaryBg: 'bg-purple-400',
    primaryHoverBg: 'hover:bg-purple-500',
    accentBg: 'bg-purple-50/60',
    accentBorder: 'border-purple-100',
    badgeBg: 'bg-purple-50 border-purple-100/50 text-purple-700',
    lightBg: 'bg-[#fcfaff]',
    textStrong: 'text-purple-950',
    textAccent: 'text-purple-600',
    textMuted: 'text-purple-400',
    focusRing: 'focus:ring-purple-200',
    borderFocus: 'focus:border-purple-400',
    tabActive: 'bg-purple-400 text-purple-950 font-black shadow-sm border border-purple-300',
    tabInactive: 'bg-slate-50 hover:bg-purple-50 text-slate-500',
    btnPrimaryHex: '#c084fc',
    primaryBtnText: 'text-purple-950 font-extrabold',
    primaryBtnTextHex: '#2e004f'
  },
  pink: {
    id: 'pink',
    name: 'ชมพูพาสเทล / Sakura Pink',
    primaryBg: 'bg-pink-400',
    primaryHoverBg: 'hover:bg-pink-500',
    accentBg: 'bg-pink-50/60',
    accentBorder: 'border-pink-100',
    badgeBg: 'bg-pink-50 border-pink-100/50 text-pink-700',
    lightBg: 'bg-[#fff9fa]',
    textStrong: 'text-rose-950',
    textAccent: 'text-pink-600',
    textMuted: 'text-pink-400',
    focusRing: 'focus:ring-pink-250',
    borderFocus: 'focus:border-pink-400',
    tabActive: 'bg-pink-400 text-rose-950 font-black shadow-sm border border-pink-300',
    tabInactive: 'bg-slate-50 hover:bg-pink-50 text-slate-500',
    btnPrimaryHex: '#f472b6',
    primaryBtnText: 'text-rose-950 font-extrabold',
    primaryBtnTextHex: '#4c0519'
  },
  blue: {
    id: 'blue',
    name: 'ฟ้าพาสเทล / Sky Blue',
    primaryBg: 'bg-sky-400',
    primaryHoverBg: 'hover:bg-sky-500',
    accentBg: 'bg-sky-50/60',
    accentBorder: 'border-sky-100',
    badgeBg: 'bg-sky-50 border-sky-100/50 text-sky-700',
    lightBg: 'bg-[#f9fcff]',
    textStrong: 'text-blue-950',
    textAccent: 'text-sky-600',
    textMuted: 'text-sky-400',
    focusRing: 'focus:ring-sky-200',
    borderFocus: 'focus:border-sky-400',
    tabActive: 'bg-sky-400 text-blue-950 font-black shadow-sm border border-sky-300',
    tabInactive: 'bg-slate-50 hover:bg-sky-50 text-slate-500',
    btnPrimaryHex: '#38bdf8',
    primaryBtnText: 'text-blue-950 font-extrabold',
    primaryBtnTextHex: '#081e51'
  },
  emerald: {
    id: 'emerald',
    name: 'เขียวพาสเทล / Matcha Mint',
    primaryBg: 'bg-emerald-400',
    primaryHoverBg: 'hover:bg-emerald-500',
    accentBg: 'bg-emerald-50/60',
    accentBorder: 'border-emerald-100',
    badgeBg: 'bg-emerald-50 border-emerald-100/50 text-emerald-700',
    lightBg: 'bg-[#fafdff]',
    textStrong: 'text-emerald-950',
    textAccent: 'text-emerald-600',
    textMuted: 'text-emerald-400',
    focusRing: 'focus:ring-emerald-250',
    borderFocus: 'focus:border-emerald-400',
    tabActive: 'bg-emerald-400 text-emerald-950 font-black shadow-sm border border-emerald-300',
    tabInactive: 'bg-slate-50 hover:bg-purple-50 text-slate-500',
    btnPrimaryHex: '#34d399',
    primaryBtnText: 'text-emerald-950 font-extrabold',
    primaryBtnTextHex: '#022c22'
  },
  orange: {
    id: 'orange',
    name: 'ส้มพีชพาสเทล / Peach Sorbet',
    primaryBg: 'bg-orange-400',
    primaryHoverBg: 'hover:bg-orange-500',
    accentBg: 'bg-orange-50/60',
    accentBorder: 'border-orange-100',
    badgeBg: 'bg-orange-50 border-orange-100/50 text-orange-700',
    lightBg: 'bg-[#fffbfa]',
    textStrong: 'text-orange-950',
    textAccent: 'text-orange-600',
    textMuted: 'text-orange-405',
    focusRing: 'focus:ring-orange-200',
    borderFocus: 'focus:border-orange-400',
    tabActive: 'bg-orange-400 text-orange-950 font-black shadow-sm border border-orange-300',
    tabInactive: 'bg-slate-50 hover:bg-pink-50 text-slate-500',
    btnPrimaryHex: '#fb923c',
    primaryBtnText: 'text-orange-950 font-extrabold',
    primaryBtnTextHex: '#431407'
  }
};
