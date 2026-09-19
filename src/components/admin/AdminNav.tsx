"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Pill, UtensilsCrossed, Users,
  FileText, Stethoscope, LogOut, HeartPulse, CalendarClock
} from "lucide-react";

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const navItems = [
    { href: "/admin/dashboard", label: "تحلیل و نمودارها", icon: LayoutDashboard },
    { href: "/admin/schedules", label: "برنامه تسک‌ها", icon: CalendarClock },
    { href: "/admin/medications", label: "پروتکل داروها و انبار", icon: Pill },
    { href: "/admin/recipes", label: "رژیم و اسموتی‌ها", icon: UtensilsCrossed },
    { href: "/admin/users", label: "پرستاران و کاربران", icon: Users },
    { href: "/admin/report", label: "گزارش پزشک معالج", icon: FileText },
  ];

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/30">
              <HeartPulse className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-black text-slate-900 leading-tight">
                سامانه مراقبت در منزل
              </div>
              <div className="text-[11px] font-bold text-emerald-700">
                پرونده آقای جواد یزدانی (سرپرستی)
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
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-emerald-400" : "text-slate-500"}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Right quick actions */}
          <div className="flex items-center gap-2">
            <Link
              href="/nurse/timeline"
              className="p-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 border border-emerald-200 transition"
              title="نمای پای تخت بیمار (تایم‌لاین پرستار)"
            >
              <Stethoscope className="w-4 h-4" />
            </Link>

            <button
              onClick={handleLogout}
              className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 transition"
              title="خروج از حساب"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav Scroller */}
      <div className="md:hidden flex items-center gap-1 px-4 py-2 overflow-x-auto border-t border-slate-100 bg-slate-50/50 scrollbar-none">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1 px-3 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap transition ${
                isActive
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white bg-white/70 border border-slate-200/60"
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? "text-emerald-400" : "text-slate-500"}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
