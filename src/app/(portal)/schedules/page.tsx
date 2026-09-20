"use client";

import { useEffect, useState, useCallback } from "react";
import {
  CalendarClock, Plus, Search, Check, X, Clock, Pill, Utensils,
  Shield, AlertCircle, Trash2, Edit3, Power, RefreshCw, Sparkles,
  ChevronDown, Calendar, Info, CheckCircle2, XCircle, FileText, Tag, ClipboardPlus,
  Droplets, Activity, Heart, Stethoscope, Timer, Smile, Camera
} from "lucide-react";
import {
  toPersianDigits, formatJalaliDate, formatJalaliTime, formatJalaliDateTime,
  getJalaliToday, formatRecurrenceText, tehranMoment
} from "@/lib/jalali";

interface MedicationOption {
  id: string;
  nameFa: string;
  boxNumber?: string | null;
  dosage?: string | null;
  instructions?: string | null;
  timeConstraints?: string | null;
}

interface ScheduleItem {
  id: string;
  title: string;
  targetTime: string;
  category: string;
  itemType: string;
  mealRelation?: string | null;
  startDate?: string | null;
  intervalUnit: string;
  intervalValue: number;
  endDate?: string | null;
  requiresNote: boolean;
  vitalType?: string | null;
  isActive: boolean;
  status: "ACTIVE" | "INACTIVE" | "EXPIRED";
  recurrenceText: string;
  medication?: {
    id: string;
    nameFa?: string | null;
    nameEn?: string | null;
    boxNumber?: string | null;
    dosage?: string | null;
    stockCount?: number;
  } | null;
  completedTodayCount: number;
  isCompletedToday: boolean;
  createdAt: string;
}

export default function AdminSchedulesPage() {
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [medications, setMedications] = useState<MedicationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "ACTIVE" | "EXPIRED" | "INACTIVE">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Ad-hoc suggestions management state
  const [isAdhocModalOpen, setIsAdhocModalOpen] = useState(false);
  const [adhocSuggestions, setAdhocSuggestions] = useState<Array<{ id: string; title: string; category?: string }>>([]);
  const [newSuggestionTitle, setNewSuggestionTitle] = useState("");
  const [newSuggestionCategory, setNewSuggestionCategory] = useState("مراقبتی");
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Form states
  const [formCategory, setFormCategory] = useState<"medication" | "meal" | "vital" | "dvt_care" | "routine">("routine");
  const [formVitalType, setFormVitalType] = useState<string | null>(null);
  const [formMedicationId, setFormMedicationId] = useState<string>("");
  const [formTitle, setFormTitle] = useState("");
  const [formTargetTime, setFormTargetTime] = useState("08:00");
  const [formMealRelation, setFormMealRelation] = useState("NONE");
  const [formRequiresNote, setFormRequiresNote] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<string>("ADMIN");
  
  // Recurrence states
  const [formStartDateMode, setFormStartDateMode] = useState<"PRESET" | "CUSTOM">("PRESET");
  const [formStartDateOffset, setFormStartDateOffset] = useState<number>(0); // 0 = today, 1 = tomorrow, etc.
  const [formCustomStartDate, setFormCustomStartDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [formIntervalPreset, setFormIntervalPreset] = useState<string>("DAYS_1");
  const [formCustomUnit, setFormCustomUnit] = useState<"HOURS" | "DAYS" | "WEEKS">("HOURS");
  const [formCustomValue, setFormCustomValue] = useState<number>(8);
  
  // End Date states
  const [formHasEndDate, setFormHasEndDate] = useState<boolean>(false);
  const [formEndDateMode, setFormEndDateMode] = useState<"DURATION" | "CUSTOM">("DURATION");
  const [formDurationDays, setFormDurationDays] = useState<number>(5); // 3, 5, 7, 14, 30
  const [formCustomEndDate, setFormCustomEndDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().split("T")[0];
  });
  const [formCustomEndTime, setFormCustomEndTime] = useState<string>("23:59");

  // Notification Toast
  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }

  // Fetch Schedules
  const fetchSchedules = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/schedules");
      if (res.ok) {
        const data = await res.json();
        setSchedules(data.schedules || []);
      }
    } catch (err) {
      console.error("Failed to fetch schedules:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch Medications for dropdown
  const fetchMedications = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/medications");
      if (res.ok) {
        const data = await res.json();
        setMedications(data.medications || []);
      }
    } catch (err) {
      console.error("Failed to load medications:", err);
    }
  }, []);

  // Fetch Ad-hoc Suggestions
  const fetchAdhocSuggestions = useCallback(async () => {
    try {
      setLoadingSuggestions(true);
      const res = await fetch("/api/admin/adhoc-suggestions");
      if (res.ok) {
        const data = await res.json();
        setAdhocSuggestions(data.suggestions || []);
      }
    } catch (err) {
      console.error("Failed to load adhoc suggestions:", err);
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user?.role) setUserRole(data.user.role);
      })
      .catch(() => {});

    fetchSchedules();
    fetchMedications();
    fetchAdhocSuggestions();
  }, [fetchSchedules, fetchMedications, fetchAdhocSuggestions]);

  // Add new Ad-hoc suggestion
  async function handleAddSuggestion(e: React.FormEvent) {
    e.preventDefault();
    if (!newSuggestionTitle.trim()) return;
    try {
      const res = await fetch("/api/admin/adhoc-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newSuggestionTitle.trim(),
          category: newSuggestionCategory,
        }),
      });
      if (res.ok) {
        setNewSuggestionTitle("");
        showToast("عنوان اقدام موردی اضافه شد");
        fetchAdhocSuggestions();
      } else {
        const err = await res.json();
        showToast(err.error || "خطا در افزودن پیشنهاد");
      }
    } catch {
      showToast("خطا در ارتباط با سرور");
    }
  }

  // Delete Ad-hoc suggestion
  async function handleDeleteSuggestion(id: string) {
    try {
      const res = await fetch(`/api/admin/adhoc-suggestions?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showToast("عنوان اقدام موردی حذف شد");
        fetchAdhocSuggestions();
      } else {
        showToast("خطا در حذف پیشنهاد");
      }
    } catch {
      showToast("خطا در ارتباط با سرور");
    }
  }

  // Open Create Modal
  function openCreateModal() {
    setEditingSchedule(null);
    setFormCategory("routine");
    setFormVitalType(null);
    setFormMedicationId("");
    setFormTitle("");
    setFormTargetTime("08:00");
    setFormMealRelation("NONE");
    setFormRequiresNote(false);
    setFormStartDateMode("PRESET");
    setFormStartDateOffset(0);
    setFormCustomStartDate(new Date().toISOString().split("T")[0]);
    setFormIntervalPreset("DAYS_1");
    setFormCustomUnit("HOURS");
    setFormCustomValue(8);
    setFormHasEndDate(false);
    setFormEndDateMode("DURATION");
    setFormDurationDays(5);
    const defEnd = new Date();
    defEnd.setDate(defEnd.getDate() + 5);
    setFormCustomEndDate(defEnd.toISOString().split("T")[0]);
    setFormCustomEndTime("23:59");
    setIsModalOpen(true);
  }

  // Open Edit Modal
  function openEditModal(s: ScheduleItem) {
    setEditingSchedule(s);
    setFormCategory((s.category as any) || "routine");
    setFormVitalType(s.vitalType || null);
    setFormMedicationId(s.medication?.id || "");
    setFormTitle(s.title);
    setFormTargetTime(s.targetTime);
    setFormMealRelation(s.mealRelation || "NONE");
    setFormRequiresNote(s.requiresNote || false);

    if (s.startDate) {
      const startD = new Date(s.startDate);
      setFormStartDateMode("CUSTOM");
      setFormCustomStartDate(startD.toISOString().split("T")[0]);
    } else {
      setFormStartDateMode("PRESET");
      setFormStartDateOffset(0);
      setFormCustomStartDate(new Date().toISOString().split("T")[0]);
    }

    // Set interval preset
    if (s.intervalUnit === "ONCE") {
      setFormIntervalPreset("ONCE");
    } else if (s.intervalUnit === "HOURS" && s.intervalValue === 6) {
      setFormIntervalPreset("HOURS_6");
    } else if (s.intervalUnit === "HOURS" && s.intervalValue === 8) {
      setFormIntervalPreset("HOURS_8");
    } else if (s.intervalUnit === "HOURS" && s.intervalValue === 12) {
      setFormIntervalPreset("HOURS_12");
    } else if (s.intervalUnit === "DAYS" && s.intervalValue === 1) {
      setFormIntervalPreset("DAYS_1");
    } else if (s.intervalUnit === "DAYS" && s.intervalValue === 2) {
      setFormIntervalPreset("DAYS_2");
    } else if (s.intervalUnit === "WEEKS" && s.intervalValue === 1) {
      setFormIntervalPreset("WEEKS_1");
    } else {
      setFormIntervalPreset("CUSTOM");
      setFormCustomUnit((s.intervalUnit as any) || "HOURS");
      setFormCustomValue(s.intervalValue || 8);
    }

    if (s.endDate) {
      setFormHasEndDate(true);
      setFormEndDateMode("CUSTOM");
      const endD = new Date(s.endDate);
      setFormCustomEndDate(endD.toISOString().split("T")[0]);
      const endH = String(endD.getHours()).padStart(2, "0");
      const endM = String(endD.getMinutes()).padStart(2, "0");
      setFormCustomEndTime(`${endH}:${endM}`);
      const diffMs = endD.getTime() - new Date().getTime();
      const diffDays = Math.max(1, Math.round(diffMs / 86400000));
      setFormDurationDays(diffDays);
    } else {
      setFormHasEndDate(false);
      setFormEndDateMode("DURATION");
      setFormDurationDays(5);
      const defEnd = new Date();
      defEnd.setDate(defEnd.getDate() + 5);
      setFormCustomEndDate(defEnd.toISOString().split("T")[0]);
      setFormCustomEndTime("23:59");
    }

    setIsModalOpen(true);
  }

  // Medication Selection handler
  function handleMedicationSelect(medId: string) {
    setFormMedicationId(medId);
    const med = medications.find((m) => m.id === medId);
    if (med) {
      let title = med.nameFa;
      if (med.boxNumber) {
        title += ` (جعبه ${toPersianDigits(med.boxNumber)})`;
      }
      if (med.dosage) {
        title += ` - ${med.dosage}`;
      }
      setFormTitle(title);
    }
  }

  // Calculate Start and End Date objects
  function getComputedStartDate(): Date {
    const [h, min] = (formTargetTime || "08:00").split(":").map(Number);
    if (formStartDateMode === "CUSTOM" && formCustomStartDate) {
      const [y, m, d] = formCustomStartDate.split("-").map(Number);
      return new Date(y, m - 1, d, h || 0, min || 0, 0);
    }
    const d = new Date(Date.now() + formStartDateOffset * 86400000);
    d.setHours(h || 0, min || 0, 0, 0);
    return d;
  }

  function getComputedEndDate(): Date | null {
    if (!formHasEndDate) return null;
    if (formEndDateMode === "CUSTOM" && formCustomEndDate) {
      const [y, m, d] = formCustomEndDate.split("-").map(Number);
      const [h, min] = (formCustomEndTime || "23:59").split(":").map(Number);
      return new Date(y, m - 1, d, h || 0, min || 0, 0);
    }
    const start = getComputedStartDate();
    return new Date(start.getTime() + formDurationDays * 86400000);
  }

  const computedStartDate = getComputedStartDate();
  const computedEndDate = getComputedEndDate();

  // Resolve actual interval values
  let resolvedUnit = "DAYS";
  let resolvedValue = 1;

  if (formIntervalPreset === "ONCE") {
    resolvedUnit = "ONCE";
    resolvedValue = 1;
  } else if (formIntervalPreset === "HOURS_6") {
    resolvedUnit = "HOURS";
    resolvedValue = 6;
  } else if (formIntervalPreset === "HOURS_8") {
    resolvedUnit = "HOURS";
    resolvedValue = 8;
  } else if (formIntervalPreset === "HOURS_12") {
    resolvedUnit = "HOURS";
    resolvedValue = 12;
  } else if (formIntervalPreset === "DAYS_1") {
    resolvedUnit = "DAYS";
    resolvedValue = 1;
  } else if (formIntervalPreset === "DAYS_2") {
    resolvedUnit = "DAYS";
    resolvedValue = 2;
  } else if (formIntervalPreset === "WEEKS_1") {
    resolvedUnit = "WEEKS";
    resolvedValue = 1;
  } else if (formIntervalPreset === "CUSTOM") {
    resolvedUnit = formCustomUnit;
    resolvedValue = Math.max(1, formCustomValue);
  }

  // Live human-readable recurrence preview text
  const livePreviewSentence = formatRecurrenceText(
    resolvedUnit,
    resolvedValue,
    formTargetTime,
    computedEndDate,
    computedStartDate
  );

  // Submit Form
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formTitle.trim() || !formTargetTime.trim()) {
      alert("لطفاً عنوان و ساعت تسک را وارد کنید.");
      return;
    }

    setSubmitting(true);
    try {
      if (editingSchedule) {
        // Edit Schedule
        const res = await fetch("/api/admin/schedules", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingSchedule.id,
            title: formTitle.trim(),
            category: formCategory,
            itemType: formCategory === "medication" ? "medication" : (formCategory === "vital" ? "vital" : (formCategory === "dvt_care" ? "dvt_care" : "routine_task")),
            targetTime: formTargetTime,
            mealRelation: formMealRelation === "NONE" ? null : formMealRelation,
            medicationId: formCategory === "medication" ? formMedicationId || null : null,
            startDate: computedStartDate.toISOString(),
            intervalUnit: resolvedUnit,
            intervalValue: resolvedValue,
            endDate: computedEndDate ? computedEndDate.toISOString() : null,
            requiresNote: formRequiresNote,
            vitalType: (formCategory === "vital" || formCategory === "dvt_care") ? formVitalType : null,
          }),
        });

        if (res.ok) {
          showToast("تسک با موفقیت به‌روزرسانی شد");
          setIsModalOpen(false);
          fetchSchedules();
        } else {
          showToast("خطا در به‌روزرسانی تسک");
        }
      } else {
        // Create Schedule
        const res = await fetch("/api/admin/schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formTitle.trim(),
            category: formCategory,
            itemType: formCategory === "medication" ? "medication" : (formCategory === "vital" ? "vital" : (formCategory === "dvt_care" ? "dvt_care" : "routine_task")),
            targetTime: formTargetTime,
            mealRelation: formMealRelation === "NONE" ? null : formMealRelation,
            medicationId: formCategory === "medication" ? formMedicationId || null : null,
            startDate: computedStartDate.toISOString(),
            intervalUnit: resolvedUnit,
            intervalValue: resolvedValue,
            endDate: computedEndDate ? computedEndDate.toISOString() : null,
            requiresNote: formRequiresNote,
            vitalType: (formCategory === "vital" || formCategory === "dvt_care") ? formVitalType : null,
          }),
        });

        if (res.ok) {
          showToast("تسک جدید با موفقیت اضافه شد");
          setIsModalOpen(false);
          fetchSchedules();
        } else {
          showToast("خطا در ایجاد تسک");
        }
      }
    } catch {
      showToast("خطا در برقراری ارتباط با سرور");
    } finally {
      setSubmitting(false);
    }
  }

  // Toggle active status
  async function toggleActive(s: ScheduleItem) {
    try {
      const res = await fetch("/api/admin/schedules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: s.id,
          isActive: !s.isActive,
        }),
      });
      if (res.ok) {
        showToast(s.isActive ? "تسک غیرفعال شد" : "تسک مجدداً فعال شد");
        fetchSchedules();
      }
    } catch {
      showToast("خطا در تغییر وضعیت تسک");
    }
  }

  // Delete Schedule
  async function handleDelete(s: ScheduleItem) {
    if (!confirm(`آیا از حذف تسک «${s.title}» اطمینان دارید؟`)) return;

    try {
      const res = await fetch(`/api/admin/schedules?id=${s.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showToast("تسک حذف شد");
        fetchSchedules();
      }
    } catch {
      showToast("خطا در حذف تسک");
    }
  }

  // Filtered schedules list
  const filtered = schedules.filter((s) => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (categoryFilter !== "all") {
      if (categoryFilter === "vital") {
        if (!s.vitalType && s.category !== "vital") return false;
      } else if (s.category !== categoryFilter) {
        return false;
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = s.title.toLowerCase().includes(q);
      const matchRecurrence = s.recurrenceText.toLowerCase().includes(q);
      const matchMed = s.medication?.nameFa?.toLowerCase().includes(q) ||
                       s.medication?.nameEn?.toLowerCase().includes(q);
      return matchTitle || matchRecurrence || matchMed;
    }
    return true;
  });

  const totalCount = schedules.length;
  const activeCount = schedules.filter((s) => s.status === "ACTIVE").length;
  const expiredCount = schedules.filter((s) => s.status === "EXPIRED").length;
  const inactiveCount = schedules.filter((s) => s.status === "INACTIVE").length;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-emerald-900/90 backdrop-blur-md text-white font-bold text-sm shadow-2xl flex items-center gap-2 border border-emerald-500/40 animate-bounce">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header & Main Action */}
      <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        {/* Top row: Title on right, Refresh button on top-left (like /nurse/timeline) */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-care-50 dark:bg-emerald-950/40 text-care-700 dark:text-emerald-400">
              <CalendarClock className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-slate-100">برنامه مراقبت و زمان‌بندی تسک‌ها</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                تعریف اقدامات روتین، دوره‌ای و دارویی بیمار با فواصل دلخواه و تاریخ پایان
              </p>
            </div>
          </div>

          <button
            onClick={fetchSchedules}
            className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 flex items-center gap-1 flex-shrink-0 pt-1 transition active:scale-95"
            title="بروزرسانی تسک‌ها"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>بروزرسانی</span>
          </button>
        </div>

        {/* Action buttons row */}
        {userRole === "ADMIN" ? (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={openCreateModal}
              className="px-5 py-2.5 rounded-2xl bg-care-600 hover:bg-care-700 text-white font-black text-xs shadow-lg shadow-care-600/30 flex items-center gap-2 transition active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>افزودن تسک جدید</span>
            </button>

            <button
              onClick={() => {
                fetchAdhocSuggestions();
                setIsAdhocModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-950 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800 font-bold text-xs flex items-center gap-1.5 transition active:scale-95"
              title="مدیریت عناوین پیشنهادی اقدام موردی پرستار"
            >
              <ClipboardPlus className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="hidden sm:inline">پیشنهادات اقدامات موردی</span>
              <span className="sm:hidden">اقدامات موردی</span>
            </button>
          </div>
        ) : (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/80 rounded-2xl p-2.5 px-3.5 text-xs font-bold text-sky-800 dark:text-sky-300 flex items-center gap-2">
              <Info className="w-4 h-4 flex-shrink-0 text-sky-600 dark:text-sky-400" />
              <span>دسترسی پرستار: حالت نظارت و بررسی فعال است (تعریف و حذف تسک در انحصار ادمین است).</span>
            </div>
          </div>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">کل تسک‌های سیستم</span>
          <div className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-100 font-mono">
            {toPersianDigits(totalCount)}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-emerald-100 dark:border-emerald-900/40 shadow-xs">
          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">فعال در کارتابل پرستار</span>
          <div className="mt-1 text-2xl font-black text-emerald-700 dark:text-emerald-400 font-mono">
            {toPersianDigits(activeCount)}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-amber-100 dark:border-amber-900/40 shadow-xs">
          <span className="text-xs font-bold text-amber-700 dark:text-amber-400">پایان دوره درمانی</span>
          <div className="mt-1 text-2xl font-black text-amber-700 dark:text-amber-400 font-mono">
            {toPersianDigits(expiredCount)}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs font-bold text-slate-400 dark:text-slate-500">غیرفعال موقت</span>
          <div className="mt-1 text-2xl font-black text-slate-500 dark:text-slate-400 font-mono">
            {toPersianDigits(inactiveCount)}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="جستجو در عنوان، نام دارو یا توضیحات تسک..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-4 pr-10 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-care-500 shadow-xs placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </div>

        {/* Status Tabs */}
        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800 w-full sm:w-auto overflow-x-auto">
          {[
            { id: "all", label: "همه" },
            { id: "ACTIVE", label: "فعال" },
            { id: "EXPIRED", label: "پایان‌یافته" },
            { id: "INACTIVE", label: "غیرفعال" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                statusFilter === tab.id
                  ? "bg-slate-900 dark:bg-slate-700 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: "all", label: "تمام دسته‌ها" },
          { id: "medication", label: "دارویی", icon: Pill },
          { id: "vital", label: "سنجش‌ها و مراقبت بالینی", icon: Activity },
          { id: "meal", label: "غذا و میان‌وعده", icon: Utensils },
          { id: "dvt_care", label: "مراقبت DVT", icon: Shield },
          { id: "routine", label: "روتین و عمومی", icon: Clock },
        ].map((cat) => {
          const Icon = cat.icon;
          const isActive = categoryFilter === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                isActive
                  ? "bg-care-700 text-white shadow-sm"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              {Icon && <Icon className="w-3.5 h-3.5" />}
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Schedules List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
            <CalendarClock className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="font-bold text-sm text-slate-700 dark:text-slate-300">هیچ تسکی با این مشخصات یافت نشد.</p>
            <button
              onClick={openCreateModal}
              className="mt-4 px-4 py-2 rounded-xl bg-care-50 dark:bg-emerald-950/40 text-care-800 dark:text-emerald-300 font-bold text-xs hover:bg-care-100 dark:hover:bg-emerald-900/50 transition inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>ایجاد تسک جدید</span>
            </button>
          </div>
        ) : (
          filtered.map((s) => {
            const isMed = s.category === "medication";
            const isDvt = s.category === "dvt_care";
            const isMeal = s.category === "meal";

            return (
              <div
                key={s.id}
                className={`bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border-2 transition shadow-xs hover:shadow-md ${
                  s.status === "ACTIVE"
                    ? "border-slate-200/90 dark:border-slate-800"
                    : s.status === "EXPIRED"
                    ? "border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-950/20 opacity-80"
                    : "border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 opacity-60"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left: Time and info */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Time Badge */}
                    <div
                      className={`px-3 py-2 rounded-2xl font-mono text-sm font-black flex items-center justify-center flex-shrink-0 ${
                        s.status === "ACTIVE"
                          ? "bg-slate-900 dark:bg-slate-800 text-white"
                          : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {toPersianDigits(s.targetTime)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 leading-snug">
                          {s.title}
                        </h2>

                        {/* Status Badge */}
                        {s.status === "ACTIVE" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold text-[10px]">
                            فعال در برنامه
                          </span>
                        )}
                        {s.status === "EXPIRED" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 font-bold text-[10px]">
                            پایان دوره
                          </span>
                        )}
                        {s.status === "INACTIVE" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[10px]">
                            غیرفعال
                          </span>
                        )}

                        {/* Category tag */}
                        {s.vitalType ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-bold text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                            {s.vitalType === "blood_sugar" && "🩸 قند خون"}
                            {s.vitalType === "blood_pressure" && "🩺 فشار خون"}
                            {s.vitalType === "urine_output" && "⚡ ادرار سوند"}
                            {s.vitalType === "water_intake" && "💧 آب و مایعات"}
                            {s.vitalType === "dvt_care" && "⏱️ مراقبت DVT"}
                            {s.vitalType === "bowel_movement" && "😊 کارکرد روده"}
                            {s.vitalType === "clinical_photo" && "📷 تصویر بالینی"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold text-[10px]">
                            {isMed ? "دارو" : isDvt ? "مراقبت/DVT" : isMeal ? "غذا/اسموتی" : "روتین"}
                          </span>
                        )}

                        {/* Requires Note badge */}
                        {s.requiresNote && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-100 dark:bg-sky-950/60 text-sky-900 dark:text-sky-300 border border-sky-200 dark:border-sky-800 font-bold text-[10px]">
                            <FileText className="w-3 h-3 text-sky-700 dark:text-sky-400" />
                            نیاز به ثبت گزارش
                          </span>
                        )}
                      </div>

                      {/* Recurrence sentence */}
                      <div className="mt-1 flex items-center gap-2 text-xs font-bold text-care-800 dark:text-emerald-400 flex-wrap">
                        <span className="flex items-center gap-1">
                          <RefreshCw className="w-3 h-3 text-care-600 dark:text-emerald-400" />
                          {s.recurrenceText}
                        </span>

                        {s.isCompletedToday && (
                          <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1 text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            امروز انجام شده ({toPersianDigits(s.completedTodayCount)} بار)
                          </span>
                        )}
                      </div>

                      {/* Medication metadata if any */}
                      {s.medication?.boxNumber && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px] font-bold">
                            جعبه {toPersianDigits(s.medication.boxNumber)}
                          </span>
                          {s.medication.stockCount !== undefined && (
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              موجودی: {toPersianDigits(s.medication.stockCount)} عدد
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  {userRole === "ADMIN" ? (
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {/* Toggle Active Button */}
                      <button
                        onClick={() => toggleActive(s)}
                        className={`p-2.5 rounded-xl border font-bold text-xs flex items-center gap-1.5 transition ${
                          s.isActive
                            ? "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                            : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                        }`}
                        title={s.isActive ? "غیرفعال کردن موقت" : "فعال‌سازی مجدد"}
                      >
                        <Power className="w-4 h-4" />
                        <span className="text-[11px]">{s.isActive ? "غیرفعال" : "فعال‌سازی"}</span>
                      </button>

                      {/* Edit Button */}
                      <button
                        onClick={() => openEditModal(s)}
                        className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
                        title="ویرایش زمان‌بندی"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => handleDelete(s)}
                        className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 transition"
                        title="حذف کامل تسک"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <span className={`px-2.5 py-1 rounded-xl text-[11px] font-bold ${
                        s.isActive
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                      }`}>
                        {s.isActive ? "فعال" : "غیرفعال"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modern Task Modal (Add / Edit) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-hidden">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header (Fixed at top) */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/80 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-care-100 dark:bg-emerald-950/60 text-care-800 dark:text-emerald-300">
                  <CalendarClock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-slate-100">
                    {editingSchedule ? "ویرایش زمان‌بندی تسک" : "تعریف تسک مراقبتی جدید"}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    تنظیم ساعت، دوره تکرار و تاریخ پایان اقدام
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Scrollable Form Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5">
                {/* Category selector */}
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                    دسته‌بندی اقدام:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {[
                      { id: "vital", label: "سنجش بالینی", icon: Activity },
                      { id: "medication", label: "دارویی", icon: Pill },
                      { id: "meal", label: "غذا و میان‌وعده", icon: Utensils },
                      { id: "dvt_care", label: "مراقبت DVT", icon: Shield },
                      { id: "routine", label: "عمومی / سایر", icon: Clock },
                    ].map((cat) => {
                      const Icon = cat.icon;
                      const isSelected = formCategory === cat.id;
                      return (
                        <button
                          type="button"
                          key={cat.id}
                          onClick={() => {
                            setFormCategory(cat.id as any);
                            if (cat.id !== "vital" && cat.id !== "dvt_care") {
                              setFormVitalType(null);
                            } else if (cat.id === "dvt_care") {
                              setFormVitalType("dvt_care");
                              if (!formTitle || formTitle.startsWith("سنجش") || formTitle.startsWith("تخلیه") || formTitle.startsWith("ثبت") || formTitle.startsWith("مراقبت")) {
                                setFormTitle("مراقبت DVT و بالا بردن پای راست");
                              }
                            }
                          }}
                          className={`p-2.5 rounded-2xl border-2 font-bold text-xs flex items-center justify-center gap-1.5 transition ${
                            isSelected
                              ? "bg-care-50 dark:bg-emerald-950/40 border-care-600 dark:border-emerald-500 text-care-900 dark:text-emerald-200 shadow-xs"
                              : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                          }`}
                        >
                          <Icon className={`w-4 h-4 ${isSelected ? "text-care-600 dark:text-emerald-400" : "text-slate-400"}`} />
                          <span>{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Clinical Parameter Selector (matching QuickActionFAB cards from screenshot) */}
                {(formCategory === "vital" || formCategory === "dvt_care") && (
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-700 space-y-2">
                    <label className="block text-xs font-black text-slate-800 dark:text-slate-200">
                      انتخاب پارامتر بالینی (نوع ثبت مستقیم در تایم‌لاین پرستار):
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        {
                          id: "blood_sugar",
                          title: "قند خون",
                          desc: "ناشتا / ۲ ساعته / کیپد",
                          defaultTitle: "سنجش قند خون",
                          defaultMeal: "FASTING",
                          icon: Heart,
                          color: "border-rose-300 bg-rose-50 text-rose-950 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800",
                          iconBg: "bg-rose-500 text-white",
                        },
                        {
                          id: "blood_pressure",
                          title: "فشار خون",
                          desc: "سیستول / دیاستول",
                          defaultTitle: "سنجش فشار خون",
                          defaultMeal: "NONE",
                          icon: Stethoscope,
                          color: "border-purple-300 bg-purple-50 text-purple-950 dark:bg-purple-950/40 dark:text-purple-200 dark:border-purple-800",
                          iconBg: "bg-purple-500 text-white",
                        },
                        {
                          id: "urine_output",
                          title: "تخلیه ادرار سوند",
                          desc: "سی سی + رنگ",
                          defaultTitle: "تخلیه ادرار سوند",
                          defaultMeal: "NONE",
                          icon: Activity,
                          color: "border-amber-300 bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800",
                          iconBg: "bg-amber-500 text-white",
                        },
                        {
                          id: "water_intake",
                          title: "آب و مایعات",
                          desc: "استکان / لیوان / ماگ",
                          defaultTitle: "ثبت مصرف آب و مایعات",
                          defaultMeal: "NONE",
                          icon: Droplets,
                          color: "border-sky-300 bg-sky-50 text-sky-950 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-800",
                          iconBg: "bg-sky-500 text-white",
                        },
                        {
                          id: "dvt_care",
                          title: "DVT پای راست",
                          desc: "تایمر بالا بردن پا",
                          defaultTitle: "مراقبت DVT و بالا بردن پای راست",
                          defaultMeal: "NONE",
                          icon: Timer,
                          color: "border-teal-300 bg-teal-50 text-teal-950 dark:bg-teal-950/40 dark:text-teal-200 dark:border-teal-800",
                          iconBg: "bg-teal-600 text-white",
                        },
                        {
                          id: "bowel_movement",
                          title: "کارکرد روده و ملین",
                          desc: "+۱ / +۲ / شیاف / ساشه",
                          defaultTitle: "بررسی کارکرد روده و ملین",
                          defaultMeal: "NONE",
                          icon: Smile,
                          color: "border-orange-300 bg-orange-50 text-orange-950 dark:bg-orange-950/40 dark:text-orange-200 dark:border-orange-800",
                          iconBg: "bg-orange-500 text-white",
                        },
                        {
                          id: "clinical_photo",
                          title: "ثبت تصویر یا یادداشت بالینی",
                          desc: "عکس پا/DVT، قرمزی پوست، رویداد",
                          defaultTitle: "بررسی بالینی و ثبت عکس",
                          defaultMeal: "NONE",
                          icon: Camera,
                          color: "border-emerald-300 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800",
                          iconBg: "bg-emerald-600 text-white",
                        },
                      ].map((item) => {
                        const Icon = item.icon;
                        const isSelected = formVitalType === item.id;
                        return (
                          <button
                            type="button"
                            key={item.id}
                            onClick={() => {
                              setFormVitalType(item.id);
                              if (item.id === "dvt_care") {
                                setFormCategory("dvt_care");
                              } else {
                                setFormCategory("vital");
                              }
                              if (!formTitle || formTitle.startsWith("سنجش") || formTitle.startsWith("تخلیه") || formTitle.startsWith("ثبت") || formTitle.startsWith("مراقبت") || formTitle.startsWith("بررسی")) {
                                setFormTitle(item.defaultTitle);
                              }
                              if (item.defaultMeal !== "NONE") {
                                setFormMealRelation(item.defaultMeal);
                              }
                            }}
                            className={`p-2.5 rounded-2xl border-2 text-right flex items-center justify-between transition ${
                              isSelected
                                ? `${item.color} ring-2 ring-slate-800 dark:ring-emerald-400 shadow-xs font-black`
                                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60"
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-black">{item.title}</div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">{item.desc}</div>
                            </div>
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mr-2 ${item.iconBg}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

              {/* Medication Selector if category is medication */}
              {formCategory === "medication" && (
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                    انتخاب از لیست داروهای بیمار (اختیاری):
                  </label>
                  <select
                    value={formMedicationId}
                    onChange={(e) => handleMedicationSelect(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-care-500 shadow-xs"
                  >
                    <option value="">-- انتخاب دارو یا ورود آزاد عنوان در زیر --</option>
                    {medications.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nameFa} {m.boxNumber ? `(جعبه ${m.boxNumber})` : ""} {m.dosage ? `- ${m.dosage}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Title Input */}
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                  عنوان کامل تسک: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثلاً: قرص لوتیروکسین، تعویض پانسمان ساعد، بالا بردن پای راست..."
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-care-500 shadow-xs"
                />
              </div>

              {/* Step 1: Target Time & First Run */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
                {/* Target Time */}
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                    ساعت اجرای تسک: <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={formTargetTime}
                    onChange={(e) => setFormTargetTime(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-black font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:border-care-500"
                  />
                  {/* Quick time chips */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {["06:00", "08:00", "12:00", "14:00", "18:00", "22:00"].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setFormTargetTime(t)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition ${
                          formTargetTime === t
                            ? "bg-slate-900 dark:bg-slate-700 text-white"
                            : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                        }`}
                      >
                        {toPersianDigits(t)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* First Run Date */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-black text-slate-700 dark:text-slate-300">
                      تاریخ اولین اجرا:
                    </label>
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => setFormStartDateMode("PRESET")}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition ${
                          formStartDateMode === "PRESET"
                            ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs"
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-900"
                        }`}
                      >
                        سریع
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormStartDateMode("CUSTOM")}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition ${
                          formStartDateMode === "CUSTOM"
                            ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs"
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-900"
                        }`}
                      >
                        دلخواه
                      </button>
                    </div>
                  </div>

                  {formStartDateMode === "PRESET" ? (
                    <div className="flex items-center gap-1.5">
                      {[
                        { offset: 0, label: "از امروز" },
                        { offset: 1, label: "از فردا" },
                        { offset: 2, label: "از پس‌فردا" },
                      ].map((d) => (
                        <button
                          key={d.offset}
                          type="button"
                          onClick={() => setFormStartDateOffset(d.offset)}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${
                            formStartDateOffset === d.offset
                              ? "bg-care-700 dark:bg-emerald-600 text-white border-care-700 dark:border-emerald-600 shadow-xs"
                              : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={formCustomStartDate}
                        onChange={(e) => setFormCustomStartDate(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold text-xs"
                      />
                    </div>
                  )}
                  <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-2">
                    موعد: {formatJalaliDate(computedStartDate)} ساعت {toPersianDigits(formTargetTime)}
                  </div>
                </div>
              </div>

              {/* Step 2: Repetition / Interval Selection */}
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                  فاصله تکرار (اینتروال):
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {[
                    { id: "DAYS_1", label: "روزانه (۲۴س)" },
                    { id: "HOURS_8", label: "هر ۸ ساعت" },
                    { id: "HOURS_6", label: "هر ۶ ساعت" },
                    { id: "HOURS_12", label: "هر ۱۲ ساعت" },
                    { id: "DAYS_2", label: "هر ۲ روز" },
                    { id: "WEEKS_1", label: "هفتگی (۷ روز)" },
                    { id: "ONCE", label: "فقط یک‌بار" },
                    { id: "CUSTOM", label: "⚙️ دلخواه..." },
                  ].map((p) => {
                    const isSelected = formIntervalPreset === p.id;
                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => setFormIntervalPreset(p.id)}
                        className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition text-center ${
                          isSelected
                            ? "bg-slate-900 dark:bg-slate-700 text-white border-slate-900 dark:border-slate-700 shadow-xs"
                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Interval inputs if selected */}
                {formIntervalPreset === "CUSTOM" && (
                  <div className="mt-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">هر</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={formCustomValue}
                      onChange={(e) => setFormCustomValue(parseInt(e.target.value, 10) || 1)}
                      className="w-16 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-center font-bold text-xs"
                    />
                    <select
                      value={formCustomUnit}
                      onChange={(e) => setFormCustomUnit(e.target.value as any)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    >
                      <option value="HOURS">ساعت یک‌بار</option>
                      <option value="DAYS">روز یک‌بار</option>
                      <option value="WEEKS">هفته یک‌بار</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Step 3: Optional End Date / Treatment Duration */}
              <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formHasEndDate}
                      onChange={(e) => setFormHasEndDate(e.target.checked)}
                      className="w-4 h-4 rounded text-care-600 focus:ring-care-500"
                    />
                    <span className="text-xs font-black text-amber-950 dark:text-amber-200">
                      این تسک دوره درمانی / تاریخ و ساعت پایان دارد
                    </span>
                  </label>
                  <span className="text-[10px] font-bold text-amber-800 dark:text-amber-400">
                    {formHasEndDate ? "محدود" : "دائمی و پیوسته"}
                  </span>
                </div>

                {formHasEndDate && (
                  <div className="pt-2 border-t border-amber-200/60 dark:border-amber-900/60 space-y-2.5">
                    <div className="flex items-center gap-1 bg-white/80 dark:bg-slate-900/80 p-0.5 rounded-xl border border-amber-200 dark:border-amber-800/60 w-fit">
                      <button
                        type="button"
                        onClick={() => setFormEndDateMode("DURATION")}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${
                          formEndDateMode === "DURATION"
                            ? "bg-amber-600 text-white"
                            : "text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        طول دوره (روز)
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormEndDateMode("CUSTOM")}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${
                          formEndDateMode === "CUSTOM"
                            ? "bg-amber-600 text-white"
                            : "text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        تاریخ و ساعت دلخواه
                      </button>
                    </div>

                    {formEndDateMode === "DURATION" ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {[
                          { days: 3, label: "۳ روزه" },
                          { days: 5, label: "۵ روزه" },
                          { days: 7, label: "۱ هفته" },
                          { days: 14, label: "۲ هفته" },
                          { days: 30, label: "۱ ماه" },
                        ].map((dur) => (
                          <button
                            type="button"
                            key={dur.days}
                            onClick={() => setFormDurationDays(dur.days)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                              formDurationDays === dur.days
                                ? "bg-amber-600 text-white border-amber-600"
                                : "bg-white dark:bg-slate-800 border-amber-200 dark:border-amber-800/80 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                            }`}
                          >
                            {dur.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex-1 min-w-[140px]">
                          <label className="block text-[10px] font-bold text-amber-900 dark:text-amber-300 mb-1">
                            تاریخ پایان:
                          </label>
                          <input
                            type="date"
                            value={formCustomEndDate}
                            onChange={(e) => setFormCustomEndDate(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold text-xs"
                          />
                        </div>
                        <div className="w-28">
                          <label className="block text-[10px] font-bold text-amber-900 dark:text-amber-300 mb-1">
                            ساعت پایان:
                          </label>
                          <input
                            type="time"
                            value={formCustomEndTime}
                            onChange={(e) => setFormCustomEndTime(e.target.value)}
                            className="w-full px-2 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold text-xs text-center"
                          />
                        </div>
                      </div>
                    )}

                    {computedEndDate && (
                      <div className="mt-2 text-xs font-bold text-amber-900 dark:text-amber-300">
                        پایان دوره: {formatJalaliDateTime(computedEndDate)}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Step 4: Requires Note on Completion */}
              <div className="p-3.5 rounded-2xl bg-sky-50/80 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/50 flex items-center justify-between">
                <label className="flex items-center gap-2.5 cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={formRequiresNote}
                    onChange={(e) => setFormRequiresNote(e.target.checked)}
                    className="w-4 h-4 rounded text-care-600 focus:ring-care-500"
                  />
                  <div>
                    <span className="text-xs font-black text-sky-950 dark:text-sky-200">
                      نیاز به ثبت گزارش / توضیحات پرستار هنگام انجام دارد
                    </span>
                    <p className="text-[10px] text-sky-800 dark:text-sky-400 mt-0.5 leading-relaxed">
                      با تایید «انجام شد» توسط پرستار، پاپ‌آپ باز می‌شود تا گزارش بالینی ثبت شود (مانند مقدار مصرف صبحانه یا وضعیت موضع)
                    </p>
                  </div>
                </label>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-200/80 dark:bg-sky-900/60 text-sky-950 dark:text-sky-200 flex-shrink-0">
                  {formRequiresNote ? "الزامی" : "اختیاری"}
                </span>
              </div>

              {/* Live Preview Box */}
              <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/50 text-indigo-950 dark:text-indigo-200 flex items-start gap-2.5">
                <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <span className="font-black">پیش‌نمایش برنامه: </span>
                  <span className="font-bold">{livePreviewSentence}</span>
                </div>
              </div>

              </div>

              {/* Modal Buttons (Fixed at bottom) */}
              <div className="p-3.5 sm:p-4 bg-slate-50/90 dark:bg-slate-800/90 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                >
                  انصراف
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-care-600 hover:bg-care-700 text-white text-xs font-black shadow-md shadow-care-600/30 transition active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingSchedule ? "ذخیره تغییرات" : "افزودن و فعال‌سازی"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ad-Hoc Suggestions Management Modal */}
      {isAdhocModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-hidden">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-indigo-50/70 dark:bg-indigo-950/40 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300">
                  <ClipboardPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-slate-100">
                    مدیریت عناوین پیشنهادی اقدامات موردی
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    این عناوین در منوی «اقدام پیش‌بینی‌نشده» پرستار جهت انتخاب سریع نمایش داده می‌شوند
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAdhocModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-5">
              {/* Add New Suggestion Form */}
              <form onSubmit={handleAddSuggestion} className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 shadow-2xs">
                <span className="text-xs font-black text-slate-800 dark:text-slate-200">افزودن عنوان جدید به پیشنهادات:</span>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    required
                    placeholder="عنوان اقدام (مثلاً: ماساژ گردن و شانه، پانسمان آرنج...)"
                    value={newSuggestionTitle}
                    onChange={(e) => setNewSuggestionTitle(e.target.value)}
                    className="w-full sm:flex-1 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 shadow-2xs"
                  />
                  <div className="flex items-center gap-2">
                    <select
                      value={newSuggestionCategory}
                      onChange={(e) => setNewSuggestionCategory(e.target.value)}
                      className="flex-1 sm:w-32 px-3 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500 shadow-2xs"
                    >
                      <option value="مراقبتی">مراقبتی</option>
                      <option value="بهداشتی">بهداشتی</option>
                      <option value="دارویی">دارویی</option>
                      <option value="پایش علائم">پایش علائم</option>
                      <option value="فوریت">فوریت</option>
                    </select>
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition active:scale-95 whitespace-nowrap shadow-xs flex items-center justify-center gap-1"
                    >
                      + افزودن
                    </button>
                  </div>
                </div>
              </form>

              {/* Current Suggestions List */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-300">عناوین فعال فعلی:</span>
                  <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-900/50">
                    {toPersianDigits(adhocSuggestions.length)} مورد
                  </span>
                </div>

                {loadingSuggestions ? (
                  <div className="p-8 text-center text-slate-400 dark:text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-xs font-bold">در حال بارگذاری...</span>
                  </div>
                ) : adhocSuggestions.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs font-bold bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                    هیچ عنوان پیشنهادی ثبت نشده است.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto overflow-x-hidden p-1">
                    {adhocSuggestions.map((sug) => (
                      <div
                        key={sug.id}
                        className="flex items-center justify-between gap-2 p-2.5 px-3.5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/80 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/50 text-slate-800 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700 text-xs font-bold transition shadow-2xs group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="truncate">{sug.title}</span>
                          {sug.category && (
                            <span className="text-[10px] text-indigo-700 dark:text-indigo-300 bg-indigo-100/70 dark:bg-indigo-950/70 px-1.5 py-0.5 rounded-md font-medium flex-shrink-0">
                              {sug.category}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteSuggestion(sug.id)}
                          className="p-1 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-100/70 dark:hover:bg-rose-950/60 rounded-lg transition flex-shrink-0"
                          title="حذف این پیشنهاد"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Close button (Fixed at bottom) */}
            <div className="p-3.5 sm:p-4 bg-slate-50/90 dark:bg-slate-800/90 border-t border-slate-100 dark:border-slate-800 flex justify-end flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsAdhocModalOpen(false)}
                className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold transition active:scale-95"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
