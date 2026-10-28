"use client";

import { useEffect, useState, useCallback } from "react";
import {
  CheckCircle2, Clock, Pill, Check,
  AlertCircle, Droplets, Activity, Heart, RefreshCw, ListFilter, Sparkles,
  FileText, X, Stethoscope, Timer, Smile, Camera, HeartPulse, RotateCcw, Edit3
} from "lucide-react";
import { toPersianDigits, formatJalaliTime } from "@/lib/jalali";
import QuickActionFAB, { ActiveActionTrigger, QuickModalType } from "@/components/nurse/QuickActionFAB";

interface ScheduleItem {
  id: string;
  scheduleId?: string;
  title: string;
  targetTime: string;
  category: string;
  itemType: string;
  mealRelation?: string | null;
  medication?: {
    boxNumber?: string | null;
    instructions?: string | null;
    timeConstraints?: string | null;
    stockCount?: number;
  } | null;
  requiresNote?: boolean;
  vitalType?: string | null;
  isCompleted: boolean;
  completedAt?: string | null;
  completedBy?: string | null;
  status: string;
  notes?: string | null;
  taskLogId?: string | null;
}

interface AdHocTaskItem {
  id: string;
  title: string;
  completedAt: string;
  completedBy: string;
  status: string;
  notes?: string | null;
}

interface ShiftStats {
  waterToday: number;
  urineToday: number;
  lastSugar?: {
    valueNum: number;
    recordedAt: string;
    mealTag: string;
  } | null;
  lastBowel?: {
    recordedAt: string;
    bowelGrade: string;
  } | null;
}

const VITAL_META: Record<string, {
  label: string;
  icon: any;
  border: string;
  badgeBg: string;
  badgeText: string;
  btnBg: string;
  btnText: string;
  actionLabel: string;
  modal: QuickModalType;
}> = {
  blood_sugar: {
    label: "قند خون",
    icon: Heart,
    border: "border-rose-200 dark:border-rose-900/50",
    badgeBg: "bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-900/50",
    badgeText: "text-rose-800 dark:text-rose-300",
    btnBg: "bg-rose-600 hover:bg-rose-700 shadow-rose-600/30",
    btnText: "text-white",
    actionLabel: "ثبت قند خون",
    modal: "GLUCOSE",
  },
  blood_pressure: {
    label: "فشار خون",
    icon: Stethoscope,
    border: "border-purple-200 dark:border-purple-900/50",
    badgeBg: "bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-900/50",
    badgeText: "text-purple-800 dark:text-purple-300",
    btnBg: "bg-purple-600 hover:bg-purple-700 shadow-purple-600/30",
    btnText: "text-white",
    actionLabel: "ثبت فشار خون",
    modal: "BP",
  },
  urine_output: {
    label: "تخلیه ادرار",
    icon: Activity,
    border: "border-amber-200 dark:border-amber-900/50",
    badgeBg: "bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-900/50",
    badgeText: "text-amber-900 dark:text-amber-300",
    btnBg: "bg-amber-600 hover:bg-amber-700 shadow-amber-600/30",
    btnText: "text-white",
    actionLabel: "ثبت ادرار سوند",
    modal: "URINE",
  },
  water_intake: {
    label: "آب و مایعات",
    icon: Droplets,
    border: "border-sky-200 dark:border-sky-900/50",
    badgeBg: "bg-sky-50 dark:bg-sky-950/60 border-sky-200 dark:border-sky-900/50",
    badgeText: "text-sky-800 dark:text-sky-300",
    btnBg: "bg-sky-600 hover:bg-sky-700 shadow-sky-600/30",
    btnText: "text-white",
    actionLabel: "ثبت آب",
    modal: "WATER",
  },
  dvt_care: {
    label: "مراقبت DVT",
    icon: Timer,
    border: "border-teal-200 dark:border-teal-900/50",
    badgeBg: "bg-teal-50 dark:bg-teal-950/60 border-teal-200 dark:border-teal-900/50",
    badgeText: "text-teal-900 dark:text-teal-300",
    btnBg: "bg-teal-600 hover:bg-teal-700 shadow-teal-600/30",
    btnText: "text-white",
    actionLabel: "تایمر DVT",
    modal: "DVT",
  },
  bowel_movement: {
    label: "کارکرد روده",
    icon: Smile,
    border: "border-orange-200 dark:border-orange-900/50",
    badgeBg: "bg-orange-50 dark:bg-orange-950/60 border-orange-200 dark:border-orange-900/50",
    badgeText: "text-orange-900 dark:text-orange-300",
    btnBg: "bg-orange-600 hover:bg-orange-700 shadow-orange-600/30",
    btnText: "text-white",
    actionLabel: "ثبت روده",
    modal: "BOWEL",
  },
  laxative: {
    label: "داروی ملین",
    icon: Pill,
    border: "border-purple-200 dark:border-purple-900/50",
    badgeBg: "bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-900/50",
    badgeText: "text-purple-900 dark:text-purple-300",
    btnBg: "bg-purple-600 hover:bg-purple-700 shadow-purple-600/30",
    btnText: "text-white",
    actionLabel: "ثبت ملین",
    modal: "BOWEL",
  },
  clinical_photo: {
    label: "تصویر بالینی",
    icon: Camera,
    border: "border-emerald-200 dark:border-emerald-900/50",
    badgeBg: "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-900/50",
    badgeText: "text-emerald-900 dark:text-emerald-300",
    btnBg: "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30",
    btnText: "text-white",
    actionLabel: "ثبت تصویر",
    modal: "NOTE",
  },
};

export default function NurseTimelinePage() {
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [adhocTasks, setAdhocTasks] = useState<AdHocTaskItem[]>([]);
  const [stats, setStats] = useState<ShiftStats>({ waterToday: 0, urineToday: 0 });
  const [activeFilter, setActiveFilter] = useState<"all" | "medication" | "vital" | "done">("all");
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<ActiveActionTrigger | null>(null);

  // Note popup state for tasks with requiresNote
  const [noteModalItem, setNoteModalItem] = useState<ScheduleItem | null>(null);
  const [noteText, setNoteText] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);

  // Edit done task modal state
  const [editModalItem, setEditModalItem] = useState<ScheduleItem | null>(null);
  const [editNoteText, setEditNoteText] = useState("");
  const [editValueNum, setEditValueNum] = useState("");
  const [editSys, setEditSys] = useState("");
  const [editDia, setEditDia] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Active DVT timer state (server-tracked)
  const [activeTimer, setActiveTimer] = useState<{
    id: string;
    timerType: string;
    startTime: string;
    scheduleId?: string | null;
    taskTitle?: string | null;
    elapsedSeconds?: number;
  } | null>(null);
  const [dvtElapsedSeconds, setDvtElapsedSeconds] = useState(0);

  const fetchTimeline = useCallback(async () => {
    try {
      const res = await fetch("/api/nurse/timeline");
      if (res.ok) {
        const data = await res.json();
        setSchedules(data.schedules || []);
        setAdhocTasks(data.adhocTasks || []);
        if (data.stats) setStats(data.stats);
        if (data.activeTimer) {
          setActiveTimer(data.activeTimer);
          setDvtElapsedSeconds(data.activeTimer.elapsedSeconds || 0);
        } else {
          setActiveTimer(null);
          setDvtElapsedSeconds(0);
        }
      }
    } catch (err) {
      console.error("Fetch timeline error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTimeline();
    const interval = setInterval(fetchTimeline, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, [fetchTimeline]);

  // Live stopwatch tick effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (activeTimer) {
      interval = setInterval(() => {
        const startMs = new Date(activeTimer.startTime).getTime();
        const diffSec = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
        setDvtElapsedSeconds(diffSec);
      }, 1000);
    } else {
      setDvtElapsedSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTimer]);

  function formatStopwatch(totalSec: number) {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${toPersianDigits(m.toString().padStart(2, "0"))}:${toPersianDigits(s.toString().padStart(2, "0"))}`;
  }

  async function handleStartDvtTimer(scheduleId?: string, taskTitle?: string) {
    try {
      const res = await fetch("/api/nurse/dvt-timer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "START",
          scheduleId: scheduleId || undefined,
          taskTitle: taskTitle || "مراقبت DVT پای راست",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveTimer(data.timer);
        setDvtElapsedSeconds(0);
      }
    } catch (err) {
      console.error("Start DVT timer error:", err);
    }
  }

  async function handleStopDvtTimer() {
    try {
      const res = await fetch("/api/nurse/dvt-timer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "STOP" }),
      });
      if (res.ok) {
        setActiveTimer(null);
        setDvtElapsedSeconds(0);
        fetchTimeline();
      }
    } catch (err) {
      console.error("Stop DVT timer error:", err);
    }
  }

  async function handleCancelDvtTimer() {
    try {
      const res = await fetch("/api/nurse/dvt-timer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CANCEL" }),
      });
      if (res.ok) {
        setActiveTimer(null);
        setDvtElapsedSeconds(0);
        fetchTimeline();
      }
    } catch (err) {
      console.error("Cancel DVT timer error:", err);
    }
  }

  // Handle task completion click
  function handleTaskClick(item: ScheduleItem) {
    if (item.isCompleted || completingId) return;

    if (item.vitalType === "dvt_care" || item.category === "dvt_care") {
      const isRunning = Boolean(
        activeTimer &&
          (activeTimer.scheduleId === item.id ||
            (!activeTimer.scheduleId && (item.vitalType === "dvt_care" || item.category === "dvt_care")))
      );
      if (isRunning) {
        handleStopDvtTimer();
      } else {
        handleStartDvtTimer(item.id, item.title);
      }
      return;
    }

    if (item.vitalType && VITAL_META[item.vitalType]) {
      setActiveAction({
        modal: VITAL_META[item.vitalType].modal,
        scheduleId: item.id,
        taskTitle: item.title,
        mealRelation: item.mealRelation,
      });
      return;
    }

    if (item.requiresNote) {
      setNoteModalItem(item);
      setNoteText("");
      return;
    }

    executeCompleteTask(item);
  }

  // Execute complete task
  async function executeCompleteTask(item: ScheduleItem, customNotes?: string) {
    if (item.isCompleted || completingId) return;
    setCompletingId(item.id);

    setSchedules((prev) =>
      prev.map((s) =>
        s.id === item.id
          ? {
              ...s,
              isCompleted: true,
              completedAt: new Date().toISOString(),
              completedBy: "پرستار",
              status: "DONE",
              notes: customNotes || null,
            }
          : s
      )
    );

    try {
      const res = await fetch("/api/nurse/tasks/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleId: item.id,
          taskTitle: item.title,
          status: "DONE",
          notes: customNotes?.trim() || undefined,
        }),
      });

      if (!res.ok) {
        fetchTimeline();
      } else {
        fetchTimeline();
      }
    } catch {
      fetchTimeline();
    } finally {
      setCompletingId(null);
      setNoteModalItem(null);
      setNoteText("");
      setSubmittingNote(false);
    }
  }

  async function handleNoteModalSubmit() {
    if (!noteModalItem) return;
    if (!noteText.trim()) return;
    setSubmittingNote(true);
    await executeCompleteTask(noteModalItem, noteText);
  }

  // Undo a completed task
  async function handleUndoTask(item: ScheduleItem) {
    if (!confirm(`آیا از لغو انجام و بازگردانی تسک «${item.title}» به لیست کارهای امروز اطمینان دارید؟`)) {
      return;
    }

    try {
      const res = await fetch("/api/nurse/tasks/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskLogId: item.taskLogId,
          scheduleId: item.scheduleId || item.id,
        }),
      });

      if (res.ok) {
        setSchedules((prev) =>
          prev.map((s) =>
            s.id === item.id
              ? {
                  ...s,
                  isCompleted: false,
                  completedAt: null,
                  completedBy: null,
                  notes: null,
                  taskLogId: null,
                }
              : s
          )
        );
        fetchTimeline();
      } else {
        alert("خطا در بازگردانی تسک");
      }
    } catch (err) {
      console.error("Undo task error:", err);
      alert("خطا در ارتباط با سرور");
    }
  }

  // Helper to determine if a completed task is a numeric vital, blood pressure, or non-numeric
  function getVitalKind(item: ScheduleItem | null): "blood_pressure" | "numeric_vital" | "none" {
    if (!item) return "none";
    const vt = item.vitalType;
    if (vt === "blood_pressure") return "blood_pressure";
    if (vt === "water_intake" || vt === "urine_output" || vt === "blood_sugar" || vt === "weight" || vt === "dvt_timer") {
      return "numeric_vital";
    }
    const t = item.title || "";
    if (t.includes("فشار خون")) return "blood_pressure";
    if (t.includes("آب") || t.includes("مایعات") || t.includes("ادرار") || t.includes("قند خون") || t.includes("وزن")) {
      return "numeric_vital";
    }
    return "none";
  }

  // Helper to strip automated prefixes from user notes
  function cleanUserNote(rawNote: string | null | undefined): string {
    if (!rawNote) return "";
    let cleaned = rawNote.trim();
    const prefixRegex = /^(?:مصرف مایعات|تخلیه ادرار|قند خون|فشار خون|مراقبت DVT|کارکرد روده|مصرف ملین)[^:]*:\s*[^-]+(?:-\s*)?/i;
    while (prefixRegex.test(cleaned)) {
      cleaned = cleaned.replace(prefixRegex, "").trim();
    }
    return cleaned;
  }

  // Open edit modal for completed task
  function handleOpenEditModal(item: ScheduleItem) {
    setEditModalItem(item);
    const cleanedNote = cleanUserNote(item.notes);
    setEditNoteText(cleanedNote);

    const kind = getVitalKind(item);

    if (kind === "blood_pressure") {
      setEditValueNum("");
      const bpMatch = (item.notes || "").match(/(\d+)\s*\/\s*(\d+)/);
      if (bpMatch) {
        setEditSys(bpMatch[1]);
        setEditDia(bpMatch[2]);
      } else {
        setEditSys("");
        setEditDia("");
      }
    } else if (kind === "numeric_vital") {
      setEditSys("");
      setEditDia("");
      const numMatch = (item.notes || "").match(/(?:^|:\s*)(\d+(?:\.\d+)?)/);
      setEditValueNum(numMatch ? numMatch[1] : "");
    } else {
      // Non-numeric task: routine tasks, medications, positioning, hygiene, etc.
      setEditValueNum("");
      setEditSys("");
      setEditDia("");
    }
  }

  // Save edited values/notes
  async function handleSaveEdit() {
    if (!editModalItem) return;
    setSavingEdit(true);

    const kind = getVitalKind(editModalItem);

    try {
      const res = await fetch("/api/nurse/tasks/edit-log", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskLogId: editModalItem.taskLogId,
          scheduleId: editModalItem.scheduleId || editModalItem.id,
          notes: editNoteText,
          valueNum: kind === "numeric_vital" && editValueNum ? Number(editValueNum) : undefined,
          systolic: kind === "blood_pressure" && editSys ? Number(editSys) : undefined,
          diastolic: kind === "blood_pressure" && editDia ? Number(editDia) : undefined,
        }),
      });

      if (res.ok) {
        setEditModalItem(null);
        fetchTimeline();
      } else {
        alert("خطا در ذخیره تغییرات");
      }
    } catch (err) {
      console.error("Save edit error:", err);
      alert("خطا در ارتباط با سرور");
    } finally {
      setSavingEdit(false);
    }
  }

  // Completed schedules sorted by most recent completed first
  const completedSchedules = schedules
    .filter((s) => s.isCompleted)
    .sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""));

  const lastDoneOverall = completedSchedules[0] || null;
  const lastDoneMed = completedSchedules.find((s) => s.category === "medication" || s.itemType === "medication") || null;
  const lastDoneVital = completedSchedules.find((s) => s.category === "vital" || s.vitalType) || null;

  // Filter items based on selected tab (Requirement 2)
  let displayItems: ScheduleItem[] = [];
  if (activeFilter === "done") {
    displayItems = completedSchedules;
  } else if (activeFilter === "medication") {
    const pendingMeds = schedules.filter((s) => !s.isCompleted && (s.category === "medication" || s.itemType === "medication"));
    displayItems = lastDoneMed ? [lastDoneMed, ...pendingMeds] : pendingMeds;
  } else if (activeFilter === "vital") {
    const pendingVitals = schedules.filter((s) => !s.isCompleted && (s.category === "vital" || s.vitalType));
    displayItems = lastDoneVital ? [lastDoneVital, ...pendingVitals] : pendingVitals;
  } else {
    // "all" tab: all pending tasks + ONLY the last completed task of shift
    const pendingAll = schedules.filter((s) => !s.isCompleted);
    displayItems = lastDoneOverall ? [lastDoneOverall, ...pendingAll] : pendingAll;
  }

  const completedCount = completedSchedules.length;
  const totalCount = schedules.length;
  const pendingCount = totalCount - completedCount;

  return (
    <div className="p-4 space-y-4 pb-28">
      {/* Shift Quick Status Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-slate-200/80 dark:border-slate-800 transition-colors">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-black text-slate-700 dark:text-slate-300">خلاصه شیفت امروز</span>
          <button
            onClick={fetchTimeline}
            className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 flex items-center gap-1 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>بروزرسانی</span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {/* Water Balance */}
          <div className="p-2.5 rounded-2xl bg-sky-50/70 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900/50 flex flex-col">
            <span className="text-[11px] font-bold text-sky-800 dark:text-sky-300 flex items-center gap-1">
              <Droplets className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              مایعات
            </span>
            <div className="mt-1 text-sm font-black text-slate-900 dark:text-slate-100">
              {toPersianDigits(stats.waterToday)} <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">ورودی</span>
            </div>
            <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
              {toPersianDigits(stats.urineToday)} <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">ادرار</span>
            </div>
          </div>

          {/* Last Sugar */}
          <div className="p-2.5 rounded-2xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/50 flex flex-col">
            <span className="text-[11px] font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1">
              <Heart className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              آخرین قند
            </span>
            <div className="mt-1 text-sm font-black text-slate-900 dark:text-slate-100">
              {stats.lastSugar ? (
                <>
                  {toPersianDigits(stats.lastSugar.valueNum)}{" "}
                  <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">mg/dL</span>
                </>
              ) : (
                "---"
              )}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              {stats.lastSugar?.mealTag ? "ناشتا/۲س" : "ثبت‌نشده"}
            </div>
          </div>

          {/* Shift Tasks Progress */}
          <div className="p-2.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/50 flex flex-col justify-between">
            <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              تسک‌های روتین
            </span>
            <div className="mt-1 text-sm font-black text-slate-900 dark:text-slate-100">
              {toPersianDigits(completedCount)} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">از {toPersianDigits(totalCount)}</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4 Dedicated Filter Tabs (Requirement 2) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: "all", label: "فعال", icon: ListFilter, count: pendingCount },
          { id: "medication", label: "دارو", icon: Pill, count: schedules.filter(s => !s.isCompleted && (s.category === "medication" || s.itemType === "medication")).length },
          { id: "vital", label: "سنجش", icon: HeartPulse, count: schedules.filter(s => !s.isCompleted && (s.category === "vital" || s.vitalType)).length },
          { id: "done", label: "انجام شد", icon: CheckCircle2, count: completedCount },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id as any)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-xs font-black whitespace-nowrap transition active:scale-95 ${
                isActive
                  ? "bg-slate-900 dark:bg-emerald-600 text-white shadow-md shadow-slate-900/20"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? "text-emerald-400 dark:text-white" : "text-slate-500 dark:text-slate-400"}`} />
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  isActive ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}>
                  {toPersianDigits(tab.count)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Ad-Hoc Actions Section (shown only in Done tab or if adhoc exists) */}
      {activeFilter === "done" && adhocTasks.length > 0 && (
        <div className="bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200/90 dark:border-indigo-900/50 rounded-3xl p-4 shadow-sm space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              اقدامات موردی و پیش‌بینی‌نشده امروز ({toPersianDigits(adhocTasks.length)})
            </span>
          </div>

          <div className="space-y-2">
            {adhocTasks.map((adhoc) => (
              <div
                key={adhoc.id}
                className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-indigo-100 dark:border-indigo-950 shadow-xs flex items-start justify-between gap-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-xs text-slate-900 dark:text-slate-100">{adhoc.title}</span>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
                      {adhoc.completedBy}
                    </span>
                  </div>
                  {adhoc.notes && (
                    <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/70 p-2 rounded-xl border border-slate-200/60 dark:border-slate-700/60 leading-relaxed">
                      {adhoc.notes}
                    </p>
                  )}
                </div>
                <div className="px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-mono text-[11px] font-black flex-shrink-0">
                  {formatJalaliTime(adhoc.completedAt)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chronological Timeline List */}
      <div className="space-y-3">
        {/* Active DVT In-Progress Card (Bedside action started or ad-hoc) */}
        {activeTimer &&
          !schedules.some(
            (s) =>
              !s.isCompleted &&
              (s.id === activeTimer.scheduleId ||
                s.vitalType === "dvt_care" ||
                s.category === "dvt_care")
          ) &&
          activeFilter !== "done" && (
            <div className="p-4 rounded-3xl border-2 border-teal-500/80 dark:border-teal-600 bg-teal-50/90 dark:bg-teal-950/60 shadow-md flex items-center justify-between gap-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="px-3.5 py-2.5 rounded-2xl bg-teal-600 text-white font-mono text-sm font-black flex items-center justify-center gap-1.5 flex-shrink-0 shadow-sm animate-pulse">
                  <Timer className="w-4 h-4 animate-spin" />
                  <span>{formatStopwatch(dvtElapsedSeconds)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">
                      {activeTimer.taskTitle || "مراقبت DVT پای راست"}
                    </h2>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-200 dark:bg-teal-900 text-teal-900 dark:text-teal-200 border border-teal-300 dark:border-teal-700">
                      در حال انجام (پای راست بالا برده شده)
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-teal-800 dark:text-teal-300 font-semibold truncate">
                    زمان سپری‌شده: {formatStopwatch(dvtElapsedSeconds)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleCancelDvtTimer}
                  className="px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleStopDvtTimer}
                  className="px-3.5 py-2 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black shadow-md shadow-teal-600/30 flex items-center gap-1.5 transition active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>پایان و ثبت DVT</span>
                </button>
              </div>
            </div>
          )}

        {displayItems.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 text-center border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
            <Clock className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="font-bold text-sm">
              {activeFilter === "done" ? "هنوز تسکی در این شیفت انجام نشده است" : "تمام تسک‌های این بخش انجام شده‌اند"}
            </p>
          </div>
        ) : (
          displayItems.map((item) => {
            const isCompleted = item.isCompleted;
            const isLastDone = item.id === lastDoneOverall?.id;
            const isMed = item.category === "medication" || item.itemType === "medication";
            const isMeal = item.category === "meal";
            const isDvt = item.vitalType === "dvt_care" || item.category === "dvt_care";
            const isThisDvtRunning = Boolean(
              activeTimer &&
                (activeTimer.scheduleId === item.id || (!activeTimer.scheduleId && isDvt))
            );
            const vitalMeta = item.vitalType ? VITAL_META[item.vitalType] : null;
            const VitalIcon = vitalMeta?.icon;

            // Calculate overdue (> 30 minutes past target time in Tehran timezone)
            let isOverdue = false;
            if (!isCompleted) {
              try {
                const [tH, tM] = item.targetTime.split(":").map(Number);
                const targetMin = (tH || 0) * 60 + (tM || 0);
                const d = new Date();
                const parts = new Intl.DateTimeFormat("en-US", {
                  timeZone: "Asia/Tehran",
                  hour: "numeric",
                  minute: "numeric",
                  hour12: false,
                }).formatToParts(d);
                const nowH = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
                const nowM = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
                const nowMin = nowH * 60 + nowM;
                isOverdue = nowMin - targetMin > 30;
              } catch {}
            }

            // Calculate right accent strip color
            let stripColor = "border-r-slate-400 dark:border-r-slate-600";
            if (isCompleted) {
              stripColor = "border-r-slate-400 dark:border-r-slate-600";
            } else if (isThisDvtRunning) {
              stripColor = "border-r-teal-500";
            } else if (isOverdue) {
              stripColor = "border-r-amber-500";
            } else if (item.vitalType) {
              switch (item.vitalType) {
                case "blood_sugar":
                  stripColor = "border-r-rose-500";
                  break;
                case "blood_pressure":
                  stripColor = "border-r-purple-500";
                  break;
                case "urine_output":
                  stripColor = "border-r-amber-500";
                  break;
                case "water_intake":
                  stripColor = "border-r-sky-500";
                  break;
                case "dvt_care":
                  stripColor = "border-r-teal-500";
                  break;
                case "bowel_movement":
                  stripColor = "border-r-orange-500";
                  break;
                case "laxative":
                  stripColor = "border-r-purple-500";
                  break;
                case "clinical_photo":
                  stripColor = "border-r-emerald-500";
                  break;
                default:
                  stripColor = "border-r-emerald-500";
              }
            } else if (isMed) {
              stripColor = "border-r-care-500 dark:border-r-care-400";
            } else if (isMeal) {
              stripColor = "border-r-amber-500 dark:border-r-amber-400";
            }

            return (
              <div
                key={item.id}
                className={`p-3.5 sm:p-4 rounded-3xl border border-r-[5px] transition-all duration-200 ${
                  isCompleted
                    ? "bg-slate-100/90 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 border-r-slate-500 text-slate-800 dark:text-slate-200 shadow-xs"
                    : isThisDvtRunning
                    ? `bg-teal-50/80 dark:bg-teal-950/40 border-teal-400 dark:border-teal-700 ${stripColor} shadow-md`
                    : isOverdue
                    ? `bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800/80 ${stripColor} shadow-sm`
                    : `bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/90 dark:border-emerald-800/60 ${stripColor} shadow-sm hover:shadow-md`
                }`}
              >
                {/* Last Done Task Indicator Banner */}
                {isCompleted && isLastDone && activeFilter !== "done" && (
                  <div className="mb-2 flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      آخرین تسک انجام‌شده شیفت (قابلیت بازگردانی یا ویرایش)
                    </span>
                  </div>
                )}

                {isCompleted ? (
                  /* Completed Task Card (Page 17 specification) */
                  <div className="space-y-1.5">
                    {/* Header: ساعت انجام | نام پرستار | ساعت مقرر */}
                    <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 dark:border-slate-700/60 pb-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 flex-wrap">
                        <span className="font-mono text-emerald-800 dark:text-emerald-300 font-black">
                          {item.completedAt ? formatJalaliTime(item.completedAt) : "انجام شد"}
                        </span>
                        <span>•</span>
                        <span>{item.completedBy || "پرستار"}</span>
                        <span>•</span>
                        <span className="text-slate-500 dark:text-slate-400">
                          مقرر: {toPersianDigits(item.targetTime)}
                        </span>
                      </div>

                      {/* Undo and Edit buttons */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleUndoTask(item)}
                          className="px-2.5 py-1 rounded-xl bg-white hover:bg-rose-50 dark:bg-slate-900 dark:hover:bg-rose-950/50 text-slate-600 hover:text-rose-600 dark:text-slate-300 dark:hover:text-rose-300 border border-slate-300 dark:border-slate-700 transition active:scale-95 flex items-center gap-1 text-[11px] font-bold"
                          title="لغو انجام و بازگردانی به لیست کارهای امروز"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>لغو</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(item)}
                          className="px-2.5 py-1 rounded-xl bg-white hover:bg-amber-50 dark:bg-slate-900 dark:hover:bg-amber-950/50 text-slate-600 hover:text-amber-600 dark:text-slate-300 dark:hover:text-amber-300 border border-slate-300 dark:border-slate-700 transition active:scale-95 flex items-center gap-1 text-[11px] font-bold"
                          title="ویرایش عدد یا گزارش ثبت‌شده"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>ویرایش</span>
                        </button>
                      </div>
                    </div>

                    {/* Title */}
                    <div className="font-black text-sm text-slate-900 dark:text-slate-100">
                      {item.title}
                    </div>

                    {/* Conditional: ثبت مقدار یا یادداشت پرستار */}
                    {item.notes && (
                      <div className="text-xs text-slate-700 dark:text-slate-300 bg-white/70 dark:bg-slate-900/60 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                        <span className="font-bold text-slate-900 dark:text-slate-100">ثبت: </span>
                        <span>{item.notes}</span>
                      </div>
                    )}

                    {/* Conditional: دستور فعالیت */}
                    {item.medication?.instructions && (
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-bold">دستور: </span>
                        <span>{item.medication.instructions}</span>
                      </div>
                    )}
                  </div>
                ) : isThisDvtRunning ? (
                  /* Active DVT In-Progress Card */
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="px-3.5 py-2.5 rounded-2xl bg-teal-600 text-white font-mono text-sm font-black flex items-center justify-center gap-1.5 flex-shrink-0 shadow-sm animate-pulse">
                        <Timer className="w-4 h-4 animate-spin" />
                        <span>{formatStopwatch(dvtElapsedSeconds)}</span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 leading-snug">
                            {item.title}
                          </h2>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 dark:bg-teal-950 text-teal-900 dark:text-teal-200 border border-teal-300 dark:border-teal-700">
                            در حال انجام (پای راست بالا برده شده)
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-teal-800 dark:text-teal-300 font-semibold truncate">
                          زمان سپری‌شده: {formatStopwatch(dvtElapsedSeconds)}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleStopDvtTimer}
                      className="px-3.5 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black shadow-md shadow-teal-600/30 flex items-center gap-1.5 transition active:scale-95 flex-shrink-0"
                      title="پایین آوردن پا و ثبت انجام DVT"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>پایان و ثبت DVT</span>
                    </button>
                  </div>
                ) : isDvt ? (
                  /* Pending DVT Card with Direct Start Button */
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleStartDvtTimer(item.id, item.title)}
                        className="px-3.5 py-2.5 rounded-2xl font-mono text-sm font-black flex items-center justify-center flex-shrink-0 shadow-sm bg-teal-600 hover:bg-teal-700 text-white transition active:scale-90"
                        title="شروع تایمر بالا بردن پا"
                      >
                        {toPersianDigits(item.targetTime)}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 leading-snug">
                            {item.title}
                          </h2>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-100 dark:bg-teal-950 text-teal-900 dark:text-teal-200 border border-teal-300">
                            مراقبت DVT
                          </span>
                          {isOverdue && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border border-amber-300">
                              موعد گذشته
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          لمس برای شروع تایمر بالا بردن پای راست
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleStartDvtTimer(item.id, item.title)}
                      className="px-3 py-2 rounded-2xl bg-teal-50 dark:bg-teal-950/70 text-teal-700 dark:text-teal-300 hover:bg-teal-600 hover:text-white border border-teal-200 dark:border-teal-800 text-xs font-bold transition flex items-center gap-1.5 flex-shrink-0"
                      title="شروع تایمر DVT"
                    >
                      <Timer className="w-4 h-4" />
                      <span>شروع تایمر</span>
                    </button>
                  </div>
                ) : (
                  /* Active Task Card: 2 Lines (Page 18 specification) */
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Big Time Badge acting as tap button to complete */}
                      <button
                        type="button"
                        onClick={() => handleTaskClick(item)}
                        disabled={completingId === item.id}
                        className={`px-3.5 py-2.5 rounded-2xl font-mono text-sm font-black flex items-center justify-center flex-shrink-0 shadow-sm transition active:scale-90 ${
                          isOverdue
                            ? "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/30"
                            : "bg-slate-900 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white shadow-slate-900/20"
                        }`}
                        title="لمس برای ثبت و تایید انجام"
                      >
                        {toPersianDigits(item.targetTime)}
                      </button>

                      <div className="min-w-0 flex-1">
                        {/* Line 1: [کد دارو] نام دارو یا عنوان فعالیت */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {item.medication?.boxNumber && (
                            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/70 px-1.5 py-0.5 rounded-md ml-1.5">
                              کد {toPersianDigits(item.medication.boxNumber)}
                            </span>
                          )}
                          <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 leading-snug">
                            {item.title}
                          </h2>

                          {isOverdue && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border border-amber-300">
                              موعد گذشته
                            </span>
                          )}
                        </div>

                        {/* Line 2: دستور انجام فعالیت */}
                        {(item.medication?.instructions || item.medication?.timeConstraints || (item.requiresNote && !item.isCompleted)) && (
                          <div className="mt-1 text-xs text-slate-600 dark:text-slate-400 truncate">
                            {item.medication?.timeConstraints ? (
                              <span className="text-rose-700 dark:text-rose-400 font-bold">
                                ⚠️ {item.medication.timeConstraints}
                              </span>
                            ) : item.medication?.instructions ? (
                              <span>{item.medication.instructions}</span>
                            ) : item.requiresNote ? (
                              <span className="text-indigo-700 dark:text-indigo-400 font-medium">📝 نیاز به ثبت گزارش</span>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick tap icon indicator on right */}
                    <button
                      type="button"
                      onClick={() => handleTaskClick(item)}
                      disabled={completingId === item.id}
                      className="p-2 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition active:scale-90"
                      title="ثبت انجام"
                    >
                      <Check className="w-5 h-5 stroke-[2.5]" />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Edit Done Task Modal (Requirement 2) */}
      {editModalItem && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900 dark:text-slate-100">ویرایش ثبت بالینی / گزارش</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">اصلاح مقدار عددی یا توضیحات ثبت‌شده</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditModalItem(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Task Info Banner */}
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3 border border-slate-200/80 dark:border-slate-700 mb-4 flex items-center justify-between">
              <div className="font-black text-xs text-slate-800 dark:text-slate-200 truncate">
                {editModalItem.title}
              </div>
              <div className="text-[11px] font-mono font-black text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                ساعت {toPersianDigits(editModalItem.targetTime)}
              </div>
            </div>

            {/* If Blood Pressure: Systolic & Diastolic */}
            {getVitalKind(editModalItem) === "blood_pressure" ? (
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">سیستول (بالا):</label>
                  <input
                    type="number"
                    value={editSys}
                    onChange={(e) => setEditSys(e.target.value)}
                    placeholder="مثلاً ۱۲۰"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-center font-black text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">دیاستول (پایین):</label>
                  <input
                    type="number"
                    value={editDia}
                    onChange={(e) => setEditDia(e.target.value)}
                    placeholder="مثلاً ۸۰"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-center font-black text-sm"
                  />
                </div>
              </div>
            ) : getVitalKind(editModalItem) === "numeric_vital" ? (
              /* If other numeric vital (water, urine, sugar, dvt, weight) */
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  مقدار عددی ثبت‌شده (
                  {editModalItem.vitalType === "water_intake" || editModalItem.title?.includes("آب") || editModalItem.title?.includes("مایعات")
                    ? "سی‌سی cc"
                    : editModalItem.vitalType === "urine_output" || editModalItem.title?.includes("ادرار")
                    ? "سی‌سی cc"
                    : editModalItem.vitalType === "blood_sugar" || editModalItem.title?.includes("قند")
                    ? "mg/dL"
                    : editModalItem.vitalType === "dvt_timer" || editModalItem.title?.includes("DVT") || editModalItem.title?.includes("بالا بردن پا")
                    ? "ثانیه"
                    : editModalItem.vitalType === "weight" || editModalItem.title?.includes("وزن")
                    ? "کیلوگرم kg"
                    : "واحد"}
                  ):
                </label>
                <input
                  type="number"
                  value={editValueNum}
                  onChange={(e) => setEditValueNum(e.target.value)}
                  placeholder="مثلاً ۲۵۰"
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-black text-base text-center"
                />
              </div>
            ) : null}

            {/* Note text field */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                توضیحات و گزارش:
              </label>
              <textarea
                rows={3}
                value={editNoteText}
                onChange={(e) => setEditNoteText(e.target.value)}
                placeholder="توضیحات تکمیلی یا اصلاحی..."
                className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-medium focus:ring-2 focus:ring-amber-500 outline-none leading-relaxed transition"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={savingEdit}
                onClick={handleSaveEdit}
                className="flex-1 py-3.5 rounded-2xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-black text-xs shadow-lg shadow-amber-600/20 active:scale-95 transition flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>{savingEdit ? "در حال ذخیره..." : "ذخیره تغییرات"}</span>
              </button>
              <button
                type="button"
                onClick={() => setEditModalItem(null)}
                className="py-3.5 px-4 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black text-xs active:scale-95 transition"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Note Requirement Modal */}
      {noteModalItem && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900 dark:text-slate-100">ثبت گزارش انجام تسک</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">این اقدام نیاز به ثبت توضیحات توسط پرستار دارد</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNoteModalItem(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3 border border-slate-200/80 dark:border-slate-700 mb-4 flex items-center justify-between">
              <div className="font-black text-xs text-slate-800 dark:text-slate-200 truncate">
                {noteModalItem.title}
              </div>
              <div className="text-[11px] font-mono font-black text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                ساعت {toPersianDigits(noteModalItem.targetTime)}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                توضیحات و گزارش انجام کار:
              </label>
              <textarea
                rows={4}
                autoFocus
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="توضیحات مربوط به انجام این اقدام، مقدار مصرف، وضعیت یا واکنش بیمار را بنویسید..."
                className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none leading-relaxed transition"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={submittingNote || !noteText.trim()}
                onClick={handleNoteModalSubmit}
                className="flex-1 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs shadow-lg shadow-emerald-600/20 active:scale-95 transition flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>{submittingNote ? "در حال ثبت..." : "ثبت و انجام شد"}</span>
              </button>
              <button
                type="button"
                onClick={() => setNoteModalItem(null)}
                className="py-3.5 px-4 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-black text-xs active:scale-95 transition"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button with Zero-Typing Modals */}
      <QuickActionFAB
        onDataLogged={fetchTimeline}
        activeAction={activeAction}
        onCloseAction={() => setActiveAction(null)}
      />
    </div>
  );
}
