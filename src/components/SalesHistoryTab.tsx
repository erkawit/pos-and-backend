import React, { useState, useMemo } from 'react';
import { usePos } from '../context/PosContext';
import { Sale } from '../types';
import { BillingReceiptModal } from './BillingReceiptModal';
import { 
  Calendar, FileSpreadsheet, FileText, Printer, 
  Search, Eye, RefreshCw, Layers, DollarSign, 
  TrendingUp, CircleDollarSign, ReceiptText 
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import Swal from 'sweetalert2';
import { formatThaiBuddhistDate } from '../utils/thaiDateHelper';


export const SalesHistoryTab: React.FC = () => {
  const { sales } = usePos();
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    // Default to empty (view all) or current date
    return '';
  });
  const [searchInvoice, setSearchInvoice] = useState('');
  
  // Modal for individual receipt reproduction
  const [selectedReceipt, setSelectedReceipt] = useState<Sale | null>(null);

  // Filter sales list based on selected parameters
  const filteredSales = sales.filter(s => {
    const matchesDate = selectedDate ? s.date === selectedDate : true;
    const matchesInvoice = searchInvoice ? 
      s.invoiceId.toLowerCase().includes(searchInvoice.toLowerCase()) || 
      (s.memberName && s.memberName.toLowerCase().includes(searchInvoice.toLowerCase())) : true;
    return matchesDate && matchesInvoice;
  });

  // KPI calculations on filtered items
  const totalSalesAmount = filteredSales.reduce((sum, s) => sum + s.totalAmount, 0);
  
  // Calculate Cost and estimated Profits
  const totalCostOfGoods = filteredSales.reduce((totalCost, s) => {
    const itemsCost = s.items.reduce((cost, item) => cost + (item.cost * item.quantity), 0);
    return totalCost + itemsCost;
  }, 0);

  const estimatedProfit = Math.max(0, totalSalesAmount - totalCostOfGoods);

  // Chart data calculations
  const last7DaysData = useMemo(() => {
    // Generate dates for the last 7 calendar days ending at designated date (or today)
    const dates: string[] = [];
    const baseDate = selectedDate ? new Date(selectedDate) : new Date();
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() - i);
      dates.push(d.toISOString().split('T')[0]);
    }
    
    // Sum sales and profits per day
    return dates.map(dateStr => {
      const salesOnDate = sales.filter(s => s.date === dateStr);
      const total = salesOnDate.reduce((sum, s) => sum + s.totalAmount, 0);
      const cost = salesOnDate.reduce((sum, s) => {
        return sum + s.items.reduce((itemSum, item) => itemSum + (item.cost * item.quantity), 0);
      }, 0);
      const profit = Math.max(0, total - cost);
      
      const dateObj = new Date(dateStr);
      const thDayNames = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
      const label = `${thDayNames[dateObj.getDay()]} (${dateObj.getDate()}/${dateObj.getMonth() + 1})`;
      
      return {
        date: dateStr,
        label,
        "ยอดขาย": total,
        "กำไร": profit,
      };
    });
  }, [sales, selectedDate]);

  const topProductsData = useMemo(() => {
    const itemMap: { [productName: string]: { qty: number; value: number } } = {};
    
    // Run through filtered sales to count items matching filter criteria
    filteredSales.forEach(s => {
      s.items.forEach(item => {
        const name = item.productName;
        if (!itemMap[name]) {
          itemMap[name] = { qty: 0, value: 0 };
        }
        itemMap[name].qty += item.quantity;
        itemMap[name].value += item.total;
      });
    });
    
    const list = Object.entries(itemMap).map(([name, stats]) => ({
      name,
      value: stats.value,
      qty: stats.qty
    }));
    
    list.sort((a, b) => b.value - a.value);
    
    if (list.length === 0) {
      return [];
    }
    
    const top5 = list.slice(0, 5);
    if (list.length > 5) {
      const othersValue = list.slice(5).reduce((sum, item) => sum + item.value, 0);
      const othersQty = list.slice(5).reduce((sum, item) => sum + item.qty, 0);
      top5.push({
        name: 'อื่นๆ',
        value: othersValue,
        qty: othersQty
      });
    }
    return top5;
  }, [filteredSales]);

  const COLORS = ['#a855f7', '#6366f1', '#10b981', '#f43f5e', '#f59e0b', '#cbd5e1'];

  // EXPORT EXCEL-COMPATIBLE CSV FUNCTION (With UTF-8 BOM so Thai characters are intact!)
  const exportToExcelCSV = () => {
    if (filteredSales.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'ไม่มีข้อมูลระวาง',
        text: 'ขออภัย ไม่มีข้อมูลรายการประวัติการขายในช่วงเวลานี้เพื่อทำการส่งออกรายงาน',
        confirmButtonColor: '#9333ea',
      });
      return;
    }

    const headers = [
      'รหัสใบเสร็จ (Invoice ID)', 
      'วันที่ขาย (Date)', 
      'เวลาทำธุรกรรม (Time)', 
      'รายการสินค้า (Items Details)',
      'มูลค่ายอดขายรวม (Total Amount)', 
      'รับชำระเงินสด (Cash Received)', 
      'เงินทอน (Change)', 
      'ช่องทางชำระเงิน (Payment Method)', 
      'ลูกค้าสมาชิก (Customer Member)', 
      'คะแนนสะสมที่ได้ (Points Earned)'
    ];

    const rows = filteredSales.map(s => {
      const itemsDetail = s.items.map(i => `${i.productName} (x${i.quantity} @${i.price})`).join(' | ');
      return [
        s.invoiceId,
        s.date,
        new Date(s.timestamp).toLocaleTimeString('th-TH'),
        `"${itemsDetail.replace(/"/g, '""')}"`, // wrap in quotations and escape inner quotes
        s.totalAmount,
        s.cashReceived,
        s.change,
        s.paymentMethod === 'Cash' ? 'เงินสด' : 'QR PromptPay',
        s.memberName || 'ลูกค้าทั่วไป',
        s.pointsEarned
      ];
    });

    // Setup UTF-8 BOM header
    let csvContent = '\uFEFF'; 
    csvContent += headers.join(',') + '\n';
    rows.forEach(row => {
      csvContent += row.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Set descriptive file name with date parameters
    const fileSuffix = selectedDate ? `report-${selectedDate}` : 'report-all';
    link.setAttribute('download', `thai_pos_sales_${fileSuffix}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'ส่งออกรายงานการขายสำเร็จ! 📊',
      text: `ดาวน์โหลดไฟล์รายงาน ${fileSuffix}.csv สมบูรณ์`,
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true
    });
  };

  const handlePrintWholeReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Summary Indicator Cards (KPI block) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total revenue */}
        <div className="bg-white p-5 rounded-2xl border border-pink-50 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">ยอดรวมยอดขายรวม (Gross)</span>
            <span className="text-2xl font-bold font-mono text-purple-600 block">
              ฿{totalSalesAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-slate-400 block font-sans">จากรายการค้าทั้งหมดวันนี้</span>
          </div>
          <div className="p-3 bg-purple-50 text-purple-500 rounded-xl">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Goods cost estimation */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">ต้นทุนวัตถุดิบสินค้า</span>
            <span className="text-2xl font-bold font-mono text-slate-600 block">
              ฿{totalCostOfGoods.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-slate-400 block font-sans">คำนวณจากราคาทุนประวัติ</span>
          </div>
          <div className="p-3 bg-slate-50 text-slate-500 rounded-xl">
            <CircleDollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Calculated profit metrics */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wider block">กำไรสุทธิทั้งหมด (Profits)</span>
            <span className="text-2xl font-bold font-mono text-emerald-600 block">
              ฿{estimatedProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-slate-400 block font-medium flex items-center gap-1 text-emerald-600 font-sans">
              <TrendingUp className="w-3.5 h-3.5" />
              อัตรากำไร ~{totalSalesAmount > 0 ? Math.round((estimatedProfit / totalSalesAmount) * 100) : 0}%
            </span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Count of transactions tickets */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-2xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">จำนวนตั๋วทำรายการ</span>
            <span className="text-2xl font-bold font-mono text-indigo-600 block">
              {filteredSales.length} ใบเสร็จ
            </span>
            <span className="text-[10px] text-slate-400 block font-sans">ตั๋วรับเงิน / เอกสารทางการเงิน</span>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <ReceiptText className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* 1.5 Dynamic Interactive Data Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print">
        
        {/* Weekly sales report bar chart */}
        <div className="lg:col-span-2 bg-white p-5 rounded-3xl border border-pink-50/60 shadow-2xs flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="font-bold text-sm text-slate-700 tracking-wide">ยอดขายและกำไรสะสม (7 วันที่ผ่านมา)</h3>
              <p className="text-[11px] text-slate-400 font-medium">ภาพรวมเปรียบเทียบมูลค่ารวมและสัดส่วนกำไรรายวันในสัปดาห์</p>
            </div>
            <div className="flex gap-3 text-[10px] font-bold">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-purple-500 rounded-sm shadow-2xs" />ยอดขาย (Gross)</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-sm shadow-2xs" />กำไร (Profit)</span>
            </div>
          </div>
          
          <div className="h-60 w-full font-sans">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={last7DaysData}
                margin={{ top: 10, right: 10, left: -22, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="label" 
                  tickLine={false} 
                  axisLine={false}
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 550 }}
                />
                <YAxis 
                  tickLine={false} 
                  axisLine={false}
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 550 }}
                  tickFormatter={(v) => `฿${v}`}
                />
                <Tooltip 
                  formatter={(value: any) => [`฿${Number(value).toLocaleString()}`, '']}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', fontSize: '11px', fontWeight: 'bold' }}
                />
                <Bar dataKey="ยอดขาย" fill="#a855f7" radius={[4, 4, 0, 0]} barSize={21} />
                <Bar dataKey="กำไร" fill="#10b981" radius={[4, 4, 0, 0]} barSize={21} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Selling Products pie chart */}
        <div className="bg-white p-5 rounded-3xl border border-pink-50/60 shadow-2xs flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-700 tracking-wide">สัดส่วนสินค้าขายดี</h3>
            <p className="text-[11px] text-slate-400 font-medium">ส่วนแบ่งรายได้ตามรายการจำหน่าย 5 ลำดับแรก</p>
          </div>
          
          <div className="h-44 w-full relative flex items-center justify-center my-1.5 font-sans">
            {topProductsData.length === 0 ? (
              <div className="text-center text-xs text-slate-400 py-12">ยังไม่มีประวัติการทำรายการสินค้าในรอบนี้</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={topProductsData}
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={68}
                      paddingAngle={2.5}
                      dataKey="value"
                    >
                      {topProductsData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="focus:outline-hidden" />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any, name: any, props: any) => [
                        `฿${Number(value).toLocaleString()} (x${props.payload.qty})`, 
                        name
                      ]}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', fontSize: '11px', fontWeight: 'bold' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">ยอดรวมรวม</span>
                  <span className="text-xs font-extrabold text-slate-700">
                    ฿{topProductsData.reduce((s, x) => s + x.value, 0).toLocaleString()}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Quick interactive Legend labels */}
          <div className="space-y-1.5 pt-2 border-t border-slate-50">
            {topProductsData.length === 0 ? (
              <div className="text-[10px] text-slate-400 text-center">ไม่มีข้อมูลแจกแจง</div>
            ) : (
              topProductsData.slice(0, 4).map((entry, idx) => {
                const totalVal = topProductsData.reduce((s, x) => s + x.value, 0);
                const percent = totalVal > 0 ? Math.round((entry.value / totalVal) * 100) : 0;
                return (
                  <div key={entry.name} className="flex items-center justify-between text-[11px] font-sans">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span className="text-slate-600 font-semibold truncate" title={entry.name}>{entry.name}</span>
                    </div>
                    <span className="font-mono text-slate-400 font-bold shrink-0">{percent}% ({entry.qty} ชิ้น)</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* 2. Controls, Reports, and Dates */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl shadow-2xs border border-slate-100 no-print">
        
        {/* Search selectors */}
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อลูกค้า หรือ เลขที่ใบเสร็จ..."
              value={searchInvoice}
              onChange={(e) => setSearchInvoice(e.target.value)}
              className="w-full sm:w-64 pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder-slate-400 text-slate-700 font-sans focus:outline-hidden focus:ring-2 focus:ring-pink-200/50 focus:border-pink-300"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent border-0 text-xs text-slate-700 focus:outline-hidden font-mono"
              />
              {selectedDate && (
                <button 
                  onClick={() => setSelectedDate('')}
                  className="text-[10px] text-rose-500 hover:text-rose-700 font-bold ml-1 cursor-pointer"
                  title="เคลียร์วันที่"
                >
                  ล้างคำค้น
                </button>
              )}
            </div>
            {selectedDate && (
              <span className="text-[10px] text-purple-700 font-bold bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100 sm:ml-2">
                📅 ปฏิทินไทย: {formatThaiBuddhistDate(selectedDate)}
              </span>
            )}
          </div>

        </div>

        {/* Exports actions */}
        <div className="flex gap-2 w-full sm:w-auto">
          
          <button
            onClick={exportToExcelCSV}
            className="flex-1 sm:flex-initial py-2 px-4 border border-pink-100 text-slate-600 hover:bg-pink-50/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-teal-600" />
            ส่งออก Excel (CSV)
          </button>

          <button
            onClick={handlePrintWholeReport}
            className="flex-1 sm:flex-initial py-2 px-4 bg-gradient-to-r from-pink-400 to-purple-400 hover:from-pink-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer animate-pulse"
          >
            <Printer className="w-4 h-4" />
            พิมพ์รายงานสรุป (PDF)
          </button>

        </div>

      </div>

      {/* 3. Sales ledger list */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        
        {filteredSales.length === 0 ? (
          <div className="py-20 text-center">
            <ReceiptText className="w-12 h-12 text-slate-300 mx-auto mb-4 stroke-1" />
            <p className="text-slate-400 font-medium text-sm">ไม่พบประวัติใบเสร็จทางการเงินในรอบนี้</p>
            <p className="text-xs text-slate-400 mt-1">กรุณาลองเปลี่ยนวันที่ ค้นหากวาด หรือรับการสั่งหน้าร้านเพิ่ม</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs font-semibold uppercase">
                  <th className="py-4 px-6">เลขที่ตั๋วใบเสร็จ</th>
                  <th className="py-4 px-6">วัน-เวลาขาย</th>
                  <th className="py-4 px-6">ช่องทางชำระ</th>
                  <th className="py-4 px-6">ลูกค้าสมาชิก</th>
                  <th className="py-4 px-6 text-right">ยอดรวมค่าบริการ</th>
                  <th className="py-4 px-6 text-center">สถานะซิงค์</th>
                  <th className="py-4 px-6 text-right">ใบเสร็จ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-600">
                {filteredSales.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                    
                    {/* Invoice ID */}
                    <td className="py-4 px-6 font-mono text-xs font-bold text-slate-800">
                      {s.invoiceId}
                    </td>

                    {/* Timestamp */}
                    <td className="py-4 px-6 text-xs text-slate-500 font-mono">
                      {new Date(s.timestamp).toLocaleString('th-TH')}
                    </td>

                    {/* Method */}
                    <td className="py-4 px-6">
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                        s.paymentMethod === 'Cash' 
                          ? 'bg-purple-50 text-purple-700' 
                          : s.paymentMethod === 'TrueMoney'
                          ? 'bg-orange-50 text-orange-700 border border-orange-100'
                          : 'bg-pink-50 text-pink-700 border border-pink-100/30'
                      }`}>
                        {s.paymentMethod === 'Cash' ? 'เงินสด' : s.paymentMethod === 'TrueMoney' ? 'TrueMoney' : 'PromptPay QR'}
                      </span>
                    </td>

                    {/* Member */}
                    <td className="py-4 px-6">
                      {s.memberName ? (
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-700">{s.memberName}</span>
                          {s.pointsEarned > 0 && (
                            <span className="text-[10px] text-emerald-600 font-medium">ได้รับ +{s.pointsEarned} แต้ม</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">ลูกค้าทั่วไป</span>
                      )}
                    </td>

                    {/* Total */}
                    <td className="py-4 px-6 text-right font-bold font-mono text-slate-800">
                      ฿{s.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>

                    {/* Offline-first Sync Status indicators */}
                    <td className="py-4 px-6 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${s.synced !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100 animate-pulse'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${s.synced !== false ? 'bg-emerald-500' : 'bg-amber-400'}`}></span>
                        {s.synced !== false ? 'ซิงค์แล้ว' : 'เก็บในเครื่อง'}
                      </span>
                    </td>

                    {/* Receipt reproducer button */}
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => setSelectedReceipt(s)}
                        className="py-1 px-3 bg-purple-50 text-purple-600 hover:bg-purple-100 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        เรียกดู
                      </button>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Virtual modal for selected isolated receipt reproduction details */}
      {selectedReceipt && (
        <BillingReceiptModal 
          sale={selectedReceipt} 
          onClose={() => setSelectedReceipt(null)} 
        />
      )}

      {/* Real print-only copy of the daily summaries for general printer styles */}
      <div className="print-only fixed inset-0 bg-white z-999 p-12 font-sans text-sm text-black leading-relaxed">
        <h2 className="text-center text-xl font-bold uppercase mb-2">รายงานสรุปยอดขายคลังหน้าร้านและการเงิน</h2>
        <p className="text-center text-xs text-neutral-500 mb-6">พิมพ์เมื่อวันที่: {new Date().toLocaleString('th-TH')}</p>
        
        <table className="w-full text-left mb-6 py-2 border-t border-b border-black">
          <thead>
            <tr className="font-bold border-b border-black py-2">
              <th>ตัวบ่งชี้การเงิน</th>
              <th className="text-right">จำนวนตั๋ว</th>
              <th className="text-right">มูลค่ารวม (฿)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-neutral-200">
              <td className="py-2 font-medium">ยอดเงินสดขายรวมทั้งสิ้น (Gross Revenue)</td>
              <td className="text-right py-2">{filteredSales.length} รายการ</td>
              <td className="text-right py-2 font-mono font-bold">฿{totalSalesAmount.toLocaleString()}</td>
            </tr>
            <tr className="border-b border-neutral-200">
              <td className="py-2">ต้นทุนทางวัตถุดิบและพัสดุ (Cost Of Goods)</td>
              <td className="text-right py-2">-</td>
              <td className="text-right py-2 font-mono text-neutral-700">฿{totalCostOfGoods.toLocaleString()}</td>
            </tr>
            <tr>
              <td className="py-2 text-emerald-700 font-bold">ประมาณการกำไรสุทธิทั้งหมด (Net Profit Value)</td>
              <td className="text-right py-2">-</td>
              <td className="text-right py-2 font-mono font-bold text-emerald-600">฿{estimatedProfit.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>

        <h3 className="font-bold text-sm mb-2 mt-8">รายละเอียดรายการใบเสร็จทั้งหมด ({filteredSales.length} ใบเสร็จ)</h3>
        <table className="w-full text-[10px] text-left border-collapse border border-neutral-300">
          <thead>
            <tr className="bg-neutral-100 border border-neutral-300 font-bold text-neutral-700">
              <th className="p-2">เลขที่ใบเสร็จ</th>
              <th className="p-2">วันเวลาขาย</th>
              <th className="p-2">ช่องทาง</th>
              <th className="p-2">ลูกค้าสมาชิก</th>
              <th className="p-2 text-right">ยอดสุทธิ (฿)</th>
            </tr>
          </thead>
          <tbody>
            {filteredSales.map(s => (
              <tr key={s.id} className="border border-neutral-200">
                <td className="p-2 font-mono">{s.invoiceId}</td>
                <td className="p-2 font-mono">{new Date(s.timestamp).toLocaleString('th-TH')}</td>
                <td className="p-2">{s.paymentMethod === 'Cash' ? 'เงินสด' : s.paymentMethod === 'TrueMoney' ? 'TrueMoney' : 'PromptPay QR'}</td>
                <td className="p-2">{s.memberName || 'ลูกค้าทั่วไป'}</td>
                <td className="p-2 text-right font-mono font-bold">฿{s.totalAmount.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
};
