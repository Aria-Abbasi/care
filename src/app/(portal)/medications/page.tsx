"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Pill, Plus, Search, AlertCircle, Check, X,
  Clock, Package, User, PlusCircle, MinusCircle, Edit3,
  Calendar, FileText, Ban, RotateCcw, Info, Sparkles, Stethoscope,
  CalendarClock, CheckCircle2, History, AlertTriangle, ShieldCheck
} from "lucide-react";
import {
  toPersianDigits, formatJalaliDate, formatJalaliDateTime,
  formatJalaliFromNow, formatRecurrenceText
} from "@/lib/jalali";

interface ScheduleItem {
  id: string;
  targetTime: string;
  intervalUnit: string;
  intervalValue: number;
  startDate?: string | null;
  endDate?: string | null;
  mealRelation?: string | null;
  requiresNote?: boolean;
}

interface Medication {
  id: string;
  nameFa: string;
  nameEn?: string | null;
  dosage?: string | null;
  unit?: string | null;
  boxNumber?: string | null;
  instructions?: string | null;
  doctorName?: string | null;
  doctorOrderNotes?: string | null;
  stockCount: number;
  lowStockThreshold: number;
  timeConstraints?: string | null;
  isActive: boolean;
  discontinuedAt?: string | null;
  discontinuedReason?: string | null;
  discontinuedBy?: string | null;
  replacedById?: string | null;
  createdAt: string;
  schedules?: ScheduleItem[];
}

interface MedicationHistoryItem {
  id: string;
  medicationId?: string | null;
  medicationName: string;
  actionType: "CREATED" | "SCHEDULE_CHANGED" | "STOPPED" | "REACTIVATED";
  description: string;
  reason?: string | null;
  doctorName?: string | null;
  performedBy?: string | null;
  detailsJson?: string | null;
  createdAt: string;
}

export default function AdminMedicationsPage() {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [history, setHistory] = useState<MedicationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("ADMIN");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"active" | "discontinued" | "history" | "all">("active");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMed, setEditingMed] = useState<Medication | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Stop Medication Modal State
  const [isStopModalOpen, setIsStopModalOpen] = useState(false);
  const [stoppingMed, setStoppingMed] = useState<Medication | null>(null);
  const [stopReason, setStopReason] = useState("به دستور پزشک معالج");
  const [stopDoctorName, setStopDoctorName] = useState("");
  const [stopNotes, setStopNotes] = useState("");
  const [stopDate, setStopDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [stopSubmitting, setStopSubmitting] = useState(false);

  // Form: Medication Core Info
  const [formNameFa, setFormNameFa] = useState("");
  const [formBoxNumber, setFormBoxNumber] = useState("");
  const [formInstructions, setFormInstructions] = useState("");
  const [formDoctorName, setFormDoctorName] = useState("");
  const [formDoctorOrderNotes, setFormDoctorOrderNotes] = useState("");
  const [formStockCount, setFormStockCount] = useState("100");
  const [formLowStockThreshold, setFormLowStockThreshold] = useState("15");
  const [formTimeConstraints, setFormTimeConstraints] = useState("");

  // Form: Schedule (Create & Edit)
  const [formCreateSchedule, setFormCreateSchedule] = useState(true);
  const [formSchedTargetTime, setFormSchedTargetTime] = useState("08:00");
  const [formSchedMealRelation, setFormSchedMealRelation] = useState("NONE");
  const [formSchedIntervalPreset, setFormSchedIntervalPreset] = useState("DAYS_1");
  const [formSchedCustomUnit, setFormSchedCustomUnit] = useState<"HOURS" | "DAYS" | "WEEKS">("HOURS");
  const [formSchedCustomValue, setFormSchedCustomValue] = useState(8);
  const [formSchedStartDateMode, setFormSchedStartDateMode] = useState<"PRESET" | "CUSTOM">("PRESET");
  const [formSchedStartDateOffset, setFormSchedStartDateOffset] = useState(0);
  const [formSchedCustomStartDate, setFormSchedCustomStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [formSchedHasEndDate, setFormSchedHasEndDate] = useState(false);
  const [formSchedEndDateMode, setFormSchedEndDateMode] = useState<"DURATION" | "CUSTOM">("DURATION");
  const [formSchedDurationDays, setFormSchedDurationDays] = useState(5);
  const [formSchedCustomEndDate, setFormSchedCustomEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().split("T")[0];
  });
  const [formSchedCustomEndTime, setFormSchedCustomEndTime] = useState("23:59");
  const [formSchedRequiresNote, setFormSchedRequiresNote] = useState(false);

  // Form: Discontinue other active medications (when adding new one)
  const [formDiscontinuePrevious, setFormDiscontinuePrevious] = useState(false);
  const [formSelectedDiscontinueIds, setFormSelectedDiscontinueIds] = useState<string[]>([]);
  const [formDiscontinueReason, setFormDiscontinueReason] = useState("");

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }

  const fetchMeds = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/medications");
      if (res.ok) {
        const data = await res.json();
        setMedications(data.medications || []);
        setHistory(data.history || []);
      }
    } catch (err) {
      console.error("Failed to load medications:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user?.role) setUserRole(data.user.role);
      })
      .catch(() => {});

    fetchMeds();
  }, [fetchMeds]);

  function openCreateModal() {
    setEditingMed(null);
    setFormNameFa("");
    setFormBoxNumber("");
    setFormInstructions("");
    setFormDoctorName("");
    setFormDoctorOrderNotes("");
    setFormStockCount("100");
    setFormLowStockThreshold("15");
    setFormTimeConstraints("");

    setFormCreateSchedule(true);
    setFormSchedTargetTime("08:00");
    setFormSchedMealRelation("NONE");
    setFormSchedIntervalPreset("DAYS_1");
    setFormSchedCustomUnit("HOURS");
    setFormSchedCustomValue(8);
    setFormSchedStartDateMode("PRESET");
    setFormSchedStartDateOffset(0);
    setFormSchedCustomStartDate(new Date().toISOString().split("T")[0]);
    setFormSchedHasEndDate(false);
    setFormSchedEndDateMode("DURATION");
    setFormSchedDurationDays(5);
    const defEnd = new Date();
    defEnd.setDate(defEnd.getDate() + 5);
    setFormSchedCustomEndDate(defEnd.toISOString().split("T")[0]);
    setFormSchedCustomEndTime("23:59");
    setFormSchedRequiresNote(false);

    setFormDiscontinuePrevious(false);
    setFormSelectedDiscontinueIds([]);
    setFormDiscontinueReason("");

    setIsModalOpen(true);
  }

  function openEditModal(med: Medication) {
    setEditingMed(med);
    setFormNameFa(med.nameFa);
    setFormBoxNumber(med.boxNumber || "");
    setFormInstructions(med.instructions || "");
    setFormDoctorName(med.doctorName || "");
    setFormDoctorOrderNotes(med.doctorOrderNotes || "");
    setFormStockCount(med.stockCount.toString());
    setFormLowStockThreshold((med.lowStockThreshold || 15).toString());
    setFormTimeConstraints(med.timeConstraints || "");

    // Load schedule if medication has an active schedule
    const activeSched = med.schedules && med.schedules.length > 0 ? med.schedules[0] : null;
    if (activeSched) {
      setFormCreateSchedule(true);
      setFormSchedTargetTime(activeSched.targetTime || "08:00");
      setFormSchedMealRelation(activeSched.mealRelation || "NONE");

      // Match preset
      const u = activeSched.intervalUnit;
      const v = activeSched.intervalValue;
      if (u === "ONCE") {
        setFormSchedIntervalPreset("ONCE");
      } else if (u === "HOURS" && v === 6) {
        setFormSchedIntervalPreset("HOURS_6");
      } else if (u === "HOURS" && v === 8) {
        setFormSchedIntervalPreset("HOURS_8");
      } else if (u === "HOURS" && v === 12) {
        setFormSchedIntervalPreset("HOURS_12");
      } else if (u === "DAYS" && v === 1) {
        setFormSchedIntervalPreset("DAYS_1");
      } else if (u === "DAYS" && v === 2) {
        setFormSchedIntervalPreset("DAYS_2");
      } else if (u === "WEEKS" && v === 1) {
        setFormSchedIntervalPreset("WEEKS_1");
      } else {
        setFormSchedIntervalPreset("CUSTOM");
        setFormSchedCustomUnit((u as any) || "HOURS");
        setFormSchedCustomValue(v || 8);
      }

      if (activeSched.startDate) {
        setFormSchedStartDateMode("CUSTOM");
        setFormSchedCustomStartDate(activeSched.startDate.split("T")[0]);
      } else {
        setFormSchedStartDateMode("PRESET");
        setFormSchedStartDateOffset(0);
      }

      if (activeSched.endDate) {
        setFormSchedHasEndDate(true);
        setFormSchedEndDateMode("CUSTOM");
        setFormSchedCustomEndDate(activeSched.endDate.split("T")[0]);
        setFormSchedCustomEndTime(
          activeSched.endDate.includes("T") ? activeSched.endDate.split("T")[1].slice(0, 5) : "23:59"
        );
      } else {
        setFormSchedHasEndDate(false);
      }

      setFormSchedRequiresNote(Boolean(activeSched.requiresNote));
    } else {
      setFormCreateSchedule(false);
      setFormSchedTargetTime("08:00");
      setFormSchedMealRelation("NONE");
      setFormSchedIntervalPreset("DAYS_1");
      setFormSchedStartDateMode("PRESET");
      setFormSchedStartDateOffset(0);
      setFormSchedHasEndDate(false);
      setFormSchedRequiresNote(false);
    }

    setFormDiscontinuePrevious(false);
    setFormSelectedDiscontinueIds([]);
    setFormDiscontinueReason("");

    setIsModalOpen(true);
  }

  function openStopModal(med: Medication) {
    setStoppingMed(med);
    setStopReason("به دستور پزشک معالج");
    setStopDoctorName(med.doctorName || "");
    setStopNotes("");
    setStopDate(new Date().toISOString().split("T")[0]);
    setIsStopModalOpen(true);
  }

  async function handleConfirmStop() {
    if (!stoppingMed) return;
    setStopSubmitting(true);
    try {
      const res = await fetch("/api/admin/medications/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: stoppingMed.id,
          reason: stopReason.trim() || "به دستور پزشک معالج",
          doctorName: stopDoctorName.trim() || null,
          notes: stopNotes.trim() || null,
          date: stopDate,
        }),
      });

      if (res.ok) {
        showToast(`مصرف داروی ${stoppingMed.nameFa} با موفقیت متوقف شد.`);
        setIsStopModalOpen(false);
        setStoppingMed(null);
        fetchMeds();
      } else {
        const data = await res.json();
        alert(data.error || "خطا در توقف مصرف دارو");
      }
    } catch (err) {
      console.error("Stop error:", err);
      alert("خطای غیرمنتظره در توقف دارو");
    } finally {
      setStopSubmitting(false);
    }
  }

  // Calculate schedule start & end dates
  function getSchedStartDate(): Date {
    const [h, min] = (formSchedTargetTime || "08:00").split(":").map(Number);
    if (formSchedStartDateMode === "CUSTOM" && formSchedCustomStartDate) {
      const [y, m, d] = formSchedCustomStartDate.split("-").map(Number);
      return new Date(y, m - 1, d, h || 0, min || 0, 0);
    }
    const d = new Date(Date.now() + formSchedStartDateOffset * 86400000);
    d.setHours(h || 0, min || 0, 0, 0);
    return d;
  }

  function getSchedEndDate(): Date | null {
    if (!formSchedHasEndDate) return null;
    if (formSchedEndDateMode === "CUSTOM" && formSchedCustomEndDate) {
      const [y, m, d] = formSchedCustomEndDate.split("-").map(Number);
      const [h, min] = (formSchedCustomEndTime || "23:59").split(":").map(Number);
      return new Date(y, m - 1, d, h || 0, min || 0, 0);
    }
    const start = getSchedStartDate();
    return new Date(start.getTime() + formSchedDurationDays * 86400000);
  }

  // Interval resolution
  let resolvedIntervalUnit = "DAYS";
  let resolvedIntervalValue = 1;
  if (formSchedIntervalPreset === "ONCE") {
    resolvedIntervalUnit = "ONCE";
    resolvedIntervalValue = 1;
  } else if (formSchedIntervalPreset === "HOURS_6") {
    resolvedIntervalUnit = "HOURS";
    resolvedIntervalValue = 6;
  } else if (formSchedIntervalPreset === "HOURS_8") {
    resolvedIntervalUnit = "HOURS";
    resolvedIntervalValue = 8;
  } else if (formSchedIntervalPreset === "HOURS_12") {
    resolvedIntervalUnit = "HOURS";
    resolvedIntervalValue = 12;
  } else if (formSchedIntervalPreset === "DAYS_1") {
    resolvedIntervalUnit = "DAYS";
    resolvedIntervalValue = 1;
  } else if (formSchedIntervalPreset === "DAYS_2") {
    resolvedIntervalUnit = "DAYS";
    resolvedIntervalValue = 2;
  } else if (formSchedIntervalPreset === "WEEKS_1") {
    resolvedIntervalUnit = "WEEKS";
    resolvedIntervalValue = 1;
  } else if (formSchedIntervalPreset === "CUSTOM") {
    resolvedIntervalUnit = formSchedCustomUnit;
    resolvedIntervalValue = Math.max(1, formSchedCustomValue);
  }

  async function handleSaveMed() {
    if (!formNameFa.trim()) {
      alert("لطفاً نام دارو را وارد کنید.");
      return;
    }

    setSubmitting(true);
    try {
      if (editingMed) {
        // Edit existing medication and optionally its schedule
        const payload: any = {
          id: editingMed.id,
          nameFa: formNameFa.trim(),
          boxNumber: formBoxNumber.trim() || null,
          instructions: formInstructions.trim() || null,
          doctorName: formDoctorName.trim() || null,
          doctorOrderNotes: formDoctorOrderNotes.trim() || null,
          stockCount: parseInt(formStockCount, 10) || 0,
          lowStockThreshold: parseInt(formLowStockThreshold, 10) || 15,
          timeConstraints: formTimeConstraints.trim() || null,
        };

        if (formCreateSchedule) {
          payload.schedule = {
            targetTime: formSchedTargetTime,
            mealRelation: formSchedMealRelation === "NONE" ? null : formSchedMealRelation,
            intervalUnit: resolvedIntervalUnit,
            intervalValue: resolvedIntervalValue,
            startDate: getSchedStartDate().toISOString(),
            endDate: getSchedEndDate() ? getSchedEndDate()!.toISOString() : null,
            requiresNote: formSchedRequiresNote,
          };
        }

        await fetch("/api/admin/medications", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        showToast("اطلاعات و زمان‌بندی دارو با موفقیت به‌روزرسانی شد.");
      } else {
        // Create new medication + optional auto-schedule + optional discontinue
        const payload: any = {
          nameFa: formNameFa.trim(),
          boxNumber: formBoxNumber.trim() || null,
          instructions: formInstructions.trim() || null,
          doctorName: formDoctorName.trim() || null,
          doctorOrderNotes: formDoctorOrderNotes.trim() || null,
          stockCount: parseInt(formStockCount, 10) || 100,
          lowStockThreshold: parseInt(formLowStockThreshold, 10) || 15,
          timeConstraints: formTimeConstraints.trim() || null,
        };

        if (formCreateSchedule) {
          payload.schedule = {
            targetTime: formSchedTargetTime,
            mealRelation: formSchedMealRelation === "NONE" ? null : formSchedMealRelation,
            intervalUnit: resolvedIntervalUnit,
            intervalValue: resolvedIntervalValue,
            startDate: getSchedStartDate().toISOString(),
            endDate: getSchedEndDate() ? getSchedEndDate()!.toISOString() : null,
            requiresNote: formSchedRequiresNote,
          };
        }

        if (formDiscontinuePrevious && formSelectedDiscontinueIds.length > 0) {
          payload.discontinueMedIds = formSelectedDiscontinueIds;
          payload.discontinueReason = formDiscontinueReason.trim() || "توقف و جایگزینی با داروی جدید طبق نسخه پزشک";
        }

        await fetch("/api/admin/medications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        showToast("داروی جدید و برنامه مصرف با موفقیت ثبت شد.");
      }

      setIsModalOpen(false);
      fetchMeds();
    } catch (err) {
      console.error("Save medication error:", err);
      showToast("خطا در ذخیره دارو");
    } finally {
      setSubmitting(false);
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
      showToast(`موجودی ${delta > 0 ? `+${delta}` : delta} عدد تغییر کرد`);
    } catch (err) {
      console.error("Stock update error:", err);
    }
  }

  // Filter based on active tabs & search
  const filteredMeds = medications.filter((m) => {
    if (activeTab === "active" && !m.isActive) return false;
    if (activeTab === "discontinued" && m.isActive) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.nameFa.toLowerCase().includes(q) ||
      (m.boxNumber && m.boxNumber.includes(q)) ||
      (m.doctorName && m.doctorName.toLowerCase().includes(q)) ||
      (m.instructions && m.instructions.toLowerCase().includes(q)) ||
      (m.discontinuedReason && m.discontinuedReason.toLowerCase().includes(q))
    );
  });

  const filteredHistory = history.filter((h) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      h.medicationName.toLowerCase().includes(q) ||
      h.description.toLowerCase().includes(q) ||
      (h.doctorName && h.doctorName.toLowerCase().includes(q)) ||
      (h.performedBy && h.performedBy.toLowerCase().includes(q)) ||
      (h.reason && h.reason.toLowerCase().includes(q))
    );
  });

  const lowStockCount = medications.filter((m) => m.isActive && m.stockCount <= m.lowStockThreshold).length;
  const activeCount = medications.filter((m) => m.isActive).length;
  const discontinuedCount = medications.filter((m) => !m.isActive).length;
  const historyCount = history.length;

  // Active meds eligible to be discontinued in create modal
  const eligibleActiveMeds = medications.filter((m) => m.isActive && (!editingMed || m.id !== editingMed.id));

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-emerald-900/90 backdrop-blur-md text-white font-bold text-sm shadow-2xl flex items-center gap-2 border border-emerald-500/40 animate-bounce">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-care-50 dark:bg-emerald-950/40 text-care-700 dark:text-emerald-400">
              <Pill className="w-6 h-6" />
            </div>
            <span>مرکز جامع مدیریت داروها، نسخه و تاریخچه</span>
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 mt-1">
            شماره جعبه در منزل، دستور پزشک، زمان‌بندی هوشمند و گزارش تفصیلی تغییرات
          </p>
        </div>

        {userRole === "ADMIN" ? (
          <button
            onClick={openCreateModal}
            className="px-5 py-2.5 rounded-2xl bg-care-600 hover:bg-care-700 text-white font-black text-xs shadow-lg shadow-care-600/30 flex items-center gap-2 transition active:scale-95 self-start sm:self-center"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>ثبت داروی جدید + زمان‌بندی</span>
          </button>
        ) : (
          <div className="bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/80 rounded-2xl p-2.5 px-3.5 text-xs font-bold text-sky-800 dark:text-sky-300 flex items-center gap-2">
            <Info className="w-4 h-4 flex-shrink-0 text-sky-600 dark:text-sky-400" />
            <span>حالت مشاهده پرستار: بررسی پروتکل دارویی بیمار</span>
          </div>
        )}
      </div>

      {/* Low Stock Warning Banner */}
      {lowStockCount > 0 && (
        <div className="p-4 rounded-3xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 text-amber-900 dark:text-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span className="text-xs font-black">
              هشدار کسری: {toPersianDigits(lowStockCount)} قلم داروی مصرفی به حداقل موجودی رسیده‌اند و نیاز به شارژ دارند.
            </span>
          </div>
        </div>
      )}

      {/* Navigation Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setActiveTab("active")}
            className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeTab === "active"
                ? "bg-slate-900 dark:bg-slate-700 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>داروهای فعال</span>
            <span className="px-1.5 py-0.2 rounded-md bg-white/20 text-[10px] font-mono">
              {toPersianDigits(activeCount)}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("discontinued")}
            className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeTab === "discontinued"
                ? "bg-slate-900 dark:bg-slate-700 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Ban className="w-3.5 h-3.5" />
            <span>سوابق توقف</span>
            <span className="px-1.5 py-0.2 rounded-md bg-white/20 text-[10px] font-mono">
              {toPersianDigits(discontinuedCount)}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeTab === "history"
                ? "bg-care-700 dark:bg-emerald-800 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>گزارش تفصیلی تغییرات</span>
            <span className="px-1.5 py-0.2 rounded-md bg-white/20 text-[10px] font-mono">
              {toPersianDigits(historyCount)}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("all")}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === "all"
                ? "bg-slate-900 dark:bg-slate-700 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            همه ({toPersianDigits(medications.length)})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === "history"
                ? "جستجو در متن گزارش، نام دارو، پزشک یا علت..."
                : "جستجوی نام دارو، جعبه (مثلاً ۱ یا ۸)، نام پزشک یا علت توقف..."
            }
            className="w-full pl-4 pr-10 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-care-500 shadow-xs"
          />
        </div>
      </div>

      {/* VIEW 1: Detailed History Narrative Feed */}
      {activeTab === "history" ? (
        <div className="space-y-3">
          {filteredHistory.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
              <History className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="font-bold text-sm text-slate-700 dark:text-slate-300">
                هیچ گزارشی در تاریخچه تغییرات داروها یافت نشد.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredHistory.map((item) => {
                let badgeColor = "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700";
                let badgeLabel = "تغییر وضعیت";
                let IconComponent = Clock;

                if (item.actionType === "CREATED") {
                  badgeColor = "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800";
                  badgeLabel = "افزودن دارو";
                  IconComponent = PlusCircle;
                } else if (item.actionType === "SCHEDULE_CHANGED") {
                  badgeColor = "bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800";
                  badgeLabel = "تغییر زمان‌بندی";
                  IconComponent = CalendarClock;
                } else if (item.actionType === "STOPPED") {
                  badgeColor = "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800";
                  badgeLabel = "توقف مصرف";
                  IconComponent = Ban;
                } else if (item.actionType === "REACTIVATED") {
                  badgeColor = "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800";
                  badgeLabel = "فعال‌سازی مجدد";
                  IconComponent = RotateCcw;
                }

                return (
                  <div
                    key={item.id}
                    className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5 transition hover:border-slate-300 dark:hover:border-slate-700"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-xl text-xs font-black border flex items-center gap-1.5 ${badgeColor}`}>
                          <IconComponent className="w-3.5 h-3.5" />
                          <span>{badgeLabel}</span>
                        </span>
                        <span className="font-bold text-xs text-slate-500 dark:text-slate-400">
                          {item.medicationName}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        <span>{formatJalaliDateTime(item.createdAt)}</span>
                        <span className="text-slate-300 dark:text-slate-700">|</span>
                        <span>{formatJalaliFromNow(item.createdAt)}</span>
                      </div>
                    </div>

                    {/* Exact Persian Narrative */}
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-relaxed bg-slate-50/70 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                      {item.description}
                    </p>

                    {/* Extra metadata chips */}
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap pt-0.5">
                      {item.doctorName && (
                        <div className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>پزشک: {item.doctorName}</span>
                        </div>
                      )}
                      {item.performedBy && (
                        <div className="flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          <span>ثبت‌کننده: {item.performedBy}</span>
                        </div>
                      )}
                      {item.reason && item.actionType === "STOPPED" && (
                        <div className="flex items-center gap-1 text-rose-700 dark:text-rose-400">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>علت توقف: {item.reason}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* VIEW 2: Medication Cards Grid */
        <div>
          {filteredMeds.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
              <Pill className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="font-bold text-sm text-slate-700 dark:text-slate-300">هیچ دارویی در این دسته یافت نشد.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredMeds.map((med) => {
                const isLowStock = med.isActive && med.stockCount <= med.lowStockThreshold;
                const isDiscontinued = !med.isActive;

                return (
                  <div
                    key={med.id}
                    className={`p-5 rounded-3xl bg-white dark:bg-slate-900 border-2 transition shadow-xs flex flex-col justify-between ${
                      isDiscontinued
                        ? "border-rose-200 dark:border-rose-950/60 bg-rose-50/20 dark:bg-rose-950/10 opacity-75"
                        : isLowStock
                        ? "border-amber-300 dark:border-amber-800 bg-amber-50/20 dark:bg-amber-950/20"
                        : "border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div>
                      {/* Card Top: Name + Box Number + Action buttons */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {med.boxNumber && (
                            <span className="px-2.5 py-1 rounded-xl bg-slate-900 dark:bg-slate-800 text-white font-black text-xs font-mono">
                              جعبه {toPersianDigits(med.boxNumber)}
                            </span>
                          )}
                          <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">{med.nameFa}</h2>
                          {isDiscontinued && (
                            <span className="px-2 py-0.5 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 text-[10px] font-black">
                              متوقف‌شده
                            </span>
                          )}
                        </div>

                        {userRole === "ADMIN" && (
                          <div className="flex items-center gap-1">
                            {med.isActive && (
                              <button
                                onClick={() => openStopModal(med)}
                                className="px-2 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 text-[11px] font-bold flex items-center gap-1 transition"
                                title="توقف مصرف این دارو"
                              >
                                <Ban className="w-3.5 h-3.5" />
                                <span>توقف مصرف</span>
                              </button>
                            )}
                            <button
                              onClick={() => openEditModal(med)}
                              className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition"
                              title="ویرایش اطلاعات و زمان‌بندی دارو"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Instructions */}
                      {med.instructions && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-2.5 leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-700">
                          {med.instructions}
                        </p>
                      )}

                      {/* Doctor Prescription Notes */}
                      {med.doctorOrderNotes && (
                        <div className="mt-2 p-2.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-xs text-emerald-900 dark:text-emerald-300">
                          <span className="font-black block text-[11px] mb-0.5">توضیحات نسخه پزشک:</span>
                          <p className="leading-relaxed">{med.doctorOrderNotes}</p>
                        </div>
                      )}

                      {/* Discontinuation Record details */}
                      {isDiscontinued && (
                        <div className="mt-3 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-950 dark:text-rose-200 space-y-1">
                          <div className="flex items-center gap-1 font-black text-rose-800 dark:text-rose-400 text-[11px]">
                            <Ban className="w-3.5 h-3.5" />
                            <span>علت توقف مصرف:</span>
                          </div>
                          <p className="font-semibold leading-relaxed">
                            {med.discontinuedReason || "طبق دستور پزشک متوقف شد."}
                          </p>
                          <div className="pt-1 text-[10px] text-rose-700 dark:text-rose-400 flex items-center justify-between">
                            <span>دستوردهنده: {med.discontinuedBy || "پزشک معالج"}</span>
                            {med.discontinuedAt && (
                              <span>تاریخ قطع: {formatJalaliDate(med.discontinuedAt)}</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Metadata: Doctor name, Time Constraints, Active Schedules */}
                      <div className="mt-2.5 space-y-1.5">
                        {med.doctorName && (
                          <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                            <User className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>پزشک تجویزکننده: {med.doctorName}</span>
                          </div>
                        )}

                        {med.timeConstraints && (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
                            <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                            <span>شرط زمانی: {med.timeConstraints}</span>
                          </div>
                        )}

                        {med.schedules && med.schedules.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap pt-1">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">زمان‌بندی:</span>
                            {med.schedules.map((sc) => (
                              <span
                                key={sc.id}
                                className="px-2 py-0.5 rounded-lg bg-care-50 dark:bg-emerald-950/40 text-care-800 dark:text-emerald-300 border border-care-200 dark:border-emerald-800 text-[10px] font-bold flex items-center gap-1"
                              >
                                <CalendarClock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                <span>ساعت {toPersianDigits(sc.targetTime)}</span>
                                {sc.intervalUnit && (
                                  <span className="text-[9px] opacity-75">
                                    ({sc.intervalUnit === "HOURS" ? `هر ${toPersianDigits(sc.intervalValue)}س` : "روزانه"})
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Footer: Stock Inventory Controls */}
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Package className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">موجودی در منزل:</span>
                        <span
                          className={`font-mono text-sm font-black ${
                            isLowStock ? "text-amber-700 dark:text-amber-400 font-bold" : "text-slate-900 dark:text-slate-100"
                          }`}
                        >
                          {toPersianDigits(med.stockCount)} عدد
                        </span>
                        {isLowStock && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 text-[10px] font-bold">
                            رو به اتمام
                          </span>
                        )}
                      </div>

                      {/* Quick Increment / Decrement for ADMIN */}
                      {userRole === "ADMIN" && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => updateStockDelta(med.id, -1)}
                            className="p-1 rounded-lg text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 active:scale-90 transition"
                            title="کاهش ۱ عدد"
                          >
                            <MinusCircle className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => updateStockDelta(med.id, 10)}
                            className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-[11px] font-bold transition active:scale-95"
                            title="خرید یک بسته (۱۰ تایی)"
                          >
                            +۱۰
                          </button>
                          <button
                            onClick={() => updateStockDelta(med.id, 1)}
                            className="p-1 rounded-lg text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 active:scale-90 transition"
                            title="افزایش ۱ عدد"
                          >
                            <PlusCircle className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Stop Medication Modal */}
      {isStopModalOpen && stoppingMed && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-hidden">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl border border-rose-200 dark:border-rose-900/60 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-rose-100 dark:border-rose-900/50 flex items-center justify-between bg-rose-50/70 dark:bg-rose-950/50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-200">
                  <Ban className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-rose-950 dark:text-rose-100">
                    توقف مصرف {stoppingMed.nameFa}
                  </h2>
                  <p className="text-[11px] text-rose-700 dark:text-rose-300">
                    ثبت علت بالینی و غیرفعال‌سازی زمان‌بندی در کارتابل پرستار
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsStopModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {/* Presets */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  علت توقف مصرف دارو: *
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    "به دستور پزشک معالج",
                    "بهبود علائم و اتمام دوره درمان",
                    "بروز حساسیت یا عوارض جانبی",
                    "جایگزینی با داروی جدید",
                    "تغییر در رژیم دارویی بیمار",
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setStopReason(preset)}
                      className={`text-[11px] px-2.5 py-1 rounded-xl font-bold border transition ${
                        stopReason === preset
                          ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                          : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  required
                  value={stopReason}
                  onChange={(e) => setStopReason(e.target.value)}
                  placeholder="علت توقف را بنویسید یا از بالا انتخاب کنید..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    پزشک دستوردهنده:
                  </label>
                  <input
                    type="text"
                    value={stopDoctorName}
                    onChange={(e) => setStopDoctorName(e.target.value)}
                    placeholder="مثلاً دکتر علایی"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    تاریخ اعمال توقف:
                  </label>
                  <input
                    type="date"
                    value={stopDate}
                    onChange={(e) => setStopDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  توضیحات تکمیلی (اختیاری):
                </label>
                <textarea
                  rows={2}
                  value={stopNotes}
                  onChange={(e) => setStopNotes(e.target.value)}
                  placeholder="مثلاً: قطع آپیکسابان و جایگزینی داروی جدید به دلیل تغییر دوز طبق دستور دکتر علایی..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none placeholder:text-slate-400"
                />
              </div>

              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-[11px] font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                <span>با تأیید، زمان‌بندی‌های فعال این دارو در کارتابل پرستار لغو شده و واقعه در گزارش ثبت می‌گردد.</span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 bg-slate-50/80 dark:bg-slate-800/80">
              <button
                type="button"
                onClick={() => setIsStopModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={stopSubmitting}
                onClick={handleConfirmStop}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-lg shadow-rose-600/30 transition active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
              >
                <Ban className="w-4 h-4" />
                <span>{stopSubmitting ? "در حال ثبت..." : "تأیید و توقف مصرف"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unified Add / Edit Medication Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-hidden">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/80 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-care-100 dark:bg-emerald-950/60 text-care-800 dark:text-emerald-300">
                  <Pill className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-slate-100">
                    {editingMed ? "ویرایش مشخصات و زمان‌بندی دارو" : "ثبت داروی جدید و پروتکل مصرف"}
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {editingMed
                      ? "اصلاح نام، جعبه، دستورات، موجودی یا تغییر ساعت و تکرار مصرف"
                      : "ثبت دارو، نسخه پزشک، زمان‌بندی تسک پرستار و لغو داروهای قبلی"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              {/* Section 1: Core Medication Info */}
              <div className="space-y-3">
                <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5 pb-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  <span>۱. اطلاعات پایه دارو و انبار</span>
                </h3>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    نام کامل دارو (فارسی و دوز) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formNameFa}
                    onChange={(e) => setFormNameFa(e.target.value)}
                    placeholder="مثلاً آپیکسابان 5 میلی‌گرم (Eliquis)"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      شماره جعبه در منزل
                    </label>
                    <input
                      type="text"
                      value={formBoxNumber}
                      onChange={(e) => setFormBoxNumber(e.target.value)}
                      placeholder="مثلاً 8"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      موجودی فعلی (عدد)
                    </label>
                    <input
                      type="number"
                      value={formStockCount}
                      onChange={(e) => setFormStockCount(e.target.value)}
                      placeholder="100"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none text-center font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      آستانه هشدار کسری
                    </label>
                    <input
                      type="number"
                      value={formLowStockThreshold}
                      onChange={(e) => setFormLowStockThreshold(e.target.value)}
                      placeholder="15"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none text-center font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    دستور مصرف بالینی (روی جعبه)
                  </label>
                  <textarea
                    rows={2}
                    value={formInstructions}
                    onChange={(e) => setFormInstructions(e.target.value)}
                    placeholder="روزی ۲ بار - همراه با یک لیوان آب کامل..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    شرط زمانی یا تداخل دارویی (اختیاری)
                  </label>
                  <input
                    type="text"
                    value={formTimeConstraints}
                    onChange={(e) => setFormTimeConstraints(e.target.value)}
                    placeholder="فاصله ۲ ساعته با آنتی‌اسید / مصرف دقیقاً رأس ساعت"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none"
                  />
                </div>
              </div>

              {/* Section 2: Doctor & Prescription */}
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5 pb-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  <span>۲. دستور و نسخه پزشک معالج</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      نام پزشک تجویزکننده
                    </label>
                    <input
                      type="text"
                      value={formDoctorName}
                      onChange={(e) => setFormDoctorName(e.target.value)}
                      placeholder="مثلاً دکتر علایی (فوق تخصص عروق)"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      توضیحات اختصاصی نسخه / طرح درمان
                    </label>
                    <input
                      type="text"
                      value={formDoctorOrderNotes}
                      onChange={(e) => setFormDoctorOrderNotes(e.target.value)}
                      placeholder="جهت درمان ترومبوز ورید عمقی (DVT)"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Schedule Settings (Both Create and Edit Mode) */}
              <div className="space-y-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formCreateSchedule}
                      onChange={(e) => setFormCreateSchedule(e.target.checked)}
                      className="w-4 h-4 rounded text-care-600 focus:ring-care-500"
                    />
                    <span className="text-xs font-black text-indigo-950 dark:text-indigo-200">
                      {editingMed
                        ? "تنظیم و به‌روزرسانی زمان‌بندی مصرف این دارو (کارتابل پرستار)"
                        : "افزودن خودکار تسک این دارو به کارتابل پرستار (زمان‌بندی هوشمند)"}
                    </span>
                  </label>

                  {formCreateSchedule && (
                    <div className="pt-2 border-t border-indigo-200/60 dark:border-indigo-900/50 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Target Time */}
                        <div>
                          <label className="block text-xs font-bold text-indigo-950 dark:text-indigo-200 mb-1">
                            ساعت اولین مصرف / ساعت هدف:
                          </label>
                          <input
                            type="time"
                            value={formSchedTargetTime}
                            onChange={(e) => setFormSchedTargetTime(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold text-xs font-mono text-center"
                          />
                        </div>

                        {/* Meal Relation */}
                        <div>
                          <label className="block text-xs font-bold text-indigo-950 dark:text-indigo-200 mb-1">
                            رابطه با وعده غذایی:
                          </label>
                          <select
                            value={formSchedMealRelation}
                            onChange={(e) => setFormSchedMealRelation(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold text-xs"
                          >
                            <option value="NONE">بدون قید غذا</option>
                            <option value="FASTING">ناشتا (صبح زود)</option>
                            <option value="BEFORE_MEAL">قبل از غذا</option>
                            <option value="WITH_MEAL">همراه غذا</option>
                            <option value="AFTER_MEAL">بعد از غذا</option>
                            <option value="BEDTIME">قبل از خواب</option>
                          </select>
                        </div>
                      </div>

                      {/* Interval */}
                      <div>
                        <label className="block text-xs font-bold text-indigo-950 dark:text-indigo-200 mb-1">
                          فاصله تکرار:
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                          {[
                            { id: "DAYS_1", label: "روزانه (۲۴س)" },
                            { id: "HOURS_8", label: "هر ۸ ساعت" },
                            { id: "HOURS_12", label: "هر ۱۲ ساعت" },
                            { id: "HOURS_6", label: "هر ۶ ساعت" },
                            { id: "DAYS_2", label: "هر ۲ روز" },
                            { id: "WEEKS_1", label: "هفتگی" },
                            { id: "ONCE", label: "فقط یک‌بار" },
                            { id: "CUSTOM", label: "دلخواه..." },
                          ].map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setFormSchedIntervalPreset(p.id)}
                              className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition text-center ${
                                formSchedIntervalPreset === p.id
                                  ? "bg-indigo-900 text-white border-indigo-900"
                                  : "bg-white dark:bg-slate-800 border-indigo-200 dark:border-indigo-800 text-indigo-950 dark:text-indigo-200"
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>

                        {/* Custom Interval if selected */}
                        {formSchedIntervalPreset === "CUSTOM" && (
                          <div className="mt-2 flex items-center gap-2 p-2 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-indigo-100 dark:border-indigo-900">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">هر</span>
                            <input
                              type="number"
                              min={1}
                              value={formSchedCustomValue}
                              onChange={(e) => setFormSchedCustomValue(Number(e.target.value))}
                              className="w-16 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-center font-mono"
                            />
                            <select
                              value={formSchedCustomUnit}
                              onChange={(e) => setFormSchedCustomUnit(e.target.value as any)}
                              className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold bg-white dark:bg-slate-800"
                            >
                              <option value="HOURS">ساعت</option>
                              <option value="DAYS">روز</option>
                              <option value="WEEKS">هفته</option>
                            </select>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">یک‌بار</span>
                          </div>
                        )}
                      </div>

                      {/* Start Date */}
                      <div className="p-2.5 rounded-xl bg-white/70 dark:bg-slate-800/70 border border-indigo-100 dark:border-indigo-900/40 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            تاریخ شروع مصرف:
                          </label>
                          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-0.5 rounded-lg">
                            <button
                              type="button"
                              onClick={() => setFormSchedStartDateMode("PRESET")}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                formSchedStartDateMode === "PRESET"
                                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                                  : "text-slate-500"
                              }`}
                            >
                              سریع
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormSchedStartDateMode("CUSTOM")}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                formSchedStartDateMode === "CUSTOM"
                                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                                  : "text-slate-500"
                              }`}
                            >
                              تاریخ دلخواه
                            </button>
                          </div>
                        </div>

                        {formSchedStartDateMode === "PRESET" ? (
                          <div className="flex items-center gap-1.5">
                            {[
                              { offset: 0, label: "از امروز" },
                              { offset: 1, label: "از فردا" },
                              { offset: 2, label: "از پس‌فردا" },
                            ].map((d) => (
                              <button
                                key={d.offset}
                                type="button"
                                onClick={() => setFormSchedStartDateOffset(d.offset)}
                                className={`flex-1 py-1 rounded-lg text-xs font-bold border transition ${
                                  formSchedStartDateOffset === d.offset
                                    ? "bg-care-700 text-white border-care-700"
                                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                                }`}
                              >
                                {d.label}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <input
                            type="date"
                            value={formSchedCustomStartDate}
                            onChange={(e) => setFormSchedCustomStartDate(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold"
                          />
                        )}
                      </div>

                      {/* End Date */}
                      <div className="p-2.5 rounded-xl bg-white/70 dark:bg-slate-800/70 border border-indigo-100 dark:border-indigo-900/40 space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formSchedHasEndDate}
                            onChange={(e) => setFormSchedHasEndDate(e.target.checked)}
                            className="w-3.5 h-3.5 rounded text-care-600 focus:ring-care-500"
                          />
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            پایان دوره مصرف دارد (تسک دارای تاریخ پایان است)
                          </span>
                        </label>

                        {formSchedHasEndDate && (
                          <div className="pt-1.5 border-t border-indigo-100 dark:border-indigo-900/40 space-y-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="date"
                                value={formSchedCustomEndDate}
                                onChange={(e) => setFormSchedCustomEndDate(e.target.value)}
                                className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold"
                              />
                              <input
                                type="time"
                                value={formSchedCustomEndTime}
                                onChange={(e) => setFormSchedCustomEndTime(e.target.value)}
                                className="w-24 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-center"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Requires Note checkbox */}
                      <label className="flex items-center gap-2 cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          checked={formSchedRequiresNote}
                          onChange={(e) => setFormSchedRequiresNote(e.target.checked)}
                          className="w-3.5 h-3.5 rounded text-care-600 focus:ring-care-500"
                        />
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                          پرستار هنگام ثبت این تسک باید یادداشت / گزارش وضعیت وارد کند
                        </span>
                      </label>

                      {/* Live Recurrence sentence */}
                      <div className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5 pt-1">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>
                          خلاصه زمان‌بندی:{" "}
                          {formatRecurrenceText(
                            resolvedIntervalUnit,
                            resolvedIntervalValue,
                            formSchedTargetTime,
                            getSchedEndDate(),
                            getSchedStartDate()
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 4: Discontinue Previous Medications (Only for Create) */}
              {!editingMed && eligibleActiveMeds.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="p-3.5 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formDiscontinuePrevious}
                        onChange={(e) => setFormDiscontinuePrevious(e.target.checked)}
                        className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                      />
                      <span className="text-xs font-black text-rose-950 dark:text-rose-200">
                        این نسخه داروی دیگری را لغو / متوقف می‌کند (جایگزینی دارو)
                      </span>
                    </label>

                    {formDiscontinuePrevious && (
                      <div className="pt-2 border-t border-rose-200/60 dark:border-rose-900/50 space-y-3">
                        <label className="block text-[11px] font-bold text-rose-900 dark:text-rose-300">
                          داروهایی که باید فوراً متوقف شوند را انتخاب کنید:
                        </label>
                        <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                          {eligibleActiveMeds.map((m) => {
                            const isSelected = formSelectedDiscontinueIds.includes(m.id);
                            return (
                              <label
                                key={m.id}
                                className={`flex items-center justify-between p-2 rounded-xl border text-xs font-bold cursor-pointer transition ${
                                  isSelected
                                    ? "bg-rose-100 dark:bg-rose-900/40 border-rose-300 dark:border-rose-700 text-rose-950 dark:text-rose-200"
                                    : "bg-white dark:bg-slate-800 border-rose-200 dark:border-rose-900/40 text-slate-700 dark:text-slate-300 hover:bg-rose-50/50"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setFormSelectedDiscontinueIds((prev) => [...prev, m.id]);
                                      } else {
                                        setFormSelectedDiscontinueIds((prev) => prev.filter((id) => id !== m.id));
                                      }
                                    }}
                                    className="w-3.5 h-3.5 rounded text-rose-600"
                                  />
                                  <span>{m.nameFa}</span>
                                </div>
                                {m.boxNumber && (
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                    جعبه {toPersianDigits(m.boxNumber)}
                                  </span>
                                )}
                              </label>
                            );
                          })}
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-rose-900 dark:text-rose-300 mb-1">
                            علت بالینی قطع دارو:
                          </label>
                          <input
                            type="text"
                            value={formDiscontinueReason}
                            onChange={(e) => setFormDiscontinueReason(e.target.value)}
                            placeholder="مثلاً: قطع آپیکسابان و جایگزینی داروی جدید به دلیل تغییر دوز طبق دستور دکتر علایی"
                            className="w-full px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 bg-slate-50/80 dark:bg-slate-800/80 flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleSaveMed}
                className="px-5 py-2.5 rounded-xl bg-care-600 hover:bg-care-700 text-white font-black text-xs shadow-lg shadow-care-600/30 transition active:scale-95 disabled:opacity-50"
              >
                {submitting ? "در حال ثبت..." : editingMed ? "ذخیره تغییرات" : "ثبت دارو و تایید دستور"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
