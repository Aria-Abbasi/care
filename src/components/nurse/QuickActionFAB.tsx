"use client";

import { useState, useEffect, useRef } from "react";
import {
  Plus, X, Droplets, Activity, Heart, Stethoscope,
  Smile, Camera, Timer, Check, AlertTriangle, Play, Square, Sparkles, ClipboardPlus, FileText
} from "lucide-react";
import { toPersianDigits } from "@/lib/jalali";
import { compressImage, formatFileSize } from "@/lib/imageCompression";

export type QuickModalType =
  | null
  | "MENU"
  | "WATER"
  | "URINE"
  | "GLUCOSE"
  | "BP"
  | "BOWEL"
  | "DVT"
  | "NOTE"
  | "ADHOC";

export interface ActiveActionTrigger {
  modal: QuickModalType;
  scheduleId?: string;
  taskTitle?: string;
  mealRelation?: string | null;
}

interface QuickActionFABProps {
  onDataLogged?: () => void;
  activeAction?: ActiveActionTrigger | null;
  onCloseAction?: () => void;
}

export default function QuickActionFAB({
  onDataLogged,
  activeAction,
  onCloseAction,
}: QuickActionFABProps) {
  const [activeModal, setActiveModal] = useState<QuickModalType>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync with external trigger (e.g. nurse clicked a smart vital card on timeline)
  useEffect(() => {
    if (activeAction?.modal) {
      setActiveModal(activeAction.modal);
      if (activeAction.mealRelation === "FASTING") {
        setSelectedTag("fasting");
      } else if (activeAction.mealRelation === "AFTER_MEAL") {
        setSelectedTag("2h_breakfast");
      }
      if (activeAction.taskTitle?.includes("ملین") || activeAction.taskTitle?.includes("شیاف") || activeAction.taskTitle?.includes("پیدرولاکس")) {
        setBowelMode("LAXATIVE");
      } else if (activeAction.modal === "BOWEL") {
        setBowelMode("BOWEL");
      }
    }
  }, [activeAction]);

  // DVT Stopwatch state (server-tracked)
  const [dvtActive, setDvtActive] = useState(false);

  // Keypad / input states
  const [keypadValue, setKeypadValue] = useState("");
  const [selectedTag, setSelectedTag] = useState("fasting");
  const [bpSys, setBpSys] = useState("");
  const [bpDia, setBpDia] = useState("");
  const [bowelMode, setBowelMode] = useState<"BOWEL" | "LAXATIVE">("BOWEL");
  const [bowelGrade, setBowelGrade] = useState("2_plus");
  const [laxatives, setLaxatives] = useState<string[]>([]);
  const [bowelNotes, setBowelNotes] = useState("");
  const [urineColor, setUrineColor] = useState("شفاف و زرد روشن");
  const [noteCategory, setNoteCategory] = useState("dvt_leg");
  const [noteText, setNoteText] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionStats, setCompressionStats] = useState<{ original: string; compressed: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ad-hoc task state
  const [adhocTitle, setAdhocTitle] = useState("");
  const [adhocCategory, setAdhocCategory] = useState("مراقبتی");
  const [adhocNotes, setAdhocNotes] = useState("");
  const [adhocSuggestions, setAdhocSuggestions] = useState<Array<{ id: string; title: string; category?: string }>>([
    { id: "1", title: "تعویض پانسمان موضعی", category: "مراقبتی" },
    { id: "2", title: "پانسمان زخم پای راست (DVT)", category: "مراقبتی" },
    { id: "3", title: "ماساژ اضافه و چرب کردن ساق پا", category: "مراقبتی" },
    { id: "4", title: "تعویض ملحفه و نظافت فوری", category: "بهداشتی" },
    { id: "5", title: "کنترل دمای بدن و تب", category: "پایش علائم" },
    { id: "6", title: "تنظیم سرم / آنژیوکت", category: "مراقبتی" },
    { id: "7", title: "کمک به جابجایی / ویلچر", category: "مراقبتی" },
    { id: "8", title: "دادن میان‌وعده اضافه", category: "بهداشتی" },
  ]);

  // Load ad-hoc suggestions dynamically from server
  useEffect(() => {
    async function loadSuggestions() {
      try {
        const res = await fetch("/api/admin/adhoc-suggestions");
        if (res.ok) {
          const data = await res.json();
          if (data.suggestions && data.suggestions.length > 0) {
            setAdhocSuggestions(data.suggestions);
          }
        }
      } catch (err) {
        console.error("Failed to load adhoc suggestions:", err);
      }
    }
    loadSuggestions();
  }, []);

  // Sync active DVT timer status from server
  useEffect(() => {
    async function checkDvtStatus() {
      try {
        const res = await fetch("/api/nurse/dvt-timer");
        if (res.ok) {
          const data = await res.json();
          setDvtActive(Boolean(data.active));
        }
      } catch {}
    }
    checkDvtStatus();
  }, [activeModal]);

  // Listen to navbar + button clicks
  useEffect(() => {
    function handleOpenFromNavbar() {
      setActiveModal("MENU");
    }
    window.addEventListener("open-quick-action-menu", handleOpenFromNavbar);
    return () => window.removeEventListener("open-quick-action-menu", handleOpenFromNavbar);
  }, []);

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }

  function resetForm() {
    setKeypadValue("");
    setBpSys("");
    setBpDia("");
    setLaxatives([]);
    setBowelNotes("");
    setPhotoFile(null);
    setPhotoPreview(null);
    setIsCompressing(false);
    setCompressionStats(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setNoteText("");
    setAdhocTitle("");
    setAdhocNotes("");
    setActiveModal(null);
    onCloseAction?.();
  }

  // Handle DVT Start/Stop via Server API
  async function toggleDvtTimer() {
    if (!dvtActive) {
      try {
        const res = await fetch("/api/nurse/dvt-timer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "START",
            scheduleId: activeAction?.scheduleId,
            taskTitle: activeAction?.taskTitle || "مراقبت DVT پای راست",
          }),
        });
        if (res.ok) {
          setDvtActive(true);
          showToast("تایمر DVT شروع شد و در لیست کارهای امروز در حال اجراست");
          onDataLogged?.();
        } else {
          showToast("خطا در شروع تایمر DVT");
        }
      } catch {
        showToast("خطا در برقراری ارتباط با سرور");
      }
    } else {
      try {
        const res = await fetch("/api/nurse/dvt-timer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "STOP" }),
        });
        if (res.ok) {
          const data = await res.json();
          setDvtActive(false);
          const durStr = data.durationStr || "مدت ثبت‌شده";
          showToast(`DVT ثبت شد: ${toPersianDigits(durStr)} پای راست بالا بود`);
          resetForm();
          onDataLogged?.();
        } else {
          showToast("خطا در توقف تایمر DVT");
        }
      } catch {
        showToast("خطا در ارتباط با سرور جهت ثبت DVT");
      }
    }
  }

  // Keypad number tap
  function handleKeypadTap(digit: string) {
    if (digit === "C") {
      setKeypadValue("");
    } else if (digit === "BACK") {
      setKeypadValue((prev) => prev.slice(0, -1));
    } else {
      if (keypadValue.length < 5) {
        setKeypadValue((prev) => prev + digit);
      }
    }
  }

  // Submit Water Intake
  async function submitWater(amount: number) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/nurse/vitals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "water_intake",
          valueNum: amount,
          valueText: `آب مصرفی ${amount} سی سی`,
          scheduleId: activeAction?.scheduleId,
          taskTitle: activeAction?.taskTitle,
        }),
      });
      if (res.ok) {
        showToast(`ثبت شد: ${toPersianDigits(amount)} سی سی آب`);
        resetForm();
        onDataLogged?.();
      }
    } catch {
      showToast("خطا در ثبت آب مصرفی");
    } finally {
      setSubmitting(false);
    }
  }

  // Submit Urine Output
  async function submitUrine(amount: number) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/nurse/vitals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "urine_output",
          valueNum: amount,
          valueText: `تخلیه ادرار ${amount} سی سی - ${urineColor}`,
          extraData: { color: urineColor },
          scheduleId: activeAction?.scheduleId,
          taskTitle: activeAction?.taskTitle,
        }),
      });
      if (res.ok) {
        showToast(`ثبت شد: ${toPersianDigits(amount)} سی سی تخلیه ادرار`);
        resetForm();
        onDataLogged?.();
      }
    } catch {
      showToast("خطا در ثبت تخلیه ادرار");
    } finally {
      setSubmitting(false);
    }
  }

  // Submit Blood Glucose
  async function submitGlucose() {
    const val = parseInt(keypadValue, 10);
    if (isNaN(val) || val <= 0) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/nurse/vitals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "blood_sugar",
          valueNum: val,
          mealTag: selectedTag,
          valueText: `قند خون ${val} (${selectedTag})`,
          scheduleId: activeAction?.scheduleId,
          taskTitle: activeAction?.taskTitle,
        }),
      });
      if (res.ok) {
        showToast(`ثبت شد: قند خون ${toPersianDigits(val)} mg/dL`);
        resetForm();
        onDataLogged?.();
      }
    } catch {
      showToast("خطا در ثبت قند خون");
    } finally {
      setSubmitting(false);
    }
  }

  // Submit Blood Pressure
  async function submitBP() {
    const s = parseInt(bpSys, 10);
    const d = parseInt(bpDia, 10);
    if (isNaN(s) || isNaN(d)) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/nurse/vitals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "blood_pressure",
          systolic: s < 30 ? s * 10 : s,
          diastolic: d < 20 ? d * 10 : d,
          valueText: `فشار خون ${s}/${d}`,
          scheduleId: activeAction?.scheduleId,
          taskTitle: activeAction?.taskTitle,
        }),
      });
      if (res.ok) {
        showToast(`ثبت شد: فشار خون ${toPersianDigits(s)} روی ${toPersianDigits(d)}`);
        resetForm();
        onDataLogged?.();
      }
    } catch {
      showToast("خطا در ثبت فشار خون");
    } finally {
      setSubmitting(false);
    }
  }

  // Submit Bowel Movement or Laxative
  async function submitBowel() {
    setSubmitting(true);
    const laxStr = laxatives.length > 0 ? laxatives.join("، ") : null;
    const isBowel = bowelMode === "BOWEL";

    let summary = isBowel ? `کارکرد روده: ${bowelGrade}` : `مصرف ملین: ${laxStr || "ملین"}`;
    if (bowelNotes.trim()) {
      summary += ` - توضیحات: ${bowelNotes.trim()}`;
    }

    try {
      const res = await fetch("/api/nurse/vitals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: isBowel ? "bowel_movement" : "laxative",
          valueNum: 1.0,
          bowelGrade: isBowel ? bowelGrade : null,
          laxativeGiven: !isBowel ? laxStr : null,
          valueText: summary,
          extraData: bowelNotes.trim() ? { notes: bowelNotes.trim() } : undefined,
          scheduleId: activeAction?.scheduleId,
          taskTitle: activeAction?.taskTitle || (isBowel ? "ثبت کارکرد شکم" : "ثبت داروی ملین"),
        }),
      });
      if (res.ok) {
        showToast(isBowel ? "کارکرد روده با موفقیت ثبت شد" : "مصرف ملین با موفقیت ثبت شد");
        resetForm();
        onDataLogged?.();
      }
    } catch {
      showToast("خطا در ثبت اطلاعات");
    } finally {
      setSubmitting(false);
    }
  }

  // Submit Clinical Note & Photo
  async function submitNote() {
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("category", noteCategory);
      fd.append("noteText", noteText);
      if (photoFile) {
        fd.append("photo", photoFile);
      }
      if (activeAction?.scheduleId) {
        fd.append("scheduleId", activeAction.scheduleId);
      }
      if (activeAction?.taskTitle) {
        fd.append("taskTitle", activeAction.taskTitle);
      }

      const res = await fetch("/api/nurse/notes", {
        method: "POST",
        body: fd,
      });

      if (res.ok) {
        showToast("یادداشت / تصویر با موفقیت ذخیره شد");
        resetForm();
        onDataLogged?.();
      }
    } catch {
      showToast("خطا در ارسال یادداشت یا تصویر");
    } finally {
      setSubmitting(false);
    }
  }

  // Submit Ad-Hoc Task
  async function submitAdhocTask() {
    if (!adhocTitle.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/nurse/tasks/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskTitle: adhocTitle.trim(),
          isAdHoc: true,
          category: adhocCategory,
          notes: adhocNotes.trim() || undefined,
          status: "DONE",
        }),
      });

      if (res.ok) {
        showToast(`اقدام موردی ثبت شد: ${adhocTitle}`);
        resetForm();
        onDataLogged?.();
      }
    } catch {
      showToast("خطا در ثبت اقدام موردی");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-emerald-900/90 backdrop-blur-md text-white font-bold text-sm shadow-2xl flex items-center gap-2 animate-bounce border border-emerald-500/40">
          <Check className="w-5 h-5 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Quick Action Menu Sheet */}
      {activeModal === "MENU" && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden max-h-[90vh] flex flex-col transition-colors">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-slate-100">ثبت سریع پای تخت بیمار</h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">انتخاب اقدام جهت ثبت فوری</p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="w-9 h-9 rounded-xl bg-slate-200/70 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 transition active:scale-90"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Grid of Action Buttons */}
            <div className="p-4 grid grid-cols-2 gap-3 overflow-y-auto">
              {/* NEW: Ad-Hoc Task Button */}
              <button
                onClick={() => setActiveModal("ADHOC")}
                className="col-span-2 flex items-center gap-3 p-3.5 rounded-2xl border-2 border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/80 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-right transition active:scale-95 shadow-sm"
              >
                <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-600/20">
                  <ClipboardPlus className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm font-black text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                    <span>اقدامات موردی</span>
                    <span className="px-1.5 py-0.5 rounded bg-indigo-200 dark:bg-indigo-900 text-indigo-900 dark:text-indigo-200 text-[10px] font-bold">فوری</span>
                  </div>
                  <div className="text-[11px] text-indigo-800 dark:text-indigo-300 font-medium">
                    کاری خارج از روتین زمان‌بندی‌شده که هم‌اکنون انجام شد
                  </div>
                </div>
              </button>

              {/* 1. Water Intake */}
              <button
                onClick={() => setActiveModal("WATER")}
                className="flex items-center gap-3 p-3.5 rounded-2xl border-2 border-sky-100 dark:border-sky-900/50 bg-sky-50/50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/50 text-right transition active:scale-95"
              >
                <div className="w-11 h-11 rounded-xl bg-sky-500 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-sky-500/20">
                  <Droplets className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm font-black text-slate-900 dark:text-slate-100">آب و مایعات</div>
                  <div className="text-[11px] text-sky-700 dark:text-sky-300 font-medium">استکان / لیوان / ماگ</div>
                </div>
              </button>

              {/* 2. Urine Output */}
              <button
                onClick={() => setActiveModal("URINE")}
                className="flex items-center gap-3 p-3.5 rounded-2xl border-2 border-amber-100 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-right transition active:scale-95"
              >
                <div className="w-11 h-11 rounded-xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-amber-500/20">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm font-black text-slate-900 dark:text-slate-100">تخلیه ادرار سوند</div>
                  <div className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">سی سی + رنگ</div>
                </div>
              </button>

              {/* 3. Blood Glucose */}
              <button
                onClick={() => setActiveModal("GLUCOSE")}
                className="flex items-center gap-3 p-3.5 rounded-2xl border-2 border-rose-100 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-right transition active:scale-95"
              >
                <div className="w-11 h-11 rounded-xl bg-rose-500 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-rose-500/20">
                  <Heart className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm font-black text-slate-900 dark:text-slate-100">قند خون</div>
                  <div className="text-[11px] text-rose-700 dark:text-rose-300 font-medium">ناشتا / ۲ ساعته / کیپد</div>
                </div>
              </button>

              {/* 4. Blood Pressure */}
              <button
                onClick={() => setActiveModal("BP")}
                className="flex items-center gap-3 p-3.5 rounded-2xl border-2 border-violet-100 dark:border-violet-900/50 bg-violet-50/50 dark:bg-violet-950/40 hover:bg-violet-100 dark:hover:bg-violet-900/50 text-right transition active:scale-95"
              >
                <div className="w-11 h-11 rounded-xl bg-violet-500 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-violet-500/20">
                  <Stethoscope className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm font-black text-slate-900 dark:text-slate-100">فشار خون</div>
                  <div className="text-[11px] text-violet-700 dark:text-violet-300 font-medium">سیستول / دیاستول</div>
                </div>
              </button>

              {/* 5. Bowel Movement */}
              <button
                onClick={() => setActiveModal("BOWEL")}
                className="flex items-center gap-3 p-3.5 rounded-2xl border-2 border-orange-100 dark:border-orange-900/50 bg-orange-50/50 dark:bg-orange-950/40 hover:bg-orange-100 dark:hover:bg-orange-900/50 text-right transition active:scale-95"
              >
                <div className="w-11 h-11 rounded-xl bg-orange-500 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-orange-500/20">
                  <Smile className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm font-black text-slate-900 dark:text-slate-100">کارکرد روده و ملین</div>
                  <div className="text-[11px] text-orange-700 dark:text-orange-300 font-medium">۱+ / ۲+ / شیاف / ساشه</div>
                </div>
              </button>

              {/* 6. DVT Stopwatch Toggle */}
              <button
                onClick={() => {
                  setActiveModal(null);
                  toggleDvtTimer();
                }}
                className={`flex items-center gap-3 p-3.5 rounded-2xl border-2 text-right transition active:scale-95 ${
                  dvtActive
                    ? "border-amber-500 bg-amber-100 dark:bg-amber-950/60"
                    : "border-teal-100 dark:border-teal-900/50 bg-teal-50/50 dark:bg-teal-950/40 hover:bg-teal-100 dark:hover:bg-teal-900/50"
                }`}
              >
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md ${
                    dvtActive ? "bg-amber-600 text-white" : "bg-teal-600 text-white shadow-teal-500/20"
                  }`}
                >
                  <Timer className={`w-6 h-6 ${dvtActive ? "animate-spin" : ""}`} />
                </div>
                <div>
                  <div className="text-sm font-black text-slate-900 dark:text-slate-100">
                    {dvtActive ? "پایین آوردن پا" : "DVT پای راست"}
                  </div>
                  <div className="text-[11px] font-bold text-teal-700 dark:text-teal-300">
                    {dvtActive ? "در حال ثبت زمان..." : "تایمر بالا بردن پا"}
                  </div>
                </div>
              </button>

              {/* 7. Clinical Photo & Incident Note */}
              <button
                onClick={() => setActiveModal("NOTE")}
                className="col-span-2 flex items-center gap-3 p-3.5 rounded-2xl border-2 border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-right transition active:scale-95"
              >
                <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-emerald-600/20">
                  <Camera className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-sm font-black text-slate-900 dark:text-slate-100">ثبت تصویر یا یادداشت بالینی</div>
                  <div className="text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">
                    عکس پا/DVT، قرمزی پوست، ناخن‌ها، رویداد یا درد
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Ad-Hoc Task */}
      {activeModal === "ADHOC" && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto transition-colors">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <ClipboardPlus className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-slate-100">اقدامات موردی</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">اقدامی که در برنامه روتین نبود و انجام شد</p>
                </div>
              </div>
              <button onClick={() => setActiveModal("MENU")} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Fast chip presets */}
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">انتخاب سریع عنوان اقدام:</p>
            <div className="flex flex-wrap gap-1.5 mb-4 max-h-36 overflow-y-auto p-0.5">
              {adhocSuggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  onClick={() => {
                    setAdhocTitle(suggestion.title);
                    if (suggestion.category) setAdhocCategory(suggestion.category);
                  }}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition ${
                    adhocTitle === suggestion.title
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-indigo-50/70 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60"
                  }`}
                >
                  {suggestion.title}
                </button>
              ))}
            </div>

            {/* Custom Title Input */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                یا عنوان دلخواه اقدام انجام‌شده:
              </label>
              <input
                type="text"
                value={adhocTitle}
                onChange={(e) => setAdhocTitle(e.target.value)}
                placeholder="مثلاً تعویض سوند، چک نبض، یا..."
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition"
              />
            </div>

            {/* Category Chips */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">دسته‌بندی:</label>
              <div className="flex flex-wrap gap-1.5">
                {["مراقبتی", "بهداشتی", "دارویی", "پایش علائم", "فوریت"].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setAdhocCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                      adhocCategory === cat
                        ? "bg-slate-900 dark:bg-indigo-600 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes / Reason */}
            <div className="mb-5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                توضیحات یا علت انجام اقدام (اختیاری):
              </label>
              <textarea
                rows={3}
                value={adhocNotes}
                onChange={(e) => setAdhocNotes(e.target.value)}
                placeholder="علت نیاز به این اقدام، واکنش بیمار یا شرایط خاص..."
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition"
              />
            </div>

            <button
              disabled={submitting || !adhocTitle.trim()}
              onClick={submitAdhocTask}
              className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black shadow-lg shadow-indigo-600/30 active:scale-95 transition"
            >
              {submitting ? "در حال ثبت..." : "تأیید و ثبت اقدام موردی"}
            </button>
          </div>
        </div>
      )}

      {/* Modal: Water Intake */}
      {activeModal === "WATER" && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 border border-slate-100 dark:border-slate-800 transition-colors">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <Droplets className="w-6 h-6 text-sky-500 dark:text-sky-400" />
                <h3 className="font-black text-base text-slate-900 dark:text-slate-100">ثبت مصرف آب و مایعات</h3>
              </div>
              <button onClick={() => setActiveModal("MENU")} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3">یک لمس سریع (مقادیر استاندارد):</p>
            <div className="grid grid-cols-2 gap-2.5 mb-5">
              {[
                { label: "استکان", cc: 150 },
                { label: "لیوان", cc: 220 },
                { label: "ماگ بزرگ", cc: 340 },
                { label: "بطری کامل", cc: 500 },
              ].map((item) => (
                <button
                  key={item.cc}
                  onClick={() => submitWater(item.cc)}
                  disabled={submitting}
                  className="p-3 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border-2 border-sky-200 dark:border-sky-900/50 hover:bg-sky-100 dark:hover:bg-sky-900/50 active:scale-95 transition flex flex-col items-center justify-center"
                >
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{item.label}</span>
                  <span className="text-base font-black text-sky-700 dark:text-sky-300">{toPersianDigits(item.cc)} cc</span>
                </button>
              ))}
            </div>

            {/* Custom keypad */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between items-center mb-2 px-1">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">یا مقدار دلخواه:</span>
                <span className="text-lg font-black text-sky-900 dark:text-sky-300 font-mono">
                  {keypadValue ? `${toPersianDigits(keypadValue)} cc` : "۰ cc"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 mb-2" dir="ltr">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "BACK"].map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => handleKeypadTap(k)}
                    className="py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-slate-800 dark:text-slate-100 active:bg-slate-100 dark:active:bg-slate-700 shadow-sm"
                  >
                    {k === "BACK" ? "←" : toPersianDigits(k)}
                  </button>
                ))}
              </div>
              <button
                disabled={!keypadValue || submitting}
                onClick={() => submitWater(parseInt(keypadValue, 10))}
                className="w-full py-3 rounded-xl bg-sky-600 disabled:opacity-50 text-white font-bold shadow-md shadow-sky-600/30 active:scale-95 transition"
              >
                ثبت مقدار دلخواه
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Urine Output */}
      {activeModal === "URINE" && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 border border-slate-100 dark:border-slate-800 transition-colors">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-6 h-6 text-amber-500 dark:text-amber-400" />
                <h3 className="font-black text-base text-slate-900 dark:text-slate-100">تخلیه ادرار سوند</h3>
              </div>
              <button onClick={() => setActiveModal("MENU")} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">انتخاب رنگ ادرار:</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {["شفاف و زرد روشن", "کهربایی / غلیظ", "کدر", "تیره / متمایل به خون"].map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setUrineColor(color)}
                  className={`p-2 text-xs font-bold rounded-xl border transition ${
                    urineColor === color
                      ? "border-amber-500 bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {color}
                </button>
              ))}
            </div>

            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">مقادیر پرکاربرد:</p>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[200, 300, 400, 500].map((cc) => (
                <button
                  key={cc}
                  onClick={() => submitUrine(cc)}
                  disabled={submitting}
                  className="py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-200 dark:border-amber-900/50 font-black text-amber-900 dark:text-amber-300 text-sm hover:bg-amber-100 dark:hover:bg-amber-900/50 active:scale-95 transition"
                >
                  {toPersianDigits(cc)}
                </button>
              ))}
            </div>

            {/* Keypad */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between items-center mb-2 px-1">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">مقدار دقیق:</span>
                <span className="text-lg font-black text-amber-900 dark:text-amber-300 font-mono">
                  {keypadValue ? `${toPersianDigits(keypadValue)} cc` : "۰ cc"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 mb-2" dir="ltr">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "BACK"].map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => handleKeypadTap(k)}
                    className="py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-slate-800 dark:text-slate-100 active:bg-slate-100 dark:active:bg-slate-700 shadow-sm"
                  >
                    {k === "BACK" ? "←" : toPersianDigits(k)}
                  </button>
                ))}
              </div>
              <button
                disabled={!keypadValue || submitting}
                onClick={() => submitUrine(parseInt(keypadValue, 10))}
                className="w-full py-3 rounded-xl bg-amber-600 disabled:opacity-50 text-white font-bold shadow-md shadow-amber-600/30 active:scale-95 transition"
              >
                ثبت تخلیه ادرار
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Blood Glucose */}
      {activeModal === "GLUCOSE" && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 border border-slate-100 dark:border-slate-800 transition-colors">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <Heart className="w-6 h-6 text-rose-500 dark:text-rose-400" />
                <h3 className="font-black text-base text-slate-900 dark:text-slate-100">ثبت قند خون</h3>
              </div>
              <button onClick={() => setActiveModal("MENU")} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Meal tag chips */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {[
                { id: "fasting", label: "ناشتا" },
                { id: "2h_breakfast", label: "۲س صبحانه" },
                { id: "before_lunch", label: "قبل ناهار" },
                { id: "2h_lunch", label: "۲س ناهار" },
                { id: "before_dinner", label: "قبل شام" },
                { id: "2h_dinner", label: "۲س شام" },
                { id: "random", label: "متفرقه" },
              ].map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => setSelectedTag(tag.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    selectedTag === tag.id
                      ? "bg-rose-600 text-white shadow-sm shadow-rose-600/30"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {tag.label}
                </button>
              ))}
            </div>

            {/* Display value with safety indicator */}
            <div
              className={`p-4 rounded-2xl mb-4 text-center border-2 transition ${
                !keypadValue
                  ? "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
                  : parseInt(keypadValue, 10) < 70
                  ? "bg-purple-50 dark:bg-purple-950/50 border-purple-400 dark:border-purple-600 text-purple-900 dark:text-purple-200"
                  : parseInt(keypadValue, 10) <= 140
                  ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-400 dark:border-emerald-600 text-emerald-900 dark:text-emerald-200"
                  : parseInt(keypadValue, 10) <= 180
                  ? "bg-amber-50 dark:bg-amber-950/50 border-amber-400 dark:border-amber-600 text-amber-900 dark:text-amber-200"
                  : "bg-rose-50 dark:bg-rose-950/50 border-rose-500 dark:border-rose-600 text-rose-900 dark:text-rose-200"
              }`}
            >
              <div className="text-3xl font-black font-mono">
                {keypadValue ? toPersianDigits(keypadValue) : "---"}
                <span className="text-sm font-normal mr-1">mg/dL</span>
              </div>
              <div className="text-xs font-bold mt-1">
                {!keypadValue
                  ? "مقدار قند را وارد کنید"
                  : parseInt(keypadValue, 10) < 70
                  ? "⚠️ افت شدید قند (هیپوگلیسمی) - نیاز به اقدام فوری"
                  : parseInt(keypadValue, 10) <= 140
                  ? "✓ محدوده هدف ایمن (۸۰ تا ۱۴۰)"
                  : parseInt(keypadValue, 10) <= 180
                  ? "قابل قبول (۱۴۰ تا ۱۸۰)"
                  : "⚠️ قند خون بالا (بیش از ۱۸۰)"}
              </div>
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-1.5 mb-3" dir="ltr">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "BACK"].map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => handleKeypadTap(k)}
                  className="py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-slate-800 dark:text-slate-100 active:scale-95 shadow-sm text-base"
                >
                  {k === "BACK" ? "←" : toPersianDigits(k)}
                </button>
              ))}
            </div>

            <button
              disabled={!keypadValue || submitting}
              onClick={submitGlucose}
              className="w-full py-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold shadow-md shadow-rose-600/30 active:scale-95 transition"
            >
              ثبت قند خون
            </button>
          </div>
        </div>
      )}

      {/* Modal: Blood Pressure */}
      {activeModal === "BP" && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 border border-slate-100 dark:border-slate-800 transition-colors">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <Stethoscope className="w-6 h-6 text-violet-500 dark:text-violet-400" />
                <h3 className="font-black text-base text-slate-900 dark:text-slate-100">ثبت فشار خون</h3>
              </div>
              <button onClick={() => setActiveModal("MENU")} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">سیستول (بالا)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={bpSys}
                  onChange={(e) => setBpSys(e.target.value)}
                  placeholder="مثلاً 120 یا 12"
                  className="w-full py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-center font-black text-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-violet-500 outline-none transition"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">دیاستول (پایین)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={bpDia}
                  onChange={(e) => setBpDia(e.target.value)}
                  placeholder="مثلاً 80 یا 8"
                  className="w-full py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-center font-black text-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-violet-500 outline-none transition"
                />
              </div>
            </div>

            <button
              disabled={!bpSys || !bpDia || submitting}
              onClick={submitBP}
              className="w-full py-3.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold shadow-md shadow-violet-600/30 active:scale-95 transition"
            >
              ثبت فشار خون
            </button>
          </div>
        </div>
      )}

      {/* Modal: Bowel Movement */}
      {activeModal === "BOWEL" && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <Smile className="w-6 h-6 text-orange-500" />
                <h3 className="font-black text-base text-slate-900 dark:text-slate-100">ثبت کارکرد روده و ملین</h3>
              </div>
              <button onClick={() => setActiveModal("MENU")} className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-2 gap-2 mb-4 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
              <button
                type="button"
                onClick={() => setBowelMode("BOWEL")}
                className={`py-2 rounded-xl text-xs font-black transition ${
                  bowelMode === "BOWEL"
                    ? "bg-white dark:bg-slate-900 text-orange-950 dark:text-orange-200 shadow-xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                کارکرد شکم (دفع)
              </button>
              <button
                type="button"
                onClick={() => setBowelMode("LAXATIVE")}
                className={`py-2 rounded-xl text-xs font-black transition ${
                  bowelMode === "LAXATIVE"
                    ? "bg-white dark:bg-slate-900 text-orange-950 dark:text-orange-200 shadow-xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                مصرف داروی ملین
              </button>
            </div>

            {bowelMode === "BOWEL" ? (
              <div className="mb-4">
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">میزان کارکرد شکم:</p>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { id: "partial", label: "جزئی", desc: "کم یا تکه‌ای", stars: "•" },
                    { id: "1_plus", label: "۱ مثبت (+)", desc: "متوسط و طبیعی", stars: "+" },
                    { id: "2_plus", label: "۲ مثبت (++)", desc: "خوب و کامل", stars: "++" },
                    { id: "3_plus", label: "۳ مثبت (+++)", desc: "زیاد یا اسهالی", stars: "+++" },
                  ].map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setBowelGrade(b.id)}
                      className={`p-3 rounded-2xl border-2 text-right transition active:scale-95 ${
                        bowelGrade === b.id
                          ? "border-orange-500 bg-orange-50 dark:bg-orange-950/40 text-orange-950 dark:text-orange-200 shadow-sm"
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-black text-sm">{b.label}</span>
                        <span className="text-xs font-mono font-bold text-orange-600">{b.stars}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">{b.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mb-4">
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">انتخاب داروی ملین مصرف‌شده:</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    "شیاف بیزاکودیل",
                    "پودر پیدرولاکس",
                    "شربت منیزیم",
                    "شربت لاکتولوز",
                    "ملین گیاهی گل محمدی",
                    "روغن زیتون",
                  ].map((item) => {
                    const isSelected = laxatives.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setLaxatives(laxatives.filter((l) => l !== item));
                          } else {
                            setLaxatives([...laxatives, item]);
                          }
                        }}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition text-right ${
                          isSelected
                            ? "border-orange-500 bg-orange-100/70 dark:bg-orange-900/40 text-orange-900 dark:text-orange-200"
                            : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Optional Notes */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                شرح یا توضیحات اختیاری:
              </label>
              <textarea
                rows={2}
                value={bowelNotes}
                onChange={(e) => setBowelNotes(e.target.value)}
                placeholder="توضیحات تکمیلی وضعیت یا نحوه مصرف..."
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium focus:ring-2 focus:ring-orange-500 outline-none text-slate-900 dark:text-slate-100"
              />
            </div>

            <button
              disabled={submitting}
              onClick={submitBowel}
              className="w-full py-3.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold shadow-md shadow-orange-600/30 active:scale-95 transition"
            >
              {bowelMode === "BOWEL" ? "ثبت کارکرد شکم" : "ثبت داروی ملین"}
            </button>
          </div>
        </div>
      )}

      {/* Modal: Clinical Note & Photo */}
      {activeModal === "NOTE" && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <Camera className="w-6 h-6 text-emerald-600" />
                <h3 className="font-black text-base text-slate-900 dark:text-slate-100">ثبت تصویر یا یادداشت بالینی</h3>
              </div>
              <button onClick={() => setActiveModal("MENU")} className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">دسته‌بندی:</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { id: "dvt_leg", label: "عکس پا / DVT" },
                { id: "skin_wound", label: "زخم یا قرمزی پوست" },
                { id: "nails", label: "ناخن‌ها و اندام‌ها" },
                { id: "incident", label: "رویداد یا درد خاص" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setNoteCategory(cat.id)}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition text-center ${
                    noteCategory === cat.id
                      ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 font-black"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Photo Capture / Select */}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={fileInputRef}
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const tempPreview = URL.createObjectURL(file);
                  setPhotoPreview(tempPreview);
                  setIsCompressing(true);
                  try {
                    const result = await compressImage(file, { maxWidthOrHeight: 1280, quality: 0.82 });
                    setPhotoFile(result.file);
                    setCompressionStats({
                      original: formatFileSize(result.originalSize),
                      compressed: formatFileSize(result.compressedSize),
                    });
                  } catch (err) {
                    console.error("Compression failed, using original file", err);
                    setPhotoFile(file);
                  } finally {
                    setIsCompressing(false);
                  }
                }
              }}
            />

            <div className="mb-4">
              {photoPreview ? (
                <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-500 bg-slate-900/10">
                  <img src={photoPreview} alt="پیش‌نمایش" className="w-full h-44 object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoFile(null);
                      setPhotoPreview(null);
                      setCompressionStats(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="absolute top-2 left-2 bg-slate-900/80 text-white p-1.5 rounded-full hover:bg-slate-900"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  {/* Compression Indicator / Stats */}
                  {isCompressing ? (
                    <div className="absolute bottom-0 inset-x-0 bg-slate-950/80 backdrop-blur-sm p-2 text-center text-[11px] text-emerald-300 font-bold flex items-center justify-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 animate-spin" />
                      <span>در حال بهینه‌سازی و فشرده‌سازی خودکار تصویر...</span>
                    </div>
                  ) : compressionStats ? (
                    <div className="absolute bottom-0 inset-x-0 bg-slate-950/80 backdrop-blur-sm px-2.5 py-1.5 flex items-center justify-between text-[10px] text-emerald-300 font-bold">
                      <span className="flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        حجم بهینه‌شده جهت ارسال سریع:
                      </span>
                      <span dir="ltr" className="text-white">
                        {toPersianDigits(compressionStats.original)} ➔ {toPersianDigits(compressionStats.compressed)}
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-6 border-2 border-dashed border-emerald-300 dark:border-emerald-700/60 bg-emerald-50/40 dark:bg-emerald-950/30 rounded-2xl flex flex-col items-center justify-center text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition active:scale-98"
                >
                  <Camera className="w-8 h-8 mb-1" />
                  <span className="text-xs font-black">گرفتن عکس با دوربین گوشی / انتخاب تصویر</span>
                </button>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                توضیحات یا شرح وضعیت بیمار (اختیاری):
              </label>
              <textarea
                rows={3}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="مثلاً قرمزی خفیف در ساق پای راست نسبت به دیروز کمتر شده..."
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <button
              disabled={submitting || isCompressing || (!photoFile && !noteText.trim())}
              onClick={submitNote}
              className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold shadow-md shadow-emerald-600/30 active:scale-95 transition"
            >
              ذخیره و ثبت گزارش
            </button>
          </div>
        </div>
      )}
    </>
  );
}
