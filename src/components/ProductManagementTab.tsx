import React, { useState, useRef } from 'react';
import { usePos } from '../context/PosContext';
import { Product, Unit } from '../types';
import { compressImage } from '../utils/imageCompressor';
import { 
  Plus, Search, Edit2, Trash2, Sliders, 
  Settings, Layers, ChevronDown, Check, AlertTriangle, 
  Upload, Image as ImageIcon, X, Save, Edit, RefreshCw, Keyboard
} from 'lucide-react';
import Swal from 'sweetalert2';
import { promptNumpad } from '../utils/thaiNumpad';


export const ProductManagementTab: React.FC = () => {
  const { 
    products, units, addProduct, updateProduct, deleteProduct,
    addUnit, updateUnit, deleteUnit, user 
  } = usePos();

  const alertAdminRequired = (actionName: string) => {
    Swal.fire({
      icon: 'warning',
      title: 'จำกัดสิทธิ์การเข้าถึง',
      text: `คุณไม่สามารถ${actionName}ได้ เนื่องจากสิทธิ์ของพนักงานขาย (Staff) ไม่ได้รับอนุญาตให้แก้ไขสต็อกและคลังสินค้า จำเป็นต้องลงชื่อเข้าใช้ด้วยบัญชีแอดมินเท่านั้นค่ะ`,
      confirmButtonColor: '#9333ea',
    });
  };

  const [search, setSearch] = useState('');
  const [selectedSubTab, setSelectedSubTab] = useState<'all' | 'low-stock'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  // Modals / forms toggle states
  const [isEditingProduct, setIsEditingProduct] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  
  const [isManagingUnits, setIsManagingUnits] = useState(false);

  // Product form variables
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [price, setPrice] = useState(0);
  const [cost, setCost] = useState(0);
  const [stock, setStock] = useState(0);
  const [safetyStock, setSafetyStock] = useState(0);
  const [selectedUnit, setSelectedUnit] = useState('');
  const [category, setCategory] = useState('');
  const [image, setImage] = useState<string>(''); // base64 string
  
  const [imagePreview, setImagePreview] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isImageOptimizing, setIsImageOptimizing] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Barcode Auto-run logic
  const autoGenerateBarcodeForCategory = (catType: 'SN' | 'DK' | 'DS') => {
    const prefix = catType;
    const samePrefixProducts = products.filter(p => p.barcode && p.barcode.startsWith(`${prefix}-`));
    
    let maxNum = 0;
    samePrefixProducts.forEach(p => {
      const match = p.barcode.match(new RegExp(`^${prefix}-(\\d+)`));
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    
    const nextNum = maxNum + 1;
    const zeroPadded = String(nextNum).padStart(3, '0');
    const newBarcode = `${prefix}-${zeroPadded}`;
    
    setBarcode(newBarcode);
    
    // Auto-set category name for convenience
    if (catType === 'SN') setCategory('ขนม');
    else if (catType === 'DK') setCategory('เครื่องดื่ม');
    else if (catType === 'DS') setCategory('ของหวาน');
  };

  // Numpad handlers for form fields
  const handleCostNumpad = async () => {
    const result = await promptNumpad({ title: 'ระบุราคาทุนต่อหน่วย (฿)', defaultValue: cost });
    if (result !== null) {
      setCost(result);
    }
  };

  const handlePriceNumpad = async () => {
    const result = await promptNumpad({ title: 'ระบุราคาขายหน้าร้าน (฿)', defaultValue: price });
    if (result !== null) {
      setPrice(result);
    }
  };

  const handleStockNumpad = async () => {
    const result = await promptNumpad({ title: 'ระบุจำนวนสต็อกสินค้าในคลัง', defaultValue: stock, allowDecimal: false });
    if (result !== null) {
      setStock(result);
    }
  };

  const handleSafetyStockNumpad = async () => {
    const result = await promptNumpad({ title: 'ระบุระดับเกณฑ์เตือนสต็อกต่ำ', defaultValue: safetyStock, allowDecimal: false });
    if (result !== null) {
      setSafetyStock(result);
    }
  };

  // Unit form variables
  const [isEditingUnit, setIsEditingUnit] = useState<string | null>(null); // holds unit id
  const [unitNameInput, setUnitNameInput] = useState('');
  const [newUnitName, setNewUnitName] = useState('');

  // List of unique categories for dynamic filtering
  const categories = React.useMemo(() => {
    const list = new Set<string>();
    products.forEach(p => {
      const cat = p.category ? p.category.trim() : '';
      if (cat) {
        list.add(cat);
      }
    });
    return ['All', ...Array.from(list)];
  }, [products]);

  // Filtering products
  const filteredProducts = React.useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                            (p.barcode && p.barcode.includes(search)) ||
                            (p.category && p.category.toLowerCase().includes(search.toLowerCase()));
      
      const pCat = p.category ? p.category.trim() : 'ทั่วไป';
      const matchesCategory = selectedCategory === 'All' ? true : pCat === selectedCategory;
      
      if (selectedSubTab === 'low-stock') {
        return matchesSearch && matchesCategory && (p.stock <= p.safetyStock);
      }
      return matchesSearch && matchesCategory;
    });
  }, [products, search, selectedCategory, selectedSubTab]);

  // Image upload handler with preview & optimization
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    try {
      setIsImageOptimizing(true);
      setFormError(null);
      const optimizedBase64 = await compressImage(files[0]);
      setImage(optimizedBase64);
      setImagePreview(optimizedBase64);
    } catch (err) {
      console.error(err);
      setFormError('ไม่สามารถอัพโหลดหรือบีบอัดไฟล์รูปภาพได้');
    } finally {
      setIsImageOptimizing(false);
    }
  };

  const openAddProductModal = () => {
    if (user?.role === 'general') {
      alertAdminRequired('เพิ่มสินค้าใหม่');
      return;
    }
    setCurrentProduct(null);
    setName('');
    setBarcode('');
    setPrice(0);
    setCost(0);
    setStock(10);
    setSafetyStock(5);
    setSelectedUnit(units[0]?.name || 'ชิ้น');
    setCategory('เครื่องดื่ม');
    setImage('');
    setImagePreview('');
    setFormError(null);
    setIsEditingProduct(true);
  };

  const openEditProductModal = (p: Product) => {
    if (user?.role === 'general') {
      alertAdminRequired('แก้ไขสินค้า');
      return;
    }
    setCurrentProduct(p);
    setName(p.name);
    setBarcode(p.barcode || '');
    setPrice(p.price);
    setCost(p.cost);
    setStock(p.stock);
    setSafetyStock(p.safetyStock || 0);
    setSelectedUnit(p.unit);
    setCategory(p.category || '');
    setImage(p.image || '');
    setImagePreview(p.image || '');
    setFormError(null);
    setIsEditingProduct(true);
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('กรุณากรอกชื่อสินค้า');
      return;
    }
    if (price < 0 || cost < 0 || stock < 0 || safetyStock < 0) {
      setFormError('ค่าตัวเลขราคา ต้นทุน และสต็อก ต้องมีค่าไม่ต่ำกว่า 0');
      return;
    }

    const payload = {
      name: name.trim(),
      barcode: barcode.trim(),
      price: Number(price),
      cost: Number(cost),
      stock: Number(stock),
      safetyStock: Number(safetyStock),
      unit: selectedUnit || units[0]?.name || 'ชิ้น',
      category: category.trim() || 'อื่นๆ',
      image: image
    };

    try {
      if (currentProduct) {
        await updateProduct(currentProduct.id, payload);
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: 'ปรับปรุงข้อมูลสินค้าสำเร็จ! 🎉',
          showConfirmButton: false,
          timer: 2500,
          timerProgressBar: true
        });
      } else {
        await addProduct(payload);
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: 'เพิ่มสินค้าและลงสต็อกสำเร็จ! 🎉',
          showConfirmButton: false,
          timer: 2500,
          timerProgressBar: true
        });
      }
      setIsEditingProduct(false);
    } catch (err) {
      setFormError('ไม่สามารถบันทึกสินค้าข้อมูลลงในระบบได้');
    }
  };

  const handleDeleteProduct = async (id: string, nameName: string) => {
    if (user?.role === 'general') {
      alertAdminRequired('ลบสินค้า');
      return;
    }
    Swal.fire({
      title: 'ยืนยันการลบสินค้า?',
      text: `คุณแน่ใจหรือไม่ที่จะทำการลบสินค้า: "${nameName}" ออกจากคลังสินค้าถาวร?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ลบสินค้า',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
    }).then(async (result) => {
      if (result.isConfirmed) {
        await deleteProduct(id);
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: 'ลบสินค้าสำเร็จแล้ว 🗑️',
          showConfirmButton: false,
          timer: 2000,
          timerProgressBar: true
        });
      }
    });
  };

  // Units management operations
  const handleAddUnitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnitName.trim()) return;
    
    // Check if unit name already exists
    const exists = units.some(u => u.name.trim() === newUnitName.trim());
    if (exists) {
      Swal.fire({
        icon: 'error',
        title: 'ขออภัย',
        text: 'หน่วยนับนี้มีอยู่ในระบบแล้ว',
        confirmButtonColor: '#ef4444'
      });
      return;
    }

    await addUnit(newUnitName.trim());
    setNewUnitName('');
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'เพิ่มหน่วยนับสำเร็จ! 📦',
      showConfirmButton: false,
      timer: 2000,
      timerProgressBar: true
    });
  };

  const handleUpdateUnitSubmit = async (id: string) => {
    if (!unitNameInput.trim()) return;
    await updateUnit(id, unitNameInput.trim());
    setIsEditingUnit(null);
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'แก้ไขหน่วยนับสำเร็จ! 📦',
      showConfirmButton: false,
      timer: 2000,
      timerProgressBar: true
    });
  };

  const handleDeleteUnit = async (id: string, uName: string) => {
    // Check if any product is using this unit
    const isUsed = products.some(p => p.unit === uName);
    if (isUsed) {
      Swal.fire({
        icon: 'error',
        title: 'ไม่สามารถลบได้',
        text: `ไม่สามารถลบหน่วยนับ "${uName}" ได้ เนื่องจากมีสินค้าในคลังใช้งานหน่วยนับนี้อยู่`,
        confirmButtonColor: '#ef4444'
      });
      return;
    }
    
    Swal.fire({
      title: 'ยืนยันลบหน่วยนับ?',
      text: `คุณต้องการลบหน่วยนับ: "${uName}" หรือไม่?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ลบหน่วยนับ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b'
    }).then(async (result) => {
      if (result.isConfirmed) {
        await deleteUnit(id);
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: 'ลบหน่วยนับสำเร็จ! 🗑️',
          showConfirmButton: false,
          timer: 2000,
          timerProgressBar: true
        });
      }
    });
  };

  return (
    <div className="space-y-6">
      
      {/* Product categories subtabs bar */}
      <div className="flex flex-col md:flex-row justify-between gap-4 bg-white p-4 rounded-2xl shadow-xs border border-slate-100 no-print">
        
        {/* Toggle between All goods and Deficits */}
        <div className="flex bg-pink-50/50 p-1 rounded-xl self-start border border-pink-100/40">
          <button
            onClick={() => setSelectedSubTab('all')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${selectedSubTab === 'all' ? 'bg-white text-purple-700 shadow-xs border border-pink-100/50' : 'text-slate-500 hover:text-purple-600'}`}
          >
            สินค้าทั้งหมด ({products.length})
          </button>
          <button
            onClick={() => setSelectedSubTab('low-stock')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${selectedSubTab === 'low-stock' ? 'bg-rose-400 text-white shadow-xs font-semibold' : 'text-rose-500 hover:bg-rose-50/50'}`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            เตือนสต็อกต่ำ ({products.filter(p => p.stock <= p.safetyStock).length})
          </button>
        </div>

        {/* Buttons to trigger managers */}
        <div className="flex gap-2">
          
          <button
            onClick={() => {
              if (user?.role === 'general') {
                alertAdminRequired('จัดการหน่วยนับ');
                return;
              }
              setIsManagingUnits(true);
            }}
            className="py-2 px-4 border border-pink-100 text-slate-600 hover:bg-pink-50/35 rounded-xl text-xs font-medium transition-all flex items-center gap-2 cursor-pointer"
          >
            <Layers className="w-4 h-4 text-purple-400" />
            จัดการหน่วยนับ
          </button>

          <button
            onClick={openAddProductModal}
            className="py-2.5 px-5 bg-gradient-to-r from-pink-400 to-purple-400 hover:from-pink-500 hover:to-purple-500 font-bold text-white rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2 text-xs cursor-pointer"
          >
            <Plus className="w-4.5 h-4.5" />
            เพิ่มสินค้าคลังใหม่
          </button>

        </div>

      </div>

      {/* Control panel: search filter & Category filter */}
      <div className="bg-white p-4.5 rounded-2xl border border-pink-50/60 shadow-2xs space-y-3.5 no-print">
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
          
          {/* Quick Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-purple-400" />
            <input
              type="text"
              placeholder="ค้นสินค้าด้วย ชื่อสินค้า, บาร์โค้ด..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50/50 hover:bg-slate-100/50 border border-pink-100/30 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-purple-200/55 focus:border-purple-350 text-xs font-semibold text-slate-700 placeholder-slate-400/80 font-sans transition-all"
            />
          </div>

          {/* Category Filter Pills (Horizontal Scrolling Row) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0 scrollbar-none flex-1 lg:justify-end">
            <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap">
              คัดตามหมวดหมู่:
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

        </div>
      </div>

      {/* Products table grid */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        
        {filteredProducts.length === 0 ? (
          <div className="py-20 text-center">
            <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-4 stroke-1" />
            <p className="text-slate-400 font-medium text-sm">ไม่พบข้อมูลสินค้าตรงตามที่ระบุ</p>
            <p className="text-xs text-slate-400 mt-1">กรุณาลองระบุใหม่อีกครั้ง หรือเพิ่มสินค้าเข้าระบบสต็อก</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs font-semibold uppercase">
                  <th className="py-4 px-6">รูปสินค้า</th>
                  <th className="py-4 px-6">ชื่อสินค้า / บาร์โค้ด</th>
                  <th className="py-4 px-6">หมวดหมู่</th>
                  <th className="py-4 px-6 text-right">ต้นทุน</th>
                  <th className="py-4 px-6 text-right">ราคาขาย</th>
                  <th className="py-4 px-6 text-center">จำนวนในสต็อก</th>
                  <th className="py-4 px-6 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-600">
                {filteredProducts.map((p) => {
                  const isLowStock = p.stock <= p.safetyStock;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Image Preview thumbnail */}
                      <td className="py-4 px-6">
                        {p.image ? (
                          <img 
                            src={p.image} 
                            alt={p.name} 
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 object-cover rounded-lg border border-slate-100 shadow-2xs" 
                          />
                        ) : (
                          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                            <ImageIcon className="w-5 h-5 stroke-1" />
                          </div>
                        )}
                      </td>

                      {/* Product Name & SKU */}
                      <td className="py-4 px-6">
                        <div className="font-semibold text-slate-800">{p.name}</div>
                        {p.barcode && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">Barcode: {p.barcode}</div>
                        )}
                      </td>

                      {/* Category tag */}
                      <td className="py-4 px-6">
                        <span className="inline-flex px-2 py-0.5 bg-purple-50 text-purple-700 rounded-md text-[11px] font-medium border border-purple-100/30">
                          {p.category || 'ทั่วไป'}
                        </span>
                      </td>

                      {/* Cost price */}
                      <td className="py-4 px-6 text-right font-mono font-medium">
                        ฿{p.cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>

                      {/* Selling price */}
                      <td className="py-4 px-6 text-right font-mono font-bold text-purple-600">
                        ฿{p.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>

                      {/* Stock units balance checking with safety thresholds alerts */}
                      <td className="py-4 px-6 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className={`font-mono text-xs font-bold px-2 py-1 rounded-sm ${isLowStock ? 'bg-rose-50 text-rose-700 font-semibold border border-rose-100' : 'bg-purple-50 text-purple-700 border border-purple-100/40'}`}>
                            {p.stock} {p.unit}
                          </span>
                          {isLowStock && (
                            <span className="flex h-2 w-2 relative" title="จุดเตือนภัย สต็อกต่ำกว่าที่กำหนด">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                            </span>
                          )}
                        </div>
                        {isLowStock && (
                          <div className="text-[9px] text-rose-600 font-medium mt-1">ใกล้หมด! (เกณฑ์: {p.safetyStock} {p.unit})</div>
                        )}
                      </td>

                      {/* Controls */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditProductModal(p)}
                            className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
                            title="แก้ไขสินค้า"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p.id, p.name)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                            title="ลบสินค้า"
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

      {/* 1. Modal: Create / Edit Product Form */}
      {isEditingProduct && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-semibold text-slate-800">
                {currentProduct ? 'แก้ไขข้อมูลสินค้าคลัง' : 'เพิ่มสินค้าคลังใหม่'}
              </h3>
              <button 
                onClick={() => setIsEditingProduct(false)}
                className="p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProductSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs font-semibold">
                  {formError}
                </div>
              )}

              {/* Image Preview & Upload component */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">รูปภาพสินค้า</label>
                <div className="flex items-center gap-4">
                  
                  {imagePreview ? (
                    <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-pink-100 bg-slate-100 group">
                      <img 
                        src={imagePreview} 
                        alt="Preview" 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover" 
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setImage('');
                          setImagePreview('');
                        }}
                        className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center text-white cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-20 h-20 rounded-xl border-2 border-dashed border-pink-100 bg-pink-50/20 flex flex-col items-center justify-center text-rose-400 hover:border-pink-300 hover:text-pink-500 cursor-pointer transition-all"
                    >
                      {isImageOptimizing ? (
                        <RefreshCw className="w-6 h-6 animate-spin text-pink-400" />
                      ) : (
                        <>
                          <Upload className="w-5 h-5 stroke-1.5" />
                          <span className="text-[9px] mt-1">อัพโหลด</span>
                        </>
                      )}
                    </div>
                  )}

                  <div className="flex-1 text-xs text-slate-400">
                    <p className="font-semibold text-slate-500">รองรับไฟล์ JPEG, PNG สูงสุด 5MB</p>
                    <p className="mt-0.5">ระบบจะบีบอัดรูปภาพอัตโนมัติ เพื่อรองรับการเข้าถึงที่รวดเร็วและประหยัดพื้นที่ฐานข้อมูล</p>
                  </div>

                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleImageChange}
                    accept="image/*" 
                    className="hidden" 
                  />

                </div>
              </div>

              {/* Grid 2 Column fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Product spec name */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">ชื่อสินค้า *</label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น ชาเชียวนมสดมัทฉะพรีเมียม"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm text-slate-700 transition"
                  />
                </div>

                {/* SKU / Barcode lookup code */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5 flex justify-between">
                    <span>รหัสบาร์โค้ด / SKU</span>
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น SN-001 หรือระบุกรอกคีย์เอง"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono text-sm text-slate-700 transition"
                  />
                  {/* Category-based sequential barcode running selectors */}
                  <div className="mt-2 space-y-1">
                    <p className="text-[10px] font-bold text-slate-450 uppercase tracking-widest">⚡ ดึงและรันรหัสเลขเริ่มต้นที่ 001 ตามประเภทหลัก</p>
                    <div className="flex gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => autoGenerateBarcodeForCategory('SN')}
                        className="px-2.5 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 text-[10px] font-bold rounded-lg cursor-pointer transition animate-bounce"
                      >
                        🍭 ขนม (SN)
                      </button>
                      <button
                        type="button"
                        onClick={() => autoGenerateBarcodeForCategory('DK')}
                        className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-[10px] font-bold rounded-lg cursor-pointer transition animate-bounce"
                      >
                        🥤 เครื่องดื่ม (DK)
                      </button>
                      <button
                        type="button"
                        onClick={() => autoGenerateBarcodeForCategory('DS')}
                        className="px-2.5 py-1 bg-amber-55 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 text-[10px] font-bold rounded-lg cursor-pointer transition animate-bounce"
                      >
                        🍰 ของหวาน (DS)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Category classification */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5 flex justify-between">
                    <span>หมวดหมู่ *</span>
                    <span className="text-slate-400 font-normal">(เลือกด้านบน หรือพิมพ์เอง)</span>
                  </label>
                  <input
                    type="text"
                    list="category-suggestions"
                    placeholder="เช่น เครื่องดื่ม, ขนม, วัตถุดิบ..."
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-300 text-sm text-slate-700 transition"
                  />
                  <datalist id="category-suggestions">
                    <option value="เครื่องดื่ม" />
                    <option value="ขนม" />
                    <option value="ของหวาน" />
                    <option value="วัตถุดิบ" />
                    <option value="ของใช้" />
                    <option value="เบเกอรี่" />
                    <option value="อาหารสด" />
                    <option value="อาหารแห้ง" />
                    <option value="เครื่องปรุง" />
                  </datalist>

                  {/* Suggestion Quick Pills */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {['เครื่องดื่ม', 'ขนม', 'ของหวาน', 'วัตถุดิบ', 'ของใช้'].map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setCategory(sug)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition duration-150 cursor-pointer ${
                          category === sug 
                            ? 'bg-purple-100/80 text-purple-700 border-purple-200' 
                            : 'bg-white border-slate-200/80 text-slate-500 hover:text-purple-600 hover:border-purple-200'
                        }`}
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cost price inputs */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5 flex justify-between">
                    <span>ราคาทุนต่อชิ้น * (฿)</span>
                    <button type="button" onClick={handleCostNumpad} className="text-[10px] text-purple-600 hover:underline font-bold flex items-center gap-0.5 select-none">
                      <Keyboard className="w-3.5 h-3.5" /> แป้นพิมพ์ตัวเลข
                    </button>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      readOnly
                      required
                      value={cost}
                      onClick={handleCostNumpad}
                      className="w-full pl-4 pr-12 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono text-sm text-slate-700 transition cursor-pointer hover:bg-slate-100"
                    />
                    <button
                      type="button"
                      onClick={handleCostNumpad}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-purple-650 transition cursor-pointer"
                      title="กดเพื่อเปิดเครื่องช่วยกรอกตัวเลขแบบแป้นสัมผัส"
                    >
                      <Keyboard className="w-5 h-5 text-slate-400 hover:text-purple-550" />
                    </button>
                  </div>
                </div>

                {/* Selling price inputs */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5 flex justify-between">
                    <span>ราคาขายหน้าร้าน * (฿)</span>
                    <button type="button" onClick={handlePriceNumpad} className="text-[10px] text-purple-600 hover:underline font-bold flex items-center gap-0.5 select-none">
                      <Keyboard className="w-3.5 h-3.5" /> แป้นพิมพ์ตัวเลข
                    </button>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      readOnly
                      required
                      value={price}
                      onClick={handlePriceNumpad}
                      className="w-full pl-4 pr-12 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono text-sm text-slate-700 transition cursor-pointer hover:bg-slate-100"
                    />
                    <button
                      type="button"
                      onClick={handlePriceNumpad}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-purple-650 transition cursor-pointer"
                      title="กดเพื่อเปิดเครื่องช่วยกรอกตัวเลขแบบแป้นสัมผัส"
                    >
                      <Keyboard className="w-5 h-5 text-slate-400 hover:text-purple-550" />
                    </button>
                  </div>
                </div>

                {/* Initial stock values */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5 flex justify-between">
                    <span>จำนวนสต็อกในคลัง *</span>
                    <button type="button" onClick={handleStockNumpad} className="text-[10px] text-purple-600 hover:underline font-bold flex items-center gap-0.5 select-none">
                      <Keyboard className="w-3.5 h-3.5" /> แป้นพิมพ์ตัวเลข
                    </button>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      readOnly
                      required
                      value={stock}
                      onClick={handleStockNumpad}
                      className="w-full pl-4 pr-12 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono text-sm text-slate-700 transition cursor-pointer hover:bg-slate-100"
                    />
                    <button
                      type="button"
                      onClick={handleStockNumpad}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-purple-650 transition cursor-pointer"
                      title="กดเพื่อเปิดเครื่องช่วยกรอกตัวเลขแบบแป้นสัมผัส"
                    >
                      <Keyboard className="w-5 h-5 text-slate-400 hover:text-purple-550" />
                    </button>
                  </div>
                </div>

                {/* Safety limits parameter definitions */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5 flex justify-between">
                    <span>จุดเกณฑ์เตือนภัยแจงเตือน *</span>
                    <button type="button" onClick={handleSafetyStockNumpad} className="text-[10px] text-purple-650 hover:underline font-bold flex items-center gap-0.5 select-none">
                      <Keyboard className="w-3.5 h-3.5" /> แป้นพิมพ์ตัวเลข
                    </button>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      readOnly
                      required
                      value={safetyStock}
                      onClick={handleSafetyStockNumpad}
                      className="w-full pl-4 pr-12 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono text-sm text-slate-700 transition cursor-pointer hover:bg-slate-100"
                    />
                    <button
                      type="button"
                      onClick={handleSafetyStockNumpad}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-purple-650 transition cursor-pointer"
                      title="กดเพื่อเปิดเครื่องช่วยกรอกตัวเลขแบบแป้นสัมผัส"
                    >
                      <Keyboard className="w-5 h-5 text-slate-400 hover:text-purple-550" />
                    </button>
                  </div>
                </div>

                {/* Measurement Unit dropdown selections */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">หน่วยนับที่กำหนด *</label>
                  <select
                    value={selectedUnit}
                    onChange={(e) => setSelectedUnit(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm text-slate-700 transition"
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.name}>{u.name}</option>
                    ))}
                    {units.length === 0 && (
                      <option value="ชิ้น">ชิ้น (ไม่มีหน่วยระบุในระบบ)</option>
                    )}
                  </select>
                </div>

              </div>

               {/* Save trigger actions */}
              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditingProduct(false)}
                  className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition text-sm font-semibold"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isImageOptimizing}
                  className="flex-1 py-2.5 bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 hover:from-pink-500 hover:to-purple-500 text-white font-bold rounded-xl transition shadow-md flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  บันทึกสินค้าข้อมูล
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* 2. Modal: Units Management panel */}
      {isManagingUnits && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 no-print">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-md w-full overflow-hidden flex flex-col max-h-[85vh]">
            
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-500" />
                จัดการหน่วยพิกัดนับ (Units)
              </h3>
              <button 
                onClick={() => setIsManagingUnits(false)}
                className="p-1 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-6">
              
              {/* Form to insert new unit */}
              <form onSubmit={handleAddUnitSubmit} className="flex gap-2">
                <input
                  type="text"
                  placeholder="เช่น ห่อ, กิโลกรัม, แพ็ค..."
                  value={newUnitName}
                  onChange={(e) => setNewUnitName(e.target.value)}
                  className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-pink-200/50 focus:border-pink-300 text-sm text-slate-700 transition"
                />
                <button
                  type="submit"
                  className="px-4 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-xl transition text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  เพิ่มหน่วย
                </button>
              </form>

              {/* Existing Units list */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-tight">รายนามหน่วยพิกัดนับปัจจุบัน ({units.length})</h4>
                
                {units.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">ยังไม่ได้ระบุหน่วยนับในระบบ</p>
                ) : (
                  <div className="divide-y divide-slate-100 border border-pink-50 rounded-xl overflow-hidden bg-slate-50">
                    {units.map((u) => (
                      <div key={u.id} className="flex items-center justify-between p-3 bg-white hover:bg-pink-50/10 transition-colors">
                        
                        {isEditingUnit === u.id ? (
                          <div className="flex gap-1 flex-1 mr-2">
                            <input
                              type="text"
                              value={unitNameInput}
                              onChange={(e) => setUnitNameInput(e.target.value)}
                              className="flex-1 px-2.5 py-1 text-xs border border-purple-400 rounded-md focus:outline-hidden"
                            />
                            <button
                              onClick={() => handleUpdateUnitSubmit(u.id)}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setIsEditingUnit(null)}
                              className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-sm font-semibold text-slate-700">{u.name}</span>
                        )}

                        {isEditingUnit !== u.id && (
                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={() => {
                                setIsEditingUnit(u.id);
                                setUnitNameInput(u.name);
                              }}
                              className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition cursor-pointer"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteUnit(u.id, u.name)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 text-right">
              <button
                onClick={() => setIsManagingUnits(false)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl transition text-xs font-medium"
              >
                เสร็จสิ้น / ปิดหน้ารายชื่อ
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
