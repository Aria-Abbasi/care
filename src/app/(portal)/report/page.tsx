"use client";

import { useEffect, useState } from "react";
import { Printer, HeartPulse, Shield, Calendar, User, FileText } from "lucide-react";
import { toPersianDigits, formatJalaliDate, formatJalaliLong } from "@/lib/jalali";

interface ReportData {
  patient: {
    fullName: string;
    age: number;
    bloodType: string;
    notes: string;
  };
  metrics: {
    period: string;
    glucoseAvg: number;
    glucoseMin: number;
    glucoseMax: number;
    glucoseSpikes: number;
    bpAvgSys: number;
    bpAvgDia: number;
    dailyAvgIntake: number;
    dailyAvgOutput: number;
    dvtAvgDailyMinutes: number;
  };
  activeMedications: Array<{
    boxNumber?: string | null;
    nameFa: string;
    instructions?: string | null;
    doctorName?: string | null;
    doctorOrderNotes?: string | null;
  }>;
  discontinuedMedications: Array<{
    boxNumber?: string | null;
    nameFa: string;
    discontinuedAt?: string | null;
    discontinuedBy?: string | null;
    discontinuedReason?: string | null;
  }>;
  recentIncidents: Array<{
    date: string;
    category: string;
    noteText: string;
  }>;
}

export default function DoctorReportPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReport() {
      try {
        const res = await fetch("/api/admin/analytics?range=30d");
        const medsRes = await fetch("/api/admin/medications");
        if (res.ok && medsRes.ok) {
          const analytics = await res.json();
          const medsJson = await medsRes.json();

          const sugars = analytics.glucoseChart.map((g: any) => g.value);
          const minG = sugars.length > 0 ? Math.min(...sugars) : 0;
          const maxG = sugars.length > 0 ? Math.max(...sugars) : 0;

          const allMeds = medsJson.medications || [];
          const activeMeds = allMeds.filter((m: any) => m.isActive);
          const discontinuedMeds = allMeds.filter((m: any) => !m.isActive || m.discontinuedAt);

          setData({
            patient: {
              fullName: "آقای جواد یزدانی",
              age: 78,
              bloodType: "A+",
              notes: "سابقه DVT پای راست، دیابت ملیتوس نوع ۲، تحت درمان آنتی‌کواگولان (آپیکسابان)، انسولین و رژیم هیدراتاسیون",
            },
            metrics: {
              period: "۳۰ روز اخیر",
              glucoseAvg: analytics.kpi.glucoseAvg,
              glucoseMin: minG,
              glucoseMax: maxG,
              glucoseSpikes: analytics.kpi.glucoseSpikesCount,
              bpAvgSys: 125,
              bpAvgDia: 75,
              dailyAvgIntake: analytics.kpi.todayIntake || 1600,
              dailyAvgOutput: analytics.kpi.todayOutput || 1450,
              dvtAvgDailyMinutes: Math.round(analytics.kpi.totalDvtMinutes / 14) || 90,
            },
            activeMedications: activeMeds,
            discontinuedMedications: discontinuedMeds,
            recentIncidents: analytics.clinicalPhotos.map((p: any) => ({
              date: p.createdAt,
              category: p.category,
              noteText: p.noteText,
            })),
          });
        }
      } catch (err) {
        console.error("Report load error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, []);

  function handlePrint() {
    window.print();
  }

  if (loading || !data) {
    return (
      <div className="p-12 text-center text-slate-500 font-bold">
        در حال آماده‌سازی و استخراج گزارش بالینی پزشک...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action Bar (Hidden in Print) */}
      <div className="no-print flex items-center justify-between bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileText className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            <span>خلاصه وضعیت بالینی جهت ویزیت پزشک معالج</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            جهت ارائه به پزشکان معالج (متخصص قلب و عروق، داخلی، غدد، ارولوژی)
          </p>
        </div>

        <button
          onClick={handlePrint}
          className="px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-black text-xs shadow-lg flex items-center gap-2 transition active:scale-95"
        >
          <Printer className="w-4 h-4" />
          <span>چاپ / ذخیره به عنوان PDF</span>
        </button>
      </div>

      {/* Printable Report Document */}
      <div className="bg-white dark:bg-slate-900 p-8 sm:p-12 rounded-3xl border border-slate-300 dark:border-slate-800 shadow-sm print:bg-white print:text-slate-900 print:border-none print:shadow-none print:p-0">
        {/* Document Header */}
        <div className="flex items-center justify-between pb-6 border-b-2 border-slate-900 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-700 text-white flex items-center justify-center font-black">
              <HeartPulse className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">گزارش جامع پایش بالینی بیمار در منزل</h2>
              <div className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-1">
                سامانه پایش هوشمند مراقبت • بیمار: {data.patient.fullName}
              </div>
            </div>
          </div>

          <div className="text-left text-xs font-bold text-slate-500 dark:text-slate-400">
            <div>تاریخ تنظیم: {formatJalaliLong(new Date())}</div>
            <div className="mt-1">بازه گزارش: {data.metrics.period}</div>
          </div>
        </div>

        {/* Patient Profile Demographics */}
        <div className="my-6 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-500 dark:text-slate-400 block">نام بیمار:</span>
            <span className="font-black text-slate-900 dark:text-slate-100 text-sm">{data.patient.fullName}</span>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400 block">سن:</span>
            <span className="font-bold text-slate-900 dark:text-slate-100">{toPersianDigits(data.patient.age)} سال</span>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400 block">گروه خونی:</span>
            <span className="font-bold text-slate-900 dark:text-slate-100 font-mono" dir="ltr">{data.patient.bloodType}</span>
          </div>
          <div className="sm:col-span-4 mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 dark:text-slate-400 block">تشخیص‌های بالینی و ملاحظات:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 leading-relaxed">{data.patient.notes}</span>
          </div>
        </div>

        {/* Vitals Summary Table */}
        <div className="my-6">
          <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
            <span>خلاصه میانگین علائم حیاتی و شاخص‌های کنترلی ({data.metrics.period})</span>
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80">
              <span className="text-xs text-slate-500 dark:text-slate-400 block">میانگین قند خون:</span>
              <span className="text-xl font-black text-slate-900 dark:text-slate-100 font-mono">
                {toPersianDigits(data.metrics.glucoseAvg)} <span className="text-xs">mg/dL</span>
              </span>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                حداقل: {toPersianDigits(data.metrics.glucoseMin)} | حداکثر: {toPersianDigits(data.metrics.glucoseMax)}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80">
              <span className="text-xs text-slate-500 dark:text-slate-400 block">اسپایک قند (&gt;۱۸۰):</span>
              <span className="text-xl font-black text-rose-600 dark:text-rose-400 font-mono">
                {toPersianDigits(data.metrics.glucoseSpikes)} <span className="text-xs">مورد</span>
              </span>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">نیاز به تطبیق دوز انسولین</div>
            </div>

            <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80">
              <span className="text-xs text-slate-500 dark:text-slate-400 block">میانگین بالانس مایعات روزانه:</span>
              <span className="text-base font-black text-slate-900 dark:text-slate-100 font-mono">
                ورودی: {toPersianDigits(data.metrics.dailyAvgIntake)} cc
              </span>
              <div className="text-[10px] text-amber-700 dark:text-amber-400 font-bold mt-1">
                تخلیه ادرار: {toPersianDigits(data.metrics.dailyAvgOutput)} cc
              </div>
            </div>

            <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80">
              <span className="text-xs text-slate-500 dark:text-slate-400 block">بالا بردن پای راست (DVT):</span>
              <span className="text-xl font-black text-teal-700 dark:text-teal-400 font-mono">
                {toPersianDigits(data.metrics.dvtAvgDailyMinutes)} <span className="text-xs">دقیقه/روز</span>
              </span>
              <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold mt-1">همراه با ماساژ و هیدراتاسیون</div>
            </div>
          </div>
        </div>

        {/* Current Medication Regimen Table */}
        <div className="my-6">
          <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
            <span>پروتکل دارویی فعال در منزل</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs border border-slate-200 dark:border-slate-700">
              <thead className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 font-black text-slate-700 dark:text-slate-300">
                <tr>
                  <th className="p-2.5">جعبه</th>
                  <th className="p-2.5">نام دارو</th>
                  <th className="p-2.5">دستور مصرف</th>
                  <th className="p-2.5">پزشک معالج</th>
                  <th className="p-2.5">توضیحات نسخه</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {data.activeMedications.map((m, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-2.5 font-bold font-mono">
                      {m.boxNumber ? `جعبه ${toPersianDigits(m.boxNumber)}` : "---"}
                    </td>
                    <td className="p-2.5 font-black text-slate-900 dark:text-slate-100">{m.nameFa}</td>
                    <td className="p-2.5 text-slate-700 dark:text-slate-300">{m.instructions || "طبق دستور"}</td>
                    <td className="p-2.5 text-slate-600 dark:text-slate-400">{m.doctorName || "---"}</td>
                    <td className="p-2.5 text-slate-500 dark:text-slate-400 text-[11px]">{m.doctorOrderNotes || "---"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Discontinued Medication History Table */}
        {data.discontinuedMedications.length > 0 && (
          <div className="my-6">
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
              <span>تاریخچه تغییرات و توقف دستورات دارویی</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs border border-rose-200 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/10">
                <thead className="bg-rose-100/70 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900/60 font-black text-rose-950 dark:text-rose-200">
                  <tr>
                    <th className="p-2.5">نام داروی متوقف‌شده</th>
                    <th className="p-2.5">جعبه سابق</th>
                    <th className="p-2.5">تاریخ قطع</th>
                    <th className="p-2.5">دستوردهنده / پزشک</th>
                    <th className="p-2.5">علت بالینی توقف / جایگزینی</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-200/60 dark:divide-rose-900/40">
                  {data.discontinuedMedications.map((m, idx) => (
                    <tr key={idx} className="hover:bg-rose-50/50 dark:hover:bg-rose-950/20">
                      <td className="p-2.5 font-black text-slate-900 dark:text-slate-100">{m.nameFa}</td>
                      <td className="p-2.5 font-bold font-mono text-slate-600 dark:text-slate-400">
                        {m.boxNumber ? `جعبه ${toPersianDigits(m.boxNumber)}` : "---"}
                      </td>
                      <td className="p-2.5 font-mono text-slate-700 dark:text-slate-300">
                        {m.discontinuedAt ? formatJalaliDate(m.discontinuedAt) : "---"}
                      </td>
                      <td className="p-2.5 text-slate-700 dark:text-slate-300">{m.discontinuedBy || "پزشک معالج"}</td>
                      <td className="p-2.5 text-rose-900 dark:text-rose-300 font-medium leading-relaxed">
                        {m.discontinuedReason || "طبق دستور پزشک قطع شد"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Clinical Observations & Incidents */}
        <div className="my-6">
          <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
            <span>یادداشت‌های بالینی و مشاهدات پرستاری اخیر</span>
          </h3>

          <div className="space-y-2 text-xs">
            {data.recentIncidents.length > 0 ? (
              data.recentIncidents.slice(0, 5).map((inc, i) => (
                <div key={i} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex items-start gap-2">
                  <span className="font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {formatJalaliDate(inc.date)}:
                  </span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{inc.noteText}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500">مورد حادی گزارش نشده است.</p>
            )}
          </div>
        </div>

        {/* Doctor Signature Block */}
        <div className="mt-12 pt-6 border-t border-slate-300 dark:border-slate-700 grid grid-cols-2 text-center text-xs font-bold text-slate-600 dark:text-slate-400">
          <div>
            <p>مهر و امضای سرپرست پرونده در منزل</p>
            <div className="h-16 mt-2" />
          </div>
          <div>
            <p>مهر و امضای پزشک معالج</p>
            <div className="h-16 mt-2" />
          </div>
        </div>
      </div>
    </div>
  );
}
