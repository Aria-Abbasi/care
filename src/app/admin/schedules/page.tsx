"use client";

import { useEffect, useState, useCallback } from "react";
import {
  CalendarClock, Plus, Search, Check, X, Clock, Pill, Utensils,
  Shield, AlertCircle, Trash2, Edit3, Power, RefreshCw, Sparkles,
  ChevronDown, Calendar, Info, CheckCircle2, XCircle, FileText, Tag, ClipboardPlus
} from "lucide-react";
import {
  toPersianDigits, formatJalaliDate, formatJalaliTime,
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
  const [formCategory, setFormCategory] = useState<"medication" | "meal" | "dvt_care" | "routine">("routine");
  const [formMedicationId, setFormMedicationId] = useState<string>("");
  const [formTitle, setFormTitle] = useState("");
  const [formTargetTime, setFormTargetTime] = useState("08:00");
  const [formMealRelation, setFormMealRelation] = useState("NONE");
  const [formRequiresNote, setFormRequiresNote] = useState<boolean>(false);
  
  // Recurrence states
  const [formStartDateOffset, setFormStartDateOffset] = useState<number>(0); // 0 = today, 1 = tomorrow, etc.
  const [formIntervalPreset, setFormIntervalPreset] = useState<string>("DAYS_1");
  const [formCustomUnit, setFormCustomUnit] = useState<"HOURS" | "DAYS" | "WEEKS">("HOURS");
  const [formCustomValue, setFormCustomValue] = useState<number>(8);
  
  // End Date states
  const [formHasEndDate, setFormHasEndDate] = useState<boolean>(false);
  const [formDurationDays, setFormDurationDays] = useState<number>(5); // 3, 5, 7, 14, 30

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
    setFormMedicationId("");
    setFormTitle("");
    setFormTargetTime("08:00");
    setFormMealRelation("NONE");
    setFormRequiresNote(false);
    setFormStartDateOffset(0);
    setFormIntervalPreset("DAYS_1");
    setFormCustomUnit("HOURS");
    setFormCustomValue(8);
    setFormHasEndDate(false);
    setFormDurationDays(5);
    setIsModalOpen(true);
  }

  // Open Edit Modal
  function openEditModal(s: ScheduleItem) {
    setEditingSchedule(s);
    setFormCategory(s.category as any || "routine");
    setFormMedicationId(s.medication?.id || "");
    setFormTitle(s.title);
    setFormTargetTime(s.targetTime);
    setFormMealRelation(s.mealRelation || "NONE");
    setFormRequiresNote(s.requiresNote || false);
    setFormStartDateOffset(0);

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
      const diffMs = new Date(s.endDate).getTime() - new Date().getTime();
      const diffDays = Math.max(1, Math.round(diffMs / 86400000));
      setFormDurationDays(diffDays);
    } else {
      setFormHasEndDate(false);
      setFormDurationDays(5);
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
  const computedStartDate = new Date(Date.now() + formStartDateOffset * 86400000);
  const computedEndDate = formHasEndDate
    ? new Date(computedStartDate.getTime() + formDurationDays * 86400000)
    : null;

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
    computedEndDate
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
            targetTime: formTargetTime,
            mealRelation: formMealRelation === "NONE" ? null : formMealRelation,
            medicationId: formCategory === "medication" ? formMedicationId || null : null,
            startDate: computedStartDate.toISOString(),
            intervalUnit: resolvedUnit,
            intervalValue: resolvedValue,
            endDate: computedEndDate ? computedEndDate.toISOString() : null,
            requiresNote: formRequiresNote,
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
            targetTime: formTargetTime,
            mealRelation: formMealRelation === "NONE" ? null : formMealRelation,
            medicationId: formCategory === "medication" ? formMedicationId || null : null,
            startDate: computedStartDate.toISOString(),
            intervalUnit: resolvedUnit,
            intervalValue: resolvedValue,
            endDate: computedEndDate ? computedEndDate.toISOString() : null,
            requiresNote: formRequiresNote,
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
    if (categoryFilter !== "all" && s.category !== categoryFilter) return false;
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-care-50 text-care-700">
              <CalendarClock className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">برنامه مراقبت و زمان‌بندی تسک‌ها</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                تعریف اقدامات روتین، دوره‌ای و دارویی بیمار با فواصل دلخواه و تاریخ پایان
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchAdhocSuggestions();
              setIsAdhocModalOpen(true);
            }}
            className="px-4 py-3 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-950 border border-indigo-200 font-bold text-xs flex items-center gap-1.5 transition active:scale-95"
            title="مدیریت عناوین پیشنهادی اقدام موردی پرستار"
          >
            <ClipboardPlus className="w-4 h-4 text-indigo-600" />
            <span className="hidden sm:inline">پیشنهادات اقدامات موردی</span>
            <span className="sm:hidden">اقدامات موردی</span>
          </button>

          <button
            onClick={fetchSchedules}
            className="p-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
            title="بروزرسانی"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={openCreateModal}
            className="px-5 py-3 rounded-2xl bg-care-600 hover:bg-care-700 text-white font-black text-xs shadow-lg shadow-care-600/30 flex items-center gap-2 transition active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>افزودن تسک جدید</span>
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500">کل تسک‌های سیستم</span>
          <div className="mt-1 text-2xl font-black text-slate-900 font-mono">
            {toPersianDigits(totalCount)}
          </div>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-emerald-100 shadow-xs">
          <span className="text-xs font-bold text-emerald-700">فعال در کارتابل پرستار</span>
          <div className="mt-1 text-2xl font-black text-emerald-700 font-mono">
            {toPersianDigits(activeCount)}
          </div>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-amber-100 shadow-xs">
          <span className="text-xs font-bold text-amber-700">پایان دوره درمانی</span>
          <div className="mt-1 text-2xl font-black text-amber-700 font-mono">
            {toPersianDigits(expiredCount)}
          </div>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-400">غیرفعال موقت</span>
          <div className="mt-1 text-2xl font-black text-slate-500 font-mono">
            {toPersianDigits(inactiveCount)}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="جستجو در عنوان، نام دارو یا توضیحات تسک..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-4 pr-10 py-3 rounded-2xl bg-white border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-care-500 shadow-xs"
          />
        </div>

        {/* Status Tabs */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-200 w-full sm:w-auto overflow-x-auto">
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
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
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
          { id: "meal", label: "غذا و میان‌وعده", icon: Utensils },
          { id: "dvt_care", label: "مراقبت بالینی و DVT", icon: Shield },
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
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
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
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 text-slate-500">
            <CalendarClock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="font-bold text-sm text-slate-700">هیچ تسکی با این مشخصات یافت نشد.</p>
            <button
              onClick={openCreateModal}
              className="mt-4 px-4 py-2 rounded-xl bg-care-50 text-care-800 font-bold text-xs hover:bg-care-100 transition inline-flex items-center gap-1.5"
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
                className={`bg-white p-4 sm:p-5 rounded-3xl border-2 transition shadow-xs hover:shadow-md ${
                  s.status === "ACTIVE"
                    ? "border-slate-200/90"
                    : s.status === "EXPIRED"
                    ? "border-amber-200 bg-amber-50/30 opacity-80"
                    : "border-slate-200 bg-slate-50/70 opacity-60"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left: Time and info */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Time Badge */}
                    <div
                      className={`px-3 py-2 rounded-2xl font-mono text-sm font-black flex items-center justify-center flex-shrink-0 ${
                        s.status === "ACTIVE"
                          ? "bg-slate-900 text-white"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {toPersianDigits(s.targetTime)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm font-black text-slate-900 leading-snug">
                          {s.title}
                        </h2>

                        {/* Status Badge */}
                        {s.status === "ACTIVE" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                            فعال در برنامه
                          </span>
                        )}
                        {s.status === "EXPIRED" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 font-bold text-[10px]">
                            پایان دوره
                          </span>
                        )}
                        {s.status === "INACTIVE" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-slate-200 text-slate-700 font-bold text-[10px]">
                            غیرفعال
                          </span>
                        )}

                        {/* Category tag */}
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 font-semibold text-[10px]">
                          {isMed ? "دارو" : isDvt ? "مراقبت/DVT" : isMeal ? "غذا/اسموتی" : "روتین"}
                        </span>

                        {/* Requires Note badge */}
                        {s.requiresNote && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-100 text-sky-900 border border-sky-200 font-bold text-[10px]">
                            <FileText className="w-3 h-3 text-sky-700" />
                            نیاز به ثبت گزارش
                          </span>
                        )}
                      </div>

                      {/* Recurrence sentence */}
                      <div className="mt-1 flex items-center gap-2 text-xs font-bold text-care-800 flex-wrap">
                        <span className="flex items-center gap-1">
                          <RefreshCw className="w-3 h-3 text-care-600" />
                          {s.recurrenceText}
                        </span>

                        {s.isCompletedToday && (
                          <span className="text-emerald-700 flex items-center gap-1 text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            امروز انجام شده ({toPersianDigits(s.completedTodayCount)} بار)
                          </span>
                        )}
                      </div>

                      {/* Medication metadata if any */}
                      {s.medication?.boxNumber && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 text-[11px] font-bold">
                            جعبه {toPersianDigits(s.medication.boxNumber)}
                          </span>
                          {s.medication.stockCount !== undefined && (
                            <span className="text-[11px] text-slate-500">
                              موجودی: {toPersianDigits(s.medication.stockCount)} عدد
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {/* Toggle Active Button */}
                    <button
                      onClick={() => toggleActive(s)}
                      className={`p-2.5 rounded-xl border font-bold text-xs flex items-center gap-1.5 transition ${
                        s.isActive
                          ? "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
                          : "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100"
                      }`}
                      title={s.isActive ? "غیرفعال کردن موقت" : "فعال‌سازی مجدد"}
                    >
                      <Power className="w-4 h-4" />
                      <span className="text-[11px]">{s.isActive ? "غیرفعال" : "فعال‌سازی"}</span>
                    </button>

                    {/* Edit Button */}
                    <button
                      onClick={() => openEditModal(s)}
                      className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                      title="ویرایش زمان‌بندی"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={() => handleDelete(s)}
                      className="p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition"
                      title="حذف کامل تسک"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modern Task Modal (Add / Edit) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-hidden">
          <div className="bg-white w-full max-w-xl max-h-[90vh] flex flex-col rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header (Fixed at top) */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-care-100 text-care-800">
                  <CalendarClock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-slate-900">
                    {editingSchedule ? "ویرایش زمان‌بندی تسک" : "تعریف تسک مراقبتی جدید"}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    تنظیم ساعت، دوره تکرار و تاریخ پایان اقدام
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
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
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  دسته‌بندی اقدام:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: "medication", label: "دارویی", icon: Pill },
                    { id: "meal", label: "غذا و میان‌وعده", icon: Utensils },
                    { id: "dvt_care", label: "مراقبت / DVT", icon: Shield },
                    { id: "routine", label: "عمومی / سایر", icon: Clock },
                  ].map((cat) => {
                    const Icon = cat.icon;
                    const isSelected = formCategory === cat.id;
                    return (
                      <button
                        type="button"
                        key={cat.id}
                        onClick={() => setFormCategory(cat.id as any)}
                        className={`p-2.5 rounded-2xl border-2 font-bold text-xs flex items-center justify-center gap-1.5 transition ${
                          isSelected
                            ? "bg-care-50 border-care-600 text-care-900 shadow-xs"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isSelected ? "text-care-600" : "text-slate-400"}`} />
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Medication Selector if category is medication */}
              {formCategory === "medication" && (
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">
                    انتخاب از لیست داروهای بیمار (اختیاری):
                  </label>
                  <select
                    value={formMedicationId}
                    onChange={(e) => handleMedicationSelect(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-care-500 shadow-xs"
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
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  عنوان کامل تسک: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثلاً: قرص لوتیروکسین، تعویض پانسمان ساعد، بالا بردن پای راست..."
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-care-500 shadow-xs"
                />
              </div>

              {/* Step 1: Target Time & First Run */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                {/* Target Time */}
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">
                    ساعت اجرای تسک: <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={formTargetTime}
                    onChange={(e) => setFormTargetTime(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-sm font-black font-mono text-slate-900 focus:outline-none focus:border-care-500"
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
                            ? "bg-slate-900 text-white"
                            : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {toPersianDigits(t)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* First Run Date */}
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">
                    تاریخ اولین اجرا:
                  </label>
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
                            ? "bg-care-700 text-white border-care-700 shadow-xs"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                  <div className="text-[11px] font-bold text-slate-500 mt-2">
                    موعد: {formatJalaliDate(computedStartDate)}
                  </div>
                </div>
              </div>

              {/* Step 2: Repetition / Interval Selection */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
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
                            ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Interval inputs if selected */}
                {formIntervalPreset === "CUSTOM" && (
                  <div className="mt-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600">هر</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={formCustomValue}
                      onChange={(e) => setFormCustomValue(parseInt(e.target.value, 10) || 1)}
                      className="w-16 px-2 py-1.5 rounded-lg border border-slate-200 text-center font-bold text-xs"
                    />
                    <select
                      value={formCustomUnit}
                      onChange={(e) => setFormCustomUnit(e.target.value as any)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold bg-white"
                    >
                      <option value="HOURS">ساعت یک‌بار</option>
                      <option value="DAYS">روز یک‌بار</option>
                      <option value="WEEKS">هفته یک‌بار</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Step 3: Optional End Date / Treatment Duration */}
              <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formHasEndDate}
                      onChange={(e) => setFormHasEndDate(e.target.checked)}
                      className="w-4 h-4 rounded text-care-600 focus:ring-care-500"
                    />
                    <span className="text-xs font-black text-amber-950">
                      این تسک دوره درمانی / تاریخ پایان دارد
                    </span>
                  </label>
                  <span className="text-[10px] font-bold text-amber-800">
                    {formHasEndDate ? "محدود" : "دائمی و پیوسته"}
                  </span>
                </div>

                {formHasEndDate && (
                  <div className="pt-2 border-t border-amber-200/60">
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
                              : "bg-white border-amber-200 text-amber-900 hover:bg-amber-100"
                          }`}
                        >
                          {dur.label}
                        </button>
                      ))}
                    </div>
                    {computedEndDate && (
                      <div className="mt-2 text-xs font-bold text-amber-900">
                        پایان دوره: {formatJalaliDate(computedEndDate)} (به مدت {toPersianDigits(formDurationDays)} روز)
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Step 4: Requires Note on Completion */}
              <div className="p-3.5 rounded-2xl bg-sky-50/80 border border-sky-200 flex items-center justify-between">
                <label className="flex items-center gap-2.5 cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={formRequiresNote}
                    onChange={(e) => setFormRequiresNote(e.target.checked)}
                    className="w-4 h-4 rounded text-care-600 focus:ring-care-500"
                  />
                  <div>
                    <span className="text-xs font-black text-sky-950">
                      نیاز به ثبت گزارش / توضیحات پرستار هنگام انجام دارد
                    </span>
                    <p className="text-[10px] text-sky-800 mt-0.5 leading-relaxed">
                      با تایید «انجام شد» توسط پرستار، پاپ‌آپ باز می‌شود تا گزارش بالینی ثبت شود (مانند مقدار مصرف صبحانه یا وضعیت موضع)
                    </p>
                  </div>
                </label>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-200/80 text-sky-950 flex-shrink-0">
                  {formRequiresNote ? "الزامی" : "اختیاری"}
                </span>
              </div>

              {/* Live Preview Box */}
              <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-950 flex items-start gap-2.5">
                <Sparkles className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <span className="font-black">پیش‌نمایش برنامه: </span>
                  <span className="font-bold">{livePreviewSentence}</span>
                </div>
              </div>

              </div>

              {/* Modal Buttons (Fixed at bottom) */}
              <div className="p-3.5 sm:p-4 bg-slate-50/90 border-t border-slate-100 flex items-center justify-end gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
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
          <div className="bg-white w-full max-w-lg max-h-[90vh] flex flex-col rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-indigo-50/60 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-100 text-indigo-800">
                  <ClipboardPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-slate-900">
                    مدیریت عناوین پیشنهادی اقدامات موردی
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    این عناوین در منوی «اقدام پیش‌بینی‌نشده» پرستار جهت انتخاب سریع نمایش داده می‌شوند
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAdhocModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
              {/* Add New Suggestion Form */}
              <form onSubmit={handleAddSuggestion} className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-black text-slate-800">افزودن عنوان جدید:</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="مثلاً: ماساژ گردن و شانه، پانسمان آرنج..."
                    value={newSuggestionTitle}
                    onChange={(e) => setNewSuggestionTitle(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                  <select
                    value={newSuggestionCategory}
                    onChange={(e) => setNewSuggestionCategory(e.target.value)}
                    className="px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="مراقبتی">مراقبتی</option>
                    <option value="بهداشتی">بهداشتی</option>
                    <option value="دارویی">دارویی</option>
                    <option value="پایش علائم">پایش علائم</option>
                    <option value="فوریت">فوریت</option>
                  </select>
                  <button
                    type="submit"
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition active:scale-95 whitespace-nowrap"
                  >
                    + افزودن
                  </button>
                </div>
              </form>

              {/* Current Suggestions List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-slate-700">عناوین فعال فعلی:</span>
                  <span className="text-[11px] font-bold text-slate-500">
                    {toPersianDigits(adhocSuggestions.length)} مورد
                  </span>
                </div>

                {loadingSuggestions ? (
                  <div className="p-6 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                    <span className="text-xs">در حال بارگذاری...</span>
                  </div>
                ) : adhocSuggestions.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs font-bold">
                    هیچ عنوان پیشنهادی ثبت نشده است.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto p-1">
                    {adhocSuggestions.map((sug) => (
                      <div
                        key={sug.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-950 border border-indigo-200 text-xs font-bold shadow-xs group"
                      >
                        <span>{sug.title}</span>
                        {sug.category && (
                          <span className="text-[9px] text-indigo-600 bg-indigo-100/60 px-1 py-0.2 rounded font-normal">
                            {sug.category}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteSuggestion(sug.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
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
            <div className="p-3.5 sm:p-4 bg-slate-50/90 border-t border-slate-100 flex justify-end flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsAdhocModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition"
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
