"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HeartPulse, LogOut, Clock, Calendar, ShieldCheck } from "lucide-react";
import { formatJalaliLong, toPersianDigits } from "@/lib/jalali";

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
      // Explicitly format in Tehran timezone (UTC+3:30)
      setTimeStr(
        toPersianDigits(
          now.toLocaleTimeString("fa-IR", {
            timeZone: "Asia/Tehran",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
        )
      );
      setDateStr(formatJalaliLong(now));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm px-4 py-2.5">
      <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
        {/* Patient Profile Quick Summary */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/30 flex-shrink-0">
            <HeartPulse className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-black text-slate-900 leading-tight truncate">
              آقای جواد یزدانی
            </h1>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                {dateStr || "امروز"}
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1 font-bold text-slate-700">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                <span>{timeStr}</span>
                <span className="text-[10px] text-slate-400 font-normal">(تهران)</span>
              </span>
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {user?.role === "ADMIN" && (
            <button
              onClick={() => router.push("/admin/dashboard")}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              title="ورود به پنل سرپرست"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
            </button>
          )}

          <button
            onClick={handleLogout}
            className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition"
            title="خروج از شیفت"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
