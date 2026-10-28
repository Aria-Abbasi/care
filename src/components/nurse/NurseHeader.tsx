"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, LogOut, ShieldCheck } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { formatJalaliTime, tehranMoment, toPersianDigits } from "@/lib/jalali";

interface NurseHeaderProps {
  user?: {
    id: string;
    username: string;
    fullName: string;
    role: string;
  } | null;
}

export default function NurseHeader({ user }: NurseHeaderProps) {
  const router = useRouter();
  const [timeStr, setTimeStr] = useState("");
  const [dateStr, setDateStr] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(formatJalaliTime(now));
      setDateStr(toPersianDigits(tehranMoment(now).locale("fa").format("jD jMMMM")));
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  function handleOpenQuickActions() {
    window.dispatchEvent(new CustomEvent("open-quick-action-menu"));
  }

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 shadow-xs px-3 sm:px-4 py-2 transition-colors">
      <div className="max-w-3xl mx-auto flex items-center justify-between gap-2.5">
        {/* Right side: + Quick Action Button & Title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={handleOpenQuickActions}
            className="w-10 h-10 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-90 text-white flex items-center justify-center shadow-md shadow-emerald-600/30 transition-all flex-shrink-0 cursor-pointer"
            title="افزودن اقدام جدید پای تخت (ثبت سریع)"
            aria-label="افزودن اقدام جدید"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 leading-tight truncate">
                لیست فعالیت‌ها
              </h1>
              <span className="hidden sm:inline-block px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800/60 truncate">
                آقای جواد یزدانی
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
              <span>ساعت {timeStr}</span>
              <span>•</span>
              <span className="truncate">{dateStr}</span>
            </div>
          </div>
        </div>

        {/* Left side (Header Actions): Clean, compact and uncrowded */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <ThemeToggle />

          {user?.role === "ADMIN" && (
            <button
              onClick={() => router.push("/dashboard")}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 border border-transparent dark:border-slate-700 transition"
              title="ورود به پنل سرپرست"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            </button>
          )}

          <button
            onClick={handleLogout}
            className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-300 border border-transparent dark:border-rose-900/40 transition"
            title="خروج از شیفت"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
