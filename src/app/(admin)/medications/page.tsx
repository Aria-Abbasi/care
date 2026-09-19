"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Pill, Plus, Search, AlertCircle, Check, X,
  Clock, Package, User, PlusCircle, MinusCircle, Edit3
} from "lucide-react";
import { toPersianDigits } from "@/lib/jalali";

interface Medication {
  id: string;
  nameFa: string;
  nameEn?: string | null;
  dosage?: string | null;
  unit?: string | null;
  boxNumber?: string | null;
  instructions?: string | null;
  doctorName?: string | null;
  stockCount: number;
  lowStockThreshold: number;
  timeConstraints?: string | null;
  isActive: boolean;
}

export default function AdminMedicationsPage() {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMed, setEditingMed] = useState<Medication | null>(null);

  // Form state
  const [formNameFa, setFormNameFa] = useState("");
  const [formBoxNumber, setFormBoxNumber] = useState("");
  const [formInstructions, setFormInstructions] = useState("");
  const [formDoctorName, setFormDoctorName] = useState("");
  const [formStockCount, setFormStockCount] = useState("100");
  const [formTimeConstraints, setFormTimeConstraints] = useState("");

  const fetchMeds = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/medications");
      if (res.ok) {
        const data = await res.json();
        setMedications(data.medications || []);
      }
    } catch (err) {
      console.error("Failed to load medications:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMeds();
  }, [fetchMeds]);

  function openCreateModal() {
    setEditingMed(null);
    setFormNameFa("");
    setFormBoxNumber("");
    setFormInstructions("");
    setFormDoctorName("");
    setFormStockCount("100");
    setFormTimeConstraints("");
    setIsModalOpen(true);
  }

  function openEditModal(med: Medication) {
    setEditingMed(med);
    setFormNameFa(med.nameFa);
    setFormBoxNumber(med.boxNumber || "");
    setFormInstructions(med.instructions || "");
    setFormDoctorName(med.doctorName || "");
    setFormStockCount(med.stockCount.toString());
    setFormTimeConstraints(med.timeConstraints || "");
    setIsModalOpen(true);
  }

  async function handleSaveMed() {
    if (!formNameFa) return;

    try {
      if (editingMed) {
        await fetch("/api/admin/medications", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingMed.id,
            nameFa: formNameFa,
            boxNumber: formBoxNumber,
            instructions: formInstructions,
            doctorName: formDoctorName,
            stockCount: parseInt(formStockCount, 10) || 0,
            timeConstraints: formTimeConstraints,
          }),
        });
      } else {
        await fetch("/api/admin/medications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nameFa: formNameFa,
            boxNumber: formBoxNumber,
            instructions: formInstructions,
            doctorName: formDoctorName,
            stockCount: parseInt(formStockCount, 10) || 100,
            timeConstraints: formTimeConstraints,
          }),
        });
      }
      setIsModalOpen(false);
      fetchMeds();
    } catch (err) {
      console.error("Save medication error:", err);
    }
  }

  async function updateStockDelta(id: string, delta: number) {
    try {
      await fetch("/api/admin/medications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, stockDelta: delta }),
      });
      setMedications((prev) =>
        prev.map((m) => (m.id === id ? { ...m, stockCount: m.stockCount + delta } : m))
      );
    } catch (err) {
      console.error("Stock update error:", err);
    }
  }

  const filteredMeds = medications.filter(
    (m) =>
      m.nameFa.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.boxNumber && m.boxNumber.includes(searchQuery)) ||
      (m.doctorName && m.doctorName.includes(searchQuery))
  );

  const lowStockCount = medications.filter((m) => m.stockCount <= m.lowStockThreshold).length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <Pill className="w-6 h-6 text-emerald-600" />
            <span>پروتکل داروها، جعبه‌ها و موجودی انبار</span>
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-slate-500 mt-1">
            مدیریت شماره جعبه در منزل، شروط زمانی و هشدار اتمام موجودی قرص‌ها
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-4 py-2.5 rounded-2xl bg-care-600 hover:bg-care-700 text-white font-bold text-xs shadow-md shadow-care-600/30 flex items-center gap-1.5 transition active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>افزودن داروی جدید</span>
        </button>
      </div>

      {/* Low Stock Warning Banner */}
      {lowStockCount > 0 && (
        <div className="p-4 rounded-3xl bg-amber-50 border border-amber-300 text-amber-900 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <span className="text-xs font-black">
              توجه: {toPersianDigits(lowStockCount)} قلم دارو به حداقل موجودی رسیده‌اند و نیاز به تهیه دارند.
            </span>
          </div>
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search className="w-5 h-5 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="جستجوی نام دارو، شماره جعبه (مثلاً ۱ یا ۸) یا نام پزشک..."
          className="w-full pr-12 pl-4 py-3 rounded-2xl bg-white border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm"
        />
      </div>

      {/* Medication Cards / Table */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredMeds.map((med) => {
          const isLowStock = med.stockCount <= med.lowStockThreshold;

          return (
            <div
              key={med.id}
              className={`p-5 rounded-3xl bg-white border-2 transition shadow-sm flex flex-col justify-between ${
                isLowStock ? "border-amber-300 bg-amber-50/20" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div>
                {/* Card Header: Name + Box Number */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {med.boxNumber && (
                      <span className="px-2.5 py-1 rounded-xl bg-slate-900 text-white font-black text-xs">
                        جعبه {toPersianDigits(med.boxNumber)}
                      </span>
                    )}
                    <h2 className="text-sm font-black text-slate-900">{med.nameFa}</h2>
                  </div>

                  <button
                    onClick={() => openEditModal(med)}
                    className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition"
                    title="ویرایش"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>

                {/* Instructions */}
                {med.instructions && (
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                    {med.instructions}
                  </p>
                )}

                {/* Constraints Badge */}
                {med.timeConstraints && (
                  <div className="mt-2.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-bold">
                    <Clock className="w-3 h-3 text-rose-600 flex-shrink-0" />
                    <span>شرط زمانی: {med.timeConstraints}</span>
                  </div>
                )}

                {med.doctorName && (
                  <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-500 font-semibold">
                    <User className="w-3.5 h-3.5 text-emerald-600" />
                    <span>پزشک تجویزکننده: {med.doctorName}</span>
                  </div>
                )}
              </div>

              {/* Card Footer: Stock Inventory Controls */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-bold text-slate-600">موجودی در منزل:</span>
                  <span
                    className={`font-mono text-sm font-black ${
                      isLowStock ? "text-amber-700 font-bold" : "text-slate-900"
                    }`}
                  >
                    {toPersianDigits(med.stockCount)} عدد
                  </span>
                  {isLowStock && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 text-[10px] font-bold">
                      رو به اتمام
                    </span>
                  )}
                </div>

                {/* Quick Increment / Decrement */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => updateStockDelta(med.id, -1)}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 active:scale-90 transition"
                    title="کاهش ۱ عدد"
                  >
                    <MinusCircle className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => updateStockDelta(med.id, 10)}
                    className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-[11px] font-bold transition active:scale-95"
                    title="خرید یک بسته (۱۰ تایی)"
                  >
                    +۱۰
                  </button>
                  <button
                    onClick={() => updateStockDelta(med.id, 1)}
                    className="p-1 rounded-lg text-slate-400 hover:text-emerald-600 active:scale-90 transition"
                    title="افزایش ۱ عدد"
                  >
                    <PlusCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h2 className="text-base font-black text-slate-900">
                {editingMed ? "ویرایش دارو" : "افزودن داروی جدید"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نام کامل دارو (فارسی / انگلیسی)</label>
                <input
                  type="text"
                  value={formNameFa}
                  onChange={(e) => setFormNameFa(e.target.value)}
                  placeholder="مثلاً پنتوپرازول 40"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">شماره جعبه در منزل</label>
                  <input
                    type="text"
                    value={formBoxNumber}
                    onChange={(e) => setFormBoxNumber(e.target.value)}
                    placeholder="مثلاً 8"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">موجودی فعلی (عدد)</label>
                  <input
                    type="number"
                    value={formStockCount}
                    onChange={(e) => setFormStockCount(e.target.value)}
                    placeholder="100"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نام پزشک معالج</label>
                <input
                  type="text"
                  value={formDoctorName}
                  onChange={(e) => setFormDoctorName(e.target.value)}
                  placeholder="مثلاً دکتر علایی"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">دستور مصرف بالینی</label>
                <textarea
                  rows={2}
                  value={formInstructions}
                  onChange={(e) => setFormInstructions(e.target.value)}
                  placeholder="یک بار در روز - نیم ساعت قبل ناهار..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  شروط زمانی خاص یا تداخل دارویی (اختیاری)
                </label>
                <input
                  type="text"
                  value={formTimeConstraints}
                  onChange={(e) => setFormTimeConstraints(e.target.value)}
                  placeholder="رأس ۳۰ دقیقه قبل ناهار / ۲ ساعت فاصله با منیزیم"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-slate-600 text-xs font-bold hover:bg-slate-100"
              >
                انصراف
              </button>
              <button
                onClick={handleSaveMed}
                className="px-5 py-2.5 rounded-xl bg-care-600 hover:bg-care-700 text-white font-bold text-xs shadow-md shadow-care-600/30"
              >
                ذخیره دارو
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
