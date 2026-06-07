import React, { useState } from 'react';
import { usePos } from '../context/PosContext';
import { Member } from '../types';
import { 
  Plus, Search, Edit2, Trash2, Award, UserPlus, Phone, X, Save, 
  CreditCard, Calendar, RefreshCw, CalendarDays, ClipboardList, Keyboard
} from 'lucide-react';
import Swal from 'sweetalert2';
import { promptNumpad } from '../utils/thaiNumpad';
import { formatThaiBuddhistDate } from '../utils/thaiDateHelper';


export const MemberManagementTab: React.FC = () => {
  const { 
    members, 
    addMember, 
    updateMember, 
    deleteMember,
    memberCards,
    generateMemberCards,
    deleteMemberCard
  } = usePos();

  const [activeTab, setActiveTab] = useState<'members' | 'cards'>('members');
  const [search, setSearch] = useState('');
  
  // Card printing controls
  const [generateCount, setGenerateCount] = useState<number>(10);
  const [isGenerating, setIsGenerating] = useState(false);

  // Modals / Editors state
  const [isEditing, setIsEditing] = useState(false);
  const [currentMember, setCurrentMember] = useState<Member | null>(null);
  
  // Form input pools
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [points, setPoints] = useState(0);
  const [birthday, setBirthday] = useState('');
  const [memberCode, setMemberCode] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Filter members based on search (name, phone, or card number)
  const filteredMembers = members.filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.phone.includes(search) ||
    (m.memberCode && m.memberCode.toLowerCase().includes(search.toLowerCase()))
  );

  const openAddModal = () => {
    setCurrentMember(null);
    setName('');
    setPhone('');
    setPoints(0);
    setBirthday('');
    setMemberCode('');
    setFormError(null);
    setIsEditing(true);
  };

  const openEditModal = (m: Member) => {
    setCurrentMember(m);
    setName(m.name);
    setPhone(m.phone);
    setPoints(m.points);
    setBirthday(m.birthday || '');
    setMemberCode(m.memberCode || '');
    setFormError(null);
    setIsEditing(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('กรุณากรอกชื่อ-นามสกุลสมาชิก');
      return;
    }
    if (!phone.trim() || phone.length < 9) {
      setFormError('กรุณากรอกเบอร์โทรศัพท์ที่ถูกต้อง (อย่างน้อย 9 หลัก)');
      return;
    }

    try {
      if (currentMember) {
        // Edit Action
        await updateMember(currentMember.id, {
          name: name.trim(),
          phone: phone.trim(),
          points: Number(points),
          birthday: birthday || undefined,
          memberCode: memberCode || undefined
        });
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: 'ปรับปรุงข้อมูลสมาชิกสำเร็จ! 👥',
          showConfirmButton: false,
          timer: 2000,
          timerProgressBar: true
        });
      } else {
        // Add Action
        const exists = members.some(m => m.phone.replace(/[^0-9]/g, '') === phone.replace(/[^0-9]/g, ''));
        if (exists) {
          setFormError('เบอร์โทรศัพท์นี้ถูกใช้งานในการสมัครสมาชิกไปแล้ว');
          return;
        }

        await addMember({
          name: name.trim(),
          phone: phone.trim(),
          birthday: birthday || undefined,
          memberCode: memberCode || undefined
        });
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: 'สมัครสมาชิกสำเร็จ! 👥',
          showConfirmButton: false,
          timer: 2000,
          timerProgressBar: true
        });
      }
      setIsEditing(false);
    } catch (err) {
      setFormError('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    Swal.fire({
      title: 'ยกเลิกสมาชิกภาพ?',
      text: `คุณแน่ใจหรือไม่ที่จะทำการลบหรือยกเลิกสมาชิก: "${name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ลบสมาชิก',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b'
    }).then(async (result) => {
      if (result.isConfirmed) {
        await deleteMember(id);
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: 'ลบข้อมูลสมาชิกเรียบร้อย 🗑️',
          showConfirmButton: false,
          timer: 2000,
          timerProgressBar: true
        });
      }
    });
  };

  const handleBulkGenerateCards = async () => {
    if (generateCount <= 0 || generateCount > 500) {
      Swal.fire({
        icon: 'error',
        title: 'จำนวนไม่ถูกต้อง',
        text: 'กรุณาระบุจำนวนที่ต้องการสร้างตั้งแต่ 1 ถึง 500 ใบ'
      });
      return;
    }

    setIsGenerating(true);
    try {
      await generateMemberCards(generateCount);
      Swal.fire({
        icon: 'success',
        title: 'สร้างบัตรสมาชิกสำเร็จ! 💳',
        text: `ระบบสร้างบัตรสมาชิกหมายเลขรัน sequential จำนวน ${generateCount} ใบ เรียบร้อยแล้ว`,
        confirmButtonColor: '#ca8a04'
      });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'ล้มเหลว',
        text: 'เกิดความผิดพลาดในการออกรหัสบัตรสมาชิกใหม่'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Convert Gregorian date to pretty Thai date format
  const formatThaiDate = (isoStr?: string) => {
    return formatThaiBuddhistDate(isoStr);
  };

  const handleGenerateCountNumpad = async () => {
    const result = await promptNumpad({ title: 'จำนวนบัตรว่างที่จะสร้าง (ใบ)', defaultValue: generateCount, allowDecimal: false });
    if (result !== null) {
      setGenerateCount(result);
    }
  };

  const handlePointsNumpad = async () => {
    const result = await promptNumpad({ title: 'ปรับคะแนนสะสมของสมาชิก', defaultValue: points, allowDecimal: false });
    if (result !== null) {
      setPoints(result);
    }
  };


  return (
    <div className="space-y-6">
      
      {/* Sub tabs navigation */}
      <div className="flex border-b border-slate-100 bg-white p-1 rounded-xl shadow-xs gap-1 max-w-md">
        <button
          onClick={() => setActiveTab('members')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === 'members'
              ? 'bg-gradient-to-r from-pink-500/10 to-purple-500/10 text-purple-700'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          ฐานสัญญาสมาชิก ({members.length})
        </button>
        <button
          onClick={() => setActiveTab('cards')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            activeTab === 'cards'
              ? 'bg-gradient-to-r from-pink-500/10 to-purple-500/10 text-purple-700'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          บัตรสะสมแต้มว่าง ({memberCards.length})
        </button>
      </div>

      {activeTab === 'members' && (
        <>
          {/* Top action deck */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-xs border border-slate-100">
            
            {/* Search Input bar */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหาด้วยชื่อ เบอร์โทร หรือรหัสบัตร RF-XXXXX..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-pink-200/50 focus:border-pink-300 text-sm placeholder-slate-400 text-slate-700 transition-all font-sans"
              />
            </div>

            {/* Plus Registrations triggers */}
            <button
              onClick={openAddModal}
              className="py-2.5 px-5 bg-gradient-to-r from-pink-400 to-purple-400 hover:from-pink-500 hover:to-purple-500 font-bold text-white rounded-xl transition-all shadow-md hover:shadow-purple-400/10 active:scale-95 flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              <UserPlus className="w-4.5 h-4.5" />
              ลงทะเบียนสมาชิกใหม่
            </button>

          </div>

          {/* Members Table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
            
            {filteredMembers.length === 0 ? (
              <div className="py-16 text-center">
                <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-4 stroke-1" />
                <p className="text-slate-400 font-medium text-sm">ไม่พบรายชื่อสมาชิกหรือลูกค้าในระบบ</p>
                <p className="text-xs text-slate-400 mt-1">กรุณาลองเปลี่ยนคำค้นหา หรือสมัครสมาชิกคนแรก</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs font-semibold uppercase">
                      <th className="py-4 px-6">ข้อมูลทั่วไปสมาชิก</th>
                      <th className="py-4 px-6">รหัสบัตร / เบอร์โทร</th>
                      <th className="py-4 px-6 text-center">วันสมรสเกิด / วันสมัคร</th>
                      <th className="py-4 px-6 text-center">คะแนนสะสม (Points)</th>
                      <th className="py-4 px-6">ระดับชั้น</th>
                      <th className="py-4 px-6 text-right">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-600">
                    {filteredMembers.map((m) => {
                      let tierColor = 'bg-slate-100 text-slate-600';
                      let tierName = 'ทั่วไป';
                      if (m.points >= 300) {
                        tierColor = 'bg-amber-100 text-amber-800 border border-amber-200';
                        tierName = 'ทอง (Gold)';
                      } else if (m.points >= 100) {
                        tierColor = 'bg-indigo-100 text-indigo-800 border border-indigo-200';
                        tierName = 'เงิน (Silver)';
                      }

                      return (
                        <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 px-6 font-medium text-slate-800">
                            <span className="block text-slate-900 font-semibold">{m.name}</span>
                          </td>
                          <td className="py-4 px-6">
                            <div className="space-y-1">
                              {m.memberCode ? (
                                <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm font-mono font-bold">
                                  <CreditCard className="w-3 h-3" />
                                  {m.memberCode}
                                </span>
                              ) : (
                                <span className="inline-block bg-slate-100 text-slate-400 text-[10px] px-1.5 py-0.5 rounded-sm">
                                  ไม่ได้ผูกบัตร
                                </span>
                              )}
                              <div className="flex items-center gap-1 font-mono text-[11px] text-slate-500">
                                <Phone className="w-3 h-3 text-slate-400" />
                                {m.phone}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-center">
                            <div className="space-y-0.5">
                              <div className="text-xs text-slate-700 flex items-center justify-center gap-1">
                                <CalendarDays className="w-3 h-3 text-slate-400" />
                                {formatThaiDate(m.birthday)}
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono block">
                                สมัคร: {formatThaiDate(m.createdAt)}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-center font-bold font-mono text-purple-600">
                            {m.points.toLocaleString()}
                          </td>
                          <td className="py-4 px-6">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${tierColor}`}>
                              <Award className="w-3 h-3" />
                              {tierName}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openEditModal(m)}
                                className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all cursor-pointer"
                                title="แก้ไขสมาชิก"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(m.id, m.name)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                title="ลบข้อมูล"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

          </div>
        </>
      )}

      {activeTab === 'cards' && (
        <div className="space-y-6">
          {/* Card Generator Panel */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">ระบบออกบัตรสมาชิกว่าง (บัตรรันโค้ดอัตโนมัติ)</h3>
                <p className="text-xs text-slate-400">สร้างชุดรหัสเลขบัตรสมาชิก sequential ออฟไลน์/ออนไลน์ มีความปลอดภัย และสามารถลบการสร้างได้ตลอดเวลา</p>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-end gap-3 max-w-lg">
              <div className="flex-1 w-full">
                <label className="block text-xs font-bold text-slate-500 mb-1.5 flex justify-between">
                  <span>ต้องการสร้างบัตรจำนวนกี่ใบ? (เริ่มต้นที่ รหัสแรกสุด RF-10001)</span>
                  <button type="button" onClick={handleGenerateCountNumpad} className="text-[10px] text-purple-600 hover:underline font-bold flex items-center gap-0.5 select-none">
                    <Keyboard className="w-3.5 h-3.5" /> แป้นพิมพ์ตัวเลข
                  </button>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    placeholder="เช่น 10"
                    value={generateCount}
                    onClick={handleGenerateCountNumpad}
                    className="w-full pl-4 pr-12 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-purple-200 text-sm font-semibold text-slate-700 transition cursor-pointer hover:bg-slate-100"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateCountNumpad}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-purple-650 transition cursor-pointer"
                    title="กดเพื่อเปิดเครื่องช่วยกรอกตัวเลขแบบแป้นสัมผัส"
                  >
                    <Keyboard className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
              </div>
              <button
                type="button"
                disabled={isGenerating}
                onClick={handleBulkGenerateCards}
                className="py-2.5 px-6 shrink-0 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-700 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shadow"
              >
                <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                {isGenerating ? 'กำลังสร้าง...' : 'คลิกเพื่อกดยืนยันการสร้าง'}
              </button>
            </div>

            {/* Quick selectors count shortcuts */}
            <div className="flex gap-1.5 flex-wrap">
              {[5, 10, 20, 50, 100].map((num) => (
                <button
                  key={num}
                  onClick={() => setGenerateCount(num)}
                  className={`px-3 py-1 text-xs rounded-lg font-mono border transition ${
                    generateCount === num
                      ? 'bg-purple-100 border-purple-300 text-purple-800 font-bold'
                      : 'border-slate-250 hover:bg-slate-50 text-slate-500'
                  }`}
                >
                  +{num} ใบ
                </button>
              ))}
            </div>
          </div>

          {/* Cards pool grid visualization */}
          <div className="space-y-3">
            <h4 className="font-bold text-sm text-slate-700 flex items-center gap-1.5">
              <span>คลังบัตรสะสมแต้มว่างในระบบทั้งหมด</span>
              <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full text-[10px] font-mono">
                {memberCards.length} ใบ
              </span>
            </h4>

            {memberCards.length === 0 ? (
              <div className="bg-white py-16 text-center border border-slate-150 border-dashed rounded-2xl">
                <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-4 stroke-1" />
                <p className="text-slate-400 font-medium text-sm">ยังไม่มีบัตรสมาชิกสำหรับผูกข้อมูล</p>
                <p className="text-xs text-slate-400 mt-1">กรุณาระบุจำนวนบัตรและกดสร้างเพื่อเริ่มใช้งานระบบ</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[...memberCards].reverse().map((c) => {
                  const isAssigned = c.status === 'assigned';
                  return (
                    <div 
                      key={c.id} 
                      className={`relative bg-white border rounded-xl p-4 overflow-hidden shadow-xs transition-transform hover:-translate-y-0.5 flex flex-col justify-between h-36 ${
                        isAssigned 
                          ? 'border-purple-200 bg-linear-to-tr from-purple-50/20 to-pink-50/10' 
                          : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-mono">MEMBERSHIP CARD</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          isAssigned 
                            ? 'bg-purple-100 text-purple-700' 
                            : 'bg-green-150 text-green-700 border border-green-200'
                        }`}>
                          {isAssigned ? 'ใช้งานแล้ว' : 'ว่าง (พร้อมผูก)'}
                        </span>
                      </div>

                      <div className="text-lg font-bold font-mono tracking-wider text-slate-800 my-2">
                        {c.code}
                      </div>

                      <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
                        <div className="truncate pr-2">
                          {isAssigned ? (
                            <span className="font-semibold text-purple-800">
                              👤 {c.assignedToMemberName || 'ผูกสำเร็จ'}
                            </span>
                          ) : (
                            <span className="text-slate-400">ยังไม่ผูกผู้ใช้คนใด</span>
                          )}
                        </div>

                        {!isAssigned && (
                          <button
                            onClick={() => deleteMemberCard(c.id)}
                            className="p-1 hover:text-rose-500 hover:bg-rose-50 rounded-sm text-slate-400 transition"
                            title="ลบชุดบัตรออกจากระบบ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit/Add Member dialogue popup */}
      {isEditing && (
        <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-md w-full overflow-hidden flex flex-col">
            
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <UserPlus className="w-5 h-5 text-purple-500" />
                {currentMember ? 'แก้ไขข้อมูลสมาชิกปัจจุบัน' : 'สมัครลงทะเบียนสมาชิกใหม่'}
              </h3>
              <button 
                onClick={() => setIsEditing(false)}
                className="p-1.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs font-semibold">
                  {formError}
                </div>
              )}

              {/* Name Field */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">ชื่อ-นามสกุล (Thai Full Name)</label>
                <input
                  type="text"
                  required
                  placeholder="เช่น สมพร รักดี"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-purple-200/50 focus:border-purple-300 text-xs text-slate-705 transition font-sans"
                />
              </div>

              {/* Phone Field */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">เบอร์โทรศัพท์ (Phone Number)</label>
                <input
                  type="tel"
                  required
                  placeholder="เช่น 0891234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-purple-200/50 focus:border-purple-300 font-mono text-xs text-slate-705 transition"
                />
              </div>

              {/* Member Card Code Dropdown Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5 text-purple-500" />
                  เลือกผูกผูกกับบัตรเลข 5 หลักที่เจนแล้ว
                </label>
                <select
                  value={memberCode}
                  onChange={(e) => setMemberCode(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-purple-200/50 focus:border-purple-300 text-xs text-slate-705 transition cursor-pointer"
                >
                  <option value="">-- ไม่ระบุบัตร (สมัครเฉพาะข้อมูลก่อน) --</option>
                  
                  {/* If editing and has a card already assigned */}
                  {currentMember && currentMember.memberCode && (
                    <option value={currentMember.memberCode}>
                      บัตรปัจจุบัน: {currentMember.memberCode}
                    </option>
                  )}

                  {/* Otherwise list vacant cards */}
                  {memberCards
                    .filter(c => c.status === 'available')
                    .map(c => (
                      <option key={c.id} value={c.code}>
                        บัตรเลขว่างพิมพ์ออกมา: {c.code}
                      </option>
                    ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  บัตรที่มีรหัสขึ้นด้วย RF-XXXXX ซึ่งสแกนมาจากระบบบัตรรันโค้ดเรียบร้อย
                </p>
              </div>

              {/* Birthday Field */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-purple-500" />
                  วันเดือนปีเกิด (Birthday)
                </label>
                <input
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-purple-200/50 focus:border-purple-300 font-sans text-xs text-slate-705 transition cursor-pointer"
                />
                {birthday && (
                  <p className="text-[11px] text-purple-700 font-bold mt-1 bg-purple-50 px-2 py-1 rounded-lg inline-block border border-purple-100">
                    🙏 ปีปฏิทินไทย: {formatThaiBuddhistDate(birthday)}
                  </p>
                )}
              </div>

              {/* Points Adjustment Field (Only displayed in Editing modes) */}
              {currentMember && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5 flex justify-between">
                    <span>คะแนนสะสม (Loyalty points)</span>
                    <button type="button" onClick={handlePointsNumpad} className="text-[10px] text-purple-600 hover:underline font-bold flex items-center gap-0.5 select-none">
                      <Keyboard className="w-3.5 h-3.5" /> แป้นพิมพ์ตัวเลข
                    </button>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      readOnly
                      placeholder="ปรับปรุงแต้มสะสม"
                      value={points}
                      onClick={handlePointsNumpad}
                      className="w-full pl-4 pr-12 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-purple-200/50 focus:border-purple-300 font-mono text-xs text-slate-705 transition cursor-pointer hover:bg-slate-100"
                    />
                    <button
                      type="button"
                      onClick={handlePointsNumpad}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-purple-650 transition cursor-pointer"
                      title="กดเพื่อเปิดเครื่องช่วยกรอกตัวเลขแบบแป้นสัมผัส"
                    >
                      <Keyboard className="w-5 h-5 text-slate-400" />
                    </button>
                  </div>
                  <span className="font-mono text-[10px] text-purple-600 mt-1 block">แต้มสมาชิกภาพปัจจุบัน: {currentMember.points} PT</span>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition text-sm font-semibold"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 hover:from-pink-500 hover:to-purple-500 text-white font-bold rounded-xl transition shadow-md flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  บันทึกข้อมูล
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
