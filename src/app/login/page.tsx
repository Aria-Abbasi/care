"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HeartPulse, ShieldCheck, UserCheck, AlertCircle, ArrowLeft } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(u = username, p = password) {
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "ورود ناموفق بود");
        setLoading(false);
        return;
      }

      if (from) {
        router.push(from);
      } else if (data.user.role === "ADMIN") {
        router.push("/admin/dashboard");
      } else {
        router.push("/nurse/timeline");
      }
    } catch {
      setError("خطا در برقراری ارتباط با سرور");
      setLoading(false);
    }
  }

  function quickLogin(u: string, p: string) {
    setUsername(u);
    setPassword(p);
    handleLogin(u, p);
  }

  return (
    <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 p-6 sm:p-8">
      {/* Header with Medical Icon */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-care-500 text-white shadow-lg shadow-care-500/30 mb-3">
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
        <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Quick 1-Tap Login Presets */}
      <div className="mb-6 space-y-2">
        <p className="text-xs font-semibold text-slate-500 text-center mb-2">
          ورود سریع پای تخت بیمار (تک لمس):
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => quickLogin("nurse", "Nurse@Care2026!")}
            disabled={loading}
            className="flex flex-col items-center justify-center p-3.5 rounded-2xl border-2 border-emerald-500 bg-emerald-50/50 hover:bg-emerald-100 text-emerald-900 transition active:scale-95 text-center font-bold"
          >
            <UserCheck className="w-6 h-6 text-emerald-600 mb-1" />
            <span className="text-sm">ورود پرستار</span>
            <span className="text-[11px] text-emerald-600 font-normal">شیفت پای تخت</span>
          </button>

          <button
            type="button"
            onClick={() => quickLogin("admin", "Admin@Care2026!")}
            disabled={loading}
            className="flex flex-col items-center justify-center p-3.5 rounded-2xl border-2 border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-900 transition active:scale-95 text-center font-bold"
          >
            <ShieldCheck className="w-6 h-6 text-slate-700 mb-1" />
            <span className="text-sm">ورود سرپرست</span>
            <span className="text-[11px] text-slate-500 font-normal">داشبورد و گزارشات</span>
          </button>
        </div>
      </div>

      <div className="relative my-6 text-center">
        <hr className="border-slate-200" />
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-3 text-xs text-slate-400">
          یا با نام کاربری دلخواه
        </span>
      </div>

      {/* Standard Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleLogin();
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            نام کاربری
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="مثلاً nurse یا admin"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-care-500 text-sm font-medium bg-slate-50 focus:bg-white transition"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            رمز عبور
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-care-500 text-sm font-medium bg-slate-50 focus:bg-white transition text-left"
            dir="ltr"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 px-4 rounded-xl bg-care-600 hover:bg-care-700 active:scale-[0.98] text-white font-bold shadow-md shadow-care-600/30 flex items-center justify-center gap-2 transition"
        >
          {loading ? (
            <span className="text-sm">در حال ورود...</span>
          ) : (
            <>
              <span className="text-sm">ورود به سامانه</span>
              <ArrowLeft className="w-4 h-4" />
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
