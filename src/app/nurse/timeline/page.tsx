"use client";

import { useEffect, useState, useCallback } from "react";
import {
  CheckCircle2, Clock, Pill, Utensils, Shield, Check,
  AlertCircle, Droplets, Activity, Heart, RefreshCw, ChevronDown, ListFilter
} from "lucide-react";
import { toPersianDigits, formatJalaliTime } from "@/lib/jalali";
import QuickActionFAB from "@/components/nurse/QuickActionFAB";

interface ScheduleItem {
  id: string;
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
  isCompleted: boolean;
  completedAt?: string | null;
  completedBy?: string | null;
  status: string;
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

export default function NurseTimelinePage() {
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [stats, setStats] = useState<ShiftStats>({ waterToday: 0, urineToday: 0 });
  const [activeFilter, setActiveFilter] = useState<"all" | "medication" | "meal" | "dvt_care">("all");
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const fetchTimeline = useCallback(async () => {
    try {
      const res = await fetch("/api/nurse/timeline");
      if (res.ok) {
        const data = await res.json();
        setSchedules(data.schedules || []);
        if (data.stats) setStats(data.stats);
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

  // 1-Tap complete task
  async function handleCompleteTask(item: ScheduleItem) {
    if (item.isCompleted || completingId) return;
    setCompletingId(item.id);

    // Optimistic UI update
    setSchedules((prev) =>
      prev.map((s) =>
        s.id === item.id
          ? {
              ...s,
              isCompleted: true,
              completedAt: new Date().toISOString(),
              completedBy: "پرستار",
              status: "DONE",
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
        }),
      });

      if (!res.ok) {
        // revert if failed
        fetchTimeline();
      }
    } catch {
      fetchTimeline();
    } finally {
      setCompletingId(null);
    }
  }

  // Filter items
  const filteredItems = schedules.filter((item) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "medication") return item.category === "medication" || item.itemType === "medication";
    if (activeFilter === "meal") return item.category === "meal";
    if (activeFilter === "dvt_care") return item.category === "dvt_care" || item.category === "routine";
    return true;
  });

  const completedCount = schedules.filter((s) => s.isCompleted).length;
  const totalCount = schedules.length;

  return (
    <div className="p-4 space-y-4">
      {/* Shift Quick Status Bar */}
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/80">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-black text-slate-700">خلاصه شیفت امروز</span>
          <button
            onClick={fetchTimeline}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>بروزرسانی</span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {/* Water Balance */}
          <div className="p-2.5 rounded-2xl bg-sky-50/70 border border-sky-100 flex flex-col">
            <span className="text-[11px] font-bold text-sky-800 flex items-center gap-1">
              <Droplets className="w-3.5 h-3.5 text-sky-600" />
              مایعات
            </span>
            <div className="mt-1 text-sm font-black text-slate-900">
              {toPersianDigits(stats.waterToday)} <span className="text-[10px] font-normal">ورودی</span>
            </div>
            <div className="text-[11px] font-semibold text-amber-700">
              {toPersianDigits(stats.urineToday)} <span className="text-[10px] font-normal">ادرار</span>
            </div>
          </div>

          {/* Last Sugar */}
          <div className="p-2.5 rounded-2xl bg-rose-50/70 border border-rose-100 flex flex-col">
            <span className="text-[11px] font-bold text-rose-800 flex items-center gap-1">
              <Heart className="w-3.5 h-3.5 text-rose-600" />
              آخرین قند
            </span>
            <div className="mt-1 text-sm font-black text-slate-900">
              {stats.lastSugar ? (
                <>
                  {toPersianDigits(stats.lastSugar.valueNum)}{" "}
                  <span className="text-[10px] font-normal text-slate-500">mg/dL</span>
                </>
              ) : (
                "---"
              )}
            </div>
            <div className="text-[10px] text-slate-500 truncate">
              {stats.lastSugar?.mealTag ? "ناشتا/۲س" : "هنوز ثبت نشده"}
            </div>
          </div>

          {/* Routine Progress */}
          <div className="p-2.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 flex flex-col">
            <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              تسک‌های روتین
            </span>
            <div className="mt-1 text-sm font-black text-slate-900">
              {toPersianDigits(completedCount)} از {toPersianDigits(totalCount)}
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
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

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: "all", label: "همه تسک‌ها", icon: ListFilter },
          { id: "medication", label: "داروها", icon: Pill },
          { id: "meal", label: "غذا و میان‌وعده", icon: Utensils },
          { id: "dvt_care", label: "مراقبت و DVT", icon: Shield },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id as any)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-xs font-black whitespace-nowrap transition active:scale-95 ${
                isActive
                  ? "bg-slate-900 text-white shadow-md shadow-slate-900/20"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? "text-emerald-400" : "text-slate-500"}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Chronological Timeline List */}
      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-slate-200 text-slate-500">
            <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="font-bold text-sm">تسکی در این دسته‌بندی یافت نشد</p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isCompleted = item.isCompleted;
            const isMed = item.category === "medication" || item.itemType === "medication";
            const isMeal = item.category === "meal";
            const isDvt = item.category === "dvt_care";

            return (
              <div
                key={item.id}
                className={`p-4 rounded-3xl border-2 transition-all duration-200 ${
                  isCompleted
                    ? "bg-emerald-50/70 border-emerald-200/80 opacity-90"
                    : "bg-white border-slate-200/80 shadow-sm hover:border-slate-300"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Left: Time and Badges */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Time Badge */}
                    <div
                      className={`px-2.5 py-1.5 rounded-2xl font-mono text-xs font-black flex items-center justify-center flex-shrink-0 ${
                        isCompleted
                          ? "bg-emerald-200 text-emerald-900"
                          : "bg-slate-100 text-slate-900"
                      }`}
                    >
                      {toPersianDigits(item.targetTime)}
                    </div>

                    <div className="min-w-0 flex-1">
                      {/* Title */}
                      <h2
                        className={`text-sm font-black leading-snug ${
                          isCompleted ? "text-emerald-950 line-through decoration-emerald-600/40" : "text-slate-900"
                        }`}
                      >
                        {item.title}
                      </h2>

                      {/* Medication / Task Metadata */}
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {item.medication?.boxNumber && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 font-bold text-[11px] border border-amber-200">
                            جعبه {toPersianDigits(item.medication.boxNumber)}
                          </span>
                        )}

                        {item.medication?.timeConstraints && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-rose-50 text-rose-800 font-bold text-[10px] border border-rose-200">
                            ⚠️ {item.medication.timeConstraints}
                          </span>
                        )}

                        {item.medication?.instructions && !item.medication?.timeConstraints && (
                          <span className="text-[11px] text-slate-500 line-clamp-1">
                            {item.medication.instructions}
                          </span>
                        )}
                      </div>

                      {/* Completed note */}
                      {isCompleted && (
                        <div className="mt-2 text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>
                            انجام شد {item.completedAt ? `(ساعت ${formatJalaliTime(item.completedAt)})` : ""}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Big 1-Tap Done Button */}
                  <div className="flex-shrink-0">
                    {isCompleted ? (
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
                        <Check className="w-6 h-6 stroke-[3]" />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleCompleteTask(item)}
                        disabled={completingId === item.id}
                        className="px-4 py-3 rounded-2xl bg-care-600 hover:bg-care-700 active:scale-95 text-white font-black text-xs shadow-lg shadow-care-600/30 flex items-center gap-1.5 transition"
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>انجام شد</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Action Button with Zero-Typing Modals */}
      <QuickActionFAB onDataLogged={fetchTimeline} />
    </div>
  );
}
