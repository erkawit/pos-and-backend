import React from 'react';
import { Sale } from '../types';
import { Printer, X, Download } from 'lucide-react';

interface BillingReceiptModalProps {
  sale: Sale;
  onClose: () => void;
}

export const BillingReceiptModal: React.FC<BillingReceiptModalProps> = ({ sale, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 no-print">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h3 className="font-medium text-slate-800">ใบเสร็จรับเงิน / Receipt</h3>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Paper Receipt container */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 flex justify-center">
          <div id="thermal-receipt" className="bg-white p-6 shadow-xs border border-slate-200 w-full max-w-xs font-mono text-xs text-slate-800 flex flex-col">
            
            {/* Store Information */}
            <div className="text-center mb-4 pb-4 border-b border-dashed border-slate-300">
              <h4 className="font-bold text-sm text-slate-900 tracking-tight uppercase">THAI STORE & POS</h4>
              <p className="text-[10px] text-slate-500 mt-1">123 ถนนสุขุมวิท, กรุงเทพฯ 10110</p>
              <p className="text-[10px] text-slate-500">โทร: 02-123-4567</p>
            </div>

            {/* Document details */}
            <div className="mb-4 text-[10px] space-y-0.5 text-slate-600">
              <div className="flex justify-between">
                <span>เลขที่ใบเสร็จ:</span>
                <span className="font-semibold text-slate-800">{sale.invoiceId}</span>
              </div>
              <div className="flex justify-between">
                <span>วันที่ขาย:</span>
                <span>{new Date(sale.timestamp).toLocaleString('th-TH')}</span>
              </div>
              <div className="flex justify-between">
                <span>พนักงานขาย:</span>
                <span>ร้านค้าระบบหลัก (Admin)</span>
              </div>
              {sale.paymentMethod && (
                <div className="flex justify-between">
                  <span>ช่องทางชำระ:</span>
                  <span>{sale.paymentMethod === 'Cash' ? 'เงินสด' : sale.paymentMethod === 'TrueMoney' ? 'TrueMoney Wallet' : 'QR PromptPay'}</span>
                </div>
              )}
              {sale.memberName && (
                <div className="flex justify-between pt-1 border-t border-slate-100 mt-1 text-purple-700 font-bold font-sans">
                  <span>ลูกค้าสมาชิก:</span>
                  <span className="font-semibold">{sale.memberName}</span>
                </div>
              )}
            </div>

            {/* Items Table */}
            <table className="w-full text-left mb-4 border-t border-b border-dashed border-slate-300 py-2">
              <thead>
                <tr className="text-[10px] text-slate-500 font-semibold uppercase">
                  <th className="py-1">รายการ</th>
                  <th className="text-right py-1">จำนวน</th>
                  <th className="text-right py-1">รวม (฿)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dotted divide-slate-200">
                {sale.items.map((item, idx) => (
                  <tr key={idx} className="font-sans text-[11px] text-slate-700">
                    <td className="py-1.5 max-w-[120px] truncate">
                      {item.productName}
                      <span className="block text-[9px] text-slate-400">@{item.price} / {item.unit}</span>
                    </td>
                    <td className="text-right py-1.5">{item.quantity}</td>
                    <td className="text-right py-1.5 font-mono text-[10px]">{item.total.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Total accounts */}
            <div className="space-y-1 mb-4 font-mono text-xs">
              <div className="flex justify-between font-bold text-slate-900 border-b border-dashed border-slate-200 pb-1.5">
                <span>ยอดสุทธิ (Total):</span>
                <span>฿{sale.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              </div>
              <div className="flex justify-between text-slate-600 text-[11px] pt-1">
                <span>รับเงิน (Received):</span>
                <span>฿{sale.cashReceived.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              </div>
              <div className="flex justify-between text-slate-600 text-[11px]">
                <span>เงินทอน (Change):</span>
                <span>฿{sale.change.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              </div>
              {sale.pointsEarned > 0 && (
                <div className="flex justify-between text-emerald-700 font-sans text-[10px] font-medium pt-1">
                  <span>คะแนนสะสมที่ได้รับ:</span>
                  <span>+{sale.pointsEarned} แต้ม</span>
                </div>
              )}
            </div>

            {/* Thank you note */}
            <div className="text-center mt-4 pt-4 border-t border-dashed border-slate-200 text-[10px] text-slate-400">
              <p>ขอบคุณที่ใช้บริการ / THANK YOU</p>
              <p className="mt-0.5">กรุณาตรวจสอบของและเงินทอนทันที</p>
            </div>

          </div>
        </div>

        {/* Footer with actions */}
        <div className="px-6 py-4 border-t border-slate-100 flex gap-2 bg-slate-50">
          <button
            onClick={onClose}
            className="flex-1 py-2 px-4 border border-slate-200 rounded-xl hover:bg-slate-100 font-semibold text-slate-600 transition-colors text-sm cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-2 px-4 bg-gradient-to-r from-pink-400 to-purple-400 hover:from-pink-500 hover:to-purple-500 font-bold text-white rounded-xl transition-all shadow-md active:scale-95 text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            พิมพ์เอกสาร
          </button>
        </div>

      </div>

      {/* Real print-only copy that renders outside the modal layout on print */}
      <div className="print-only fixed inset-0 bg-white z-999 p-10 font-mono text-sm leading-relaxed text-black">
        <div className="w-full max-w-xs mx-auto">
          <div className="text-center mb-6 pb-6 border-b border-double border-black">
            <h2 className="font-bold text-lg uppercase">THAI STORE & POS</h2>
            <p className="text-xs">123 ถนนสุขุมวิท, กรุงเทพฯ 10110</p>
            <p className="text-xs">โทร: 02-123-4567</p>
          </div>
          
          <div className="mb-6 space-y-1 text-xs">
            <div><strong>เลขที่ใบเสร็จ:</strong> {sale.invoiceId}</div>
            <div><strong>วันที่ขาย:</strong> {new Date(sale.timestamp).toLocaleString('th-TH')}</div>
            <div><strong>พนักงานขาย:</strong> ส่วนงานหลัก (POS)</div>
            {sale.paymentMethod && <div><strong>ชำระเงิน:</strong> {sale.paymentMethod === 'Cash' ? 'เงินสด' : sale.paymentMethod === 'TrueMoney' ? 'TrueMoney Wallet' : 'QR PromptPay'}</div>}
            {sale.memberName && <div className="border-t border-black pt-1 mt-1 font-sans"><strong>สมาชิก:</strong> {sale.memberName}</div>}
          </div>

          <table className="w-full text-left mb-6 border-t border-b border-dashed border-black py-2 text-xs">
            <thead>
              <tr className="font-bold">
                <th>รายการ</th>
                <th className="text-right">จำนวน</th>
                <th className="text-right">รวม (฿)</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item, idx) => (
                <tr key={idx} className="font-sans">
                  <td className="py-1">
                    {item.productName}
                    <div className="text-[10px] font-mono opacity-80">@{item.price} / {item.unit}</div>
                  </td>
                  <td className="text-right py-1">{item.quantity}</td>
                  <td className="text-right py-1 font-mono">{item.total.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between font-bold border-b border-dashed border-black pb-2">
              <span>ยอดรวมทั้งสิ้น:</span>
              <span>฿{sale.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>
            <div className="flex justify-between text-neutral-800">
              <span>รับเงินมา:</span>
              <span>฿{sale.cashReceived.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>
            <div className="flex justify-between text-neutral-800">
              <span>เงินทอน:</span>
              <span>฿{sale.change.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
            </div>
            {sale.pointsEarned > 0 && (
              <div className="flex justify-between font-bold text-black border-t border-black pt-1 mt-1">
                <span>สิทธิประโยชน์:</span>
                <span>+{sale.pointsEarned} แต้มสำหรับสมาชิก</span>
              </div>
            )}
          </div>

          <div className="text-center mt-12 pt-6 border-t border-dashed border-black text-xs">
            <p>ขอบคุณที่อุดหนุนและใช้บริการ / THANK YOU</p>
          </div>
        </div>
      </div>
    </div>
  );
};
