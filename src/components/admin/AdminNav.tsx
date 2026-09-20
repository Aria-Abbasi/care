"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Pill, Users, UtensilsCrossed,
  FileText, Stethoscope, LogOut, HeartPulse, CalendarClock
} from "lucide-react";
import { useEffect, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [userRole, setUserRole] = useState<string>("ADMIN");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user?.role) setUserRole(data.user.role);
      })
      .catch(() => {});
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const navItems = [
    { href: "/dashboard", label: "تحلیل و نمودارها", icon: LayoutDashboard },
    { href: "/schedules", label: "برنامه تسک‌ها", icon: CalendarClock },
    { href: "/medications", label: "پروتکل داروها و انبار", icon: Pill },
    { href: "/recipes", label: "رژیم و اسموتی‌ها", icon: UtensilsCrossed },
    { href: "/report", label: "گزارش پزشک معالج", icon: FileText },
    ...(userRole === "ADMIN" ? [{ href: "/users", label: "کاربران", icon: Users }] : []),
  ];

  return (
    <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 shadow-sm transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/30">
              <HeartPulse className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-black text-slate-900 dark:text-slate-100 leading-tight">
                سامانه مراقبت در منزل
              </div>
              <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                پرونده آقای جواد یزدانی ({userRole === "ADMIN" ? "سرپرستی" : "مشاهده و گزارش"})
              </div>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                    isActive
                      ? "bg-slate-900 dark:bg-emerald-600 text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-emerald-400 dark:text-white" : "text-slate-500 dark:text-slate-400"}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Right quick actions */}
          <div className="flex items-center gap-2">
            <ThemeToggle />

            <Link
              href="/nurse/timeline"
              className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800/60 transition"
              title="نمای پای تخت بیمار (تایم‌لاین پرستار)"
            >
              <Stethoscope className="w-4 h-4" />
            </Link>

            <button
              onClick={handleLogout}
              className="p-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition"
              title="خروج از حساب"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav Scroller */}
      <div className="md:hidden flex items-center gap-1 px-4 py-2 overflow-x-auto border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 scrollbar-none">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1 px-3 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap transition ${
                isActive
                  ? "bg-slate-900 dark:bg-emerald-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white dark:hover:bg-slate-800 bg-white/70 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60"
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? "text-emerald-400 dark:text-white" : "text-slate-500 dark:text-slate-400"}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
