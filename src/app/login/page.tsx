"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { HeartPulse, AlertCircle, ArrowLeft, Lock, User } from "lucide-react";

function LoginForm() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "نام کاربری یا رمز عبور اشتباه است");
        setLoading(false);
        return;
      }

      // Automatically route according to role
      if (from) {
        window.location.href = from;
      } else if (data.user.role === "ADMIN") {
        window.location.href = "/admin/dashboard";
      } else {
        window.location.href = "/nurse/timeline";
      }
    } catch {
      setError("خطا در برقراری ارتباط با سرور");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 p-6 sm:p-8">
      {/* Medical Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-care-600 text-white shadow-lg shadow-care-600/30 mb-3">
          <HeartPulse className="w-9 h-9" />
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          سامانه مراقبت در منزل
        </h1>
        <p className="text-sm font-semibold text-emerald-700 mt-1">
          پرونده مراقبتی آقای جواد یزدانی
        </p>
      </div>

      {error && (
        <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Unified Single Login Form */}
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            نام کاربری
          </label>
          <div className="relative">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="نام کاربری خود را وارد کنید"
              className="w-full px-4 py-3.5 pr-11 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-care-500 text-sm font-medium bg-slate-50 focus:bg-white transition"
              required
              autoFocus
            />
            <User className="w-5 h-5 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            رمز عبور
          </label>
          <div className="relative">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3.5 pr-11 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-care-500 text-sm font-medium bg-slate-50 focus:bg-white transition text-left font-mono"
              dir="ltr"
              required
            />
            <Lock className="w-5 h-5 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !username || !password}
          className="w-full mt-2 py-4 px-4 rounded-2xl bg-care-600 hover:bg-care-700 disabled:opacity-50 text-white font-black shadow-lg shadow-care-600/30 flex items-center justify-center gap-2 transition active:scale-[0.98]"
        >
          {loading ? (
            <span className="text-sm">در حال ورود...</span>
          ) : (
            <>
              <span className="text-sm">ورود به سامانه</span>
              <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col justify-center items-center p-4 bg-gradient-to-br from-emerald-50 via-slate-50 to-teal-50">
      <Suspense fallback={<div className="p-8 text-center text-slate-500">در حال بارگذاری...</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
