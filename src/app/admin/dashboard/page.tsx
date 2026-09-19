"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, ReferenceArea, ReferenceLine, Legend
} from "recharts";
import {
  AlertTriangle, Droplets, Activity, Heart, Clock,
  Calendar, CheckCircle, ShieldAlert, Sparkles, RefreshCw, Eye, Image as ImageIcon
} from "lucide-react";
import { toPersianDigits, formatJalaliDateTime } from "@/lib/jalali";

interface AnalyticsData {
  range: string;
  kpi: {
    hoursSinceLastBowel: number;
    lastBowelDate?: string;
    lastBowelGrade?: string;
    bowelAlert: boolean;
    todayIntake: number;
    todayOutput: number;
    retentionRisk: boolean;
    glucoseAvg: number;
    glucoseSpikesCount: number;
    glucoseHypoCount: number;
    totalDvtMinutes: number;
  };
  fluidBalanceChart: Array<{
    date: string;
    jalaliDate: string;
    intake: number;
    output: number;
  }>;
  glucoseChart: Array<{
    id: string;
    date: string;
    jalaliTime: string;
    value: number;
    mealTag: string;
    isSpike: boolean;
    isHypo: boolean;
  }>;
  dvtChart: Array<{
    jalaliDate: string;
    totalMinutes: number;
  }>;
  dvtMeasurements: Array<{
    date: string;
    jalaliDate: string;
    value: number;
    desc: string;
  }>;
  bowelTimeline: Array<{
    id: string;
    type: string;
    date: string;
    jalaliDateTime: string;
    text: string;
    grade?: string;
    laxative?: string;
  }>;
  clinicalPhotos: Array<{
    id: string;
    category: string;
    noteText: string;
    photoUrl: string;
    createdAt: string;
  }>;
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [range, setRange] = useState<"today" | "7d" | "30d" | "all">("7d");
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics?range=${range}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return (
    <div className="space-y-6">
      {/* Top Header & Range Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900">
            داشبورد تحلیلی و پایش بالینی
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-slate-500 mt-1">
            وضعیت بیمار: آقای جواد یزدانی • سابقه DVT و دیابت
          </p>
        </div>

        {/* Timeframe Chips */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl">
          {[
            { id: "today", label: "امروز" },
            { id: "7d", label: "۷ روز گذشته" },
            { id: "30d", label: "۳۰ روز اخیر" },
            { id: "all", label: "کل سوابق" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setRange(t.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                range === t.id
                  ? "bg-white text-slate-900 shadow-sm font-black"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {t.label}
            </button>
          ))}
          <button
            onClick={fetchAnalytics}
            className="p-1.5 rounded-xl text-slate-600 hover:text-slate-900 transition"
            title="بروزرسانی"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Critical Alert Banners (if any) */}
      {data?.kpi?.bowelAlert && (
        <div className="p-4 sm:p-5 rounded-3xl bg-rose-50 border-2 border-rose-300 text-rose-950 flex items-start gap-3 shadow-md shadow-rose-100">
          <ShieldAlert className="w-7 h-7 text-rose-600 flex-shrink-0 mt-0.5 animate-pulse" />
          <div className="flex-1">
            <h2 className="font-black text-sm sm:text-base text-rose-900">
              هشدار بالینی: تأخیر کارکرد روده (بیش از ۳۶ ساعت)!
            </h2>
            <p className="text-xs text-rose-800 mt-1 leading-relaxed">
              از آخرین کارکرد روده بیمار بیش از {toPersianDigits(data.kpi.hoursSinceLastBowel)} ساعت گذشته است.
              بررسی نیاز به ملین (پیدرولاکس، شیاف بیزاکودیل یا شربت منیزیم) و مصرف مایعات توصیه می‌شود.
            </p>
          </div>
        </div>
      )}

      {data?.kpi?.retentionRisk && (
        <div className="p-4 sm:p-5 rounded-3xl bg-amber-50 border-2 border-amber-300 text-amber-950 flex items-start gap-3 shadow-md shadow-amber-100">
          <AlertTriangle className="w-7 h-7 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h2 className="font-black text-sm sm:text-base text-amber-900">
              هشدار احتباس مایعات (خطر کاهش برون‌ده ادرار)
            </h2>
            <p className="text-xs text-amber-800 mt-1 leading-relaxed">
              تخلیه ادرار ({toPersianDigits(data.kpi.todayOutput)} cc) نسبت به آب مصرفی ({toPersianDigits(data.kpi.todayIntake)} cc) به طور چشمگیری کمتر است.
              احتمال احتباس آب، ورم و تشدید DVT پای راست نیازمند پایش است.
            </p>
          </div>
        </div>
      )}

      {/* Real-time KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Bowel Movement Status */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500">فاصله از آخرین دفع مثبت</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className={`text-3xl font-black font-mono ${data?.kpi?.bowelAlert ? "text-rose-600" : "text-emerald-700"}`}>
                {data ? toPersianDigits(data.kpi.hoursSinceLastBowel) : "..."}
              </span>
              <span className="text-xs font-bold text-slate-600">ساعت پیش</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">وضعیت دفع:</span>
            <span className={`font-bold ${data?.kpi?.bowelAlert ? "text-rose-700" : "text-emerald-700"}`}>
              {data?.kpi?.bowelAlert ? "⚠️ هشدار یبوست" : "✓ وضعیت طبیعی"}
            </span>
          </div>
        </div>

        {/* KPI 2: Fluid Balance */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500">بالانس مایعات (ورودی / ادرار)</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-sky-700 font-mono">
                {data ? toPersianDigits(data.kpi.todayIntake) : "..."}
              </span>
              <span className="text-xs text-slate-400">/</span>
              <span className="text-2xl font-black text-amber-700 font-mono">
                {data ? toPersianDigits(data.kpi.todayOutput) : "..."}
              </span>
              <span className="text-xs font-bold text-slate-500">cc</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">اختلاف روز:</span>
            <span className="font-bold text-slate-800">
              {data ? toPersianDigits(data.kpi.todayIntake - data.kpi.todayOutput) : "..."} cc
            </span>
          </div>
        </div>

        {/* KPI 3: Blood Glucose Trends */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500">میانگین قند خون</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 font-mono">
                {data ? toPersianDigits(data.kpi.glucoseAvg) : "..."}
              </span>
              <span className="text-xs font-bold text-slate-500">mg/dL</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">اسپایک بالای ۱۸۰:</span>
            <span className="font-bold text-rose-600">
              {data ? toPersianDigits(data.kpi.glucoseSpikesCount) : "۰"} مورد
            </span>
          </div>
        </div>

        {/* KPI 4: DVT Leg Elevation */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500">مجموع بالا بردن پای راست (DVT)</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-black text-teal-700 font-mono">
                {data ? toPersianDigits(Math.round(data.kpi.totalDvtMinutes / 60)) : "..."}
              </span>
              <span className="text-xs font-bold text-slate-600">ساعت در این دوره</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">هدف توصیه شده:</span>
            <span className="font-bold text-teal-800">حداقل ۲ ساعت در روز</span>
          </div>
        </div>
      </div>

      {/* Chart 1: Fluid Balance (Intake vs Urine) */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-slate-100 gap-2">
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Droplets className="w-5 h-5 text-sky-600" />
              <span>نمودار بالانس مایعات روزانه (آب مصرفی در برابر تخلیه ادرار)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">مقادیر بر حسب سی‌سی (ml / cc)</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-bold">
            <span className="flex items-center gap-1.5 text-sky-700">
              <span className="w-3 h-3 rounded-md bg-sky-500 inline-block" />
              آب مصرفی
            </span>
            <span className="flex items-center gap-1.5 text-amber-700">
              <span className="w-3 h-3 rounded-md bg-amber-500 inline-block" />
              تخلیه ادرار
            </span>
          </div>
        </div>

        <div className="h-72 w-full" dir="ltr">
          {isMounted && data?.fluidBalanceChart && data.fluidBalanceChart.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.fluidBalanceChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="jalaliDate" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip
                  formatter={(value: any, name: any) => [
                    `${toPersianDigits(value)} cc`,
                    name === "intake" ? "آب مصرفی" : "تخلیه ادرار",
                  ]}
                  contentStyle={{ backgroundColor: "#1e293b", borderRadius: "1rem", color: "#fff", border: "none" }}
                />
                <Bar dataKey="intake" fill="#0284c7" radius={[6, 6, 0, 0]} name="intake" />
                <Bar dataKey="output" fill="#f59e0b" radius={[6, 6, 0, 0]} name="output" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
              در حال بارگذاری داده‌های بالانس مایعات...
            </div>
          )}
        </div>
      </div>

      {/* Chart 2: Blood Glucose Multi-Line Trend Chart */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-slate-100 gap-2">
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Heart className="w-5 h-5 text-rose-600" />
              <span>روند نوسانات قند خون و محدوده هدف ایمن (۸۰ تا ۱۴۰)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">پایش قند ناشتا، ۲ ساعته صبحانه، ناهار و شام</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
            <span className="flex items-center gap-1 text-emerald-700">
              <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-400 inline-block" />
              محدوده ایمن (۸۰-۱۴۰)
            </span>
            <span className="flex items-center gap-1 text-rose-700">
              <span className="w-3 h-1 bg-rose-500 inline-block" />
              هشدار بالا (&gt;۱۸۰)
            </span>
            <span className="flex items-center gap-1 text-purple-700">
              <span className="w-3 h-1 bg-purple-500 inline-block" />
              افت شدید (&lt;۷۰)
            </span>
          </div>
        </div>

        <div className="h-80 w-full" dir="ltr">
          {isMounted && data?.glucoseChart && data.glucoseChart.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.glucoseChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="jalaliTime" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} domain={[50, 260]} tickLine={false} />
                <ReferenceArea y1={80} y2={140} fill="#22c55e" fillOpacity={0.12} />
                <ReferenceLine y={180} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "اسپایک 180", fill: "#ef4444", fontSize: 10 }} />
                <ReferenceLine y={70} stroke="#a855f7" strokeDasharray="4 4" label={{ value: "افت 70", fill: "#a855f7", fontSize: 10 }} />
                <Tooltip
                  formatter={(value: any) => [`${toPersianDigits(value)} mg/dL`, "قند خون"]}
                  contentStyle={{ backgroundColor: "#0f172a", borderRadius: "1rem", color: "#fff", border: "none" }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#e11d48"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#e11d48" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
              در حال بارگذاری داده‌های قند خون...
            </div>
          )}
        </div>
      </div>

      {/* Grid: Bowel & Laxatives Timeline + DVT Elevation Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bowel & Laxative Monitoring */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col">
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <Activity className="w-5 h-5 text-orange-500" />
            <span>پایش کارکرد روده و ملین‌های مصرف‌شده</span>
          </h2>

          <div className="space-y-2.5 overflow-y-auto max-h-80 pr-1">
            {data?.bowelTimeline && data.bowelTimeline.length > 0 ? (
              data.bowelTimeline.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 rounded-2xl border text-xs flex items-start justify-between gap-3 ${
                    item.type === "laxative"
                      ? "bg-amber-50/60 border-amber-200"
                      : "bg-emerald-50/60 border-emerald-200"
                  }`}
                >
                  <div>
                    <div className="font-black text-slate-900">{item.text}</div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {item.jalaliDateTime}
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-xl text-[10px] font-black flex-shrink-0 ${
                      item.type === "laxative"
                        ? "bg-amber-200 text-amber-900"
                        : "bg-emerald-200 text-emerald-900"
                    }`}
                  >
                    {item.type === "laxative" ? "ملین مصرفی" : "کارکرد شکم"}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 text-center py-8">سابقه‌ای ثبت نشده است</p>
            )}
          </div>
        </div>

        {/* DVT Leg Elevation Minutes per Day */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col">
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <Clock className="w-5 h-5 text-teal-600" />
            <span>پایش ساعات بالا بردن پای راست (DVT)</span>
          </h2>

          <div className="h-64 w-full" dir="ltr">
            {isMounted && data?.dvtChart && data.dvtChart.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.dvtChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="jalaliDate" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip
                    formatter={(value: any) => [`${toPersianDigits(value)} دقیقه`, "مدت بالا بودن پا"]}
                    contentStyle={{ backgroundColor: "#1e293b", borderRadius: "1rem", color: "#fff", border: "none" }}
                  />
                  <Bar dataKey="totalMinutes" fill="#0d9488" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                در حال بارگذاری داده‌های DVT...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Comparative Clinical Photo Gallery (for DVT / skin / wounds) */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-emerald-600" />
            <span>گالری مقایسه‌ای وضعیت پا، ناخن‌ها و پوست (DVT Assessment)</span>
          </h2>
          <span className="text-xs text-slate-500 font-bold">جهت ارزیابی پیشرفت درمان و قرمزی</span>
        </div>

        {data?.clinicalPhotos && data.clinicalPhotos.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {data.clinicalPhotos.map((photo) => (
              <div
                key={photo.id}
                onClick={() => setSelectedPhoto(photo.photoUrl)}
                className="group relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 cursor-pointer hover:shadow-lg transition"
              >
                <img
                  src={photo.photoUrl}
                  alt={photo.noteText || "عکس بالینی"}
                  className="w-full h-36 object-cover group-hover:scale-105 transition duration-300"
                />
                <div className="p-2.5 bg-white">
                  <div className="text-[11px] font-black text-slate-900 truncate">
                    {photo.category === "dvt_leg"
                      ? "عکس پای راست / DVT"
                      : photo.category === "skin_wound"
                      ? "زخم یا قرمزی پوست"
                      : photo.category === "nails"
                      ? "ناخن‌ها"
                      : "رویداد / درد"}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {formatJalaliDateTime(photo.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 text-xs">
            هنوز تصویری از پای بیمار یا پوست آپلود نشده است. عکس‌ها توسط پرستار در نمای پای تخت بارگذاری می‌شوند.
          </div>
        )}
      </div>

      {/* Photo Full Modal */}
      {selectedPhoto && (
        <div
          onClick={() => setSelectedPhoto(null)}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div className="max-w-2xl w-full bg-white rounded-3xl overflow-hidden p-2">
            <img src={selectedPhoto} alt="بزرگنمایی تصویر" className="w-full h-auto max-h-[80vh] object-contain rounded-2xl" />
            <div className="p-3 text-center">
              <button
                onClick={() => setSelectedPhoto(null)}
                className="px-6 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
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
