"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export default function ThemeToggle({ className = "", showLabel = false }: ThemeToggleProps) {
  const [isDark, setIsDark] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    const hasDarkClass = document.documentElement.classList.contains("dark");
    setIsDark(hasDarkClass);
  }, []);

  function toggleTheme() {
    const nextDark = !isDark;
    setIsDark(nextDark);

    if (nextDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("care_theme", "dark");
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", "#090d16");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("care_theme", "light");
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", "#15803d");
    }
  }

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <button
        type="button"
        disabled
        className={`p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 opacity-60 transition ${className}`}
        aria-label="تغییر تم"
      >
        <Moon className="w-4 h-4" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`p-2 rounded-xl transition flex items-center gap-1.5 active:scale-95 ${
        isDark
          ? "bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 shadow-sm"
          : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 shadow-sm"
      } ${className}`}
      title={isDark ? "تغییر به حالت روز" : "تغییر به حالت شب (شیفت شب)"}
      aria-label={isDark ? "حالت روز" : "حالت شب"}
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-amber-400 transition-transform hover:rotate-45" />
      ) : (
        <Moon className="w-4 h-4 text-indigo-600 transition-transform hover:-rotate-12" />
      )}
      {showLabel && (
        <span className="text-xs font-bold">
          {isDark ? "حالت روز" : "شیفت شب"}
        </span>
      )}
    </button>
  );
}
