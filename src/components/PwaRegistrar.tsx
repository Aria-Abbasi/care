"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

export default function PwaRegistrar() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // 1. Register Service Worker
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("PWA Service Worker registered:", reg.scope);
        })
        .catch((err) => {
          console.error("PWA Service Worker registration failed:", err);
        });
    }

    // 2. Capture install prompt (Chrome on Desktop / Android)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      const dismissed = sessionStorage.getItem("care_pwa_dismissed");
      if (!dismissed) {
        setShowBanner(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  async function handleInstallClick() {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
      setInstallPrompt(null);
    }
  }

  function handleDismiss() {
    setShowBanner(false);
    sessionStorage.setItem("care_pwa_dismissed", "true");
  }

  if (!showBanner || !installPrompt) return null;

  return (
    <div className="fixed bottom-5 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-50 bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-3xl shadow-2xl border border-slate-700/60 flex items-center justify-between gap-3 animate-in slide-in-from-bottom-5 duration-300">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-2xl bg-care-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-care-600/30">
          <Download className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black truncate">نصب اپلیکیشن مراقبت</p>
          <p className="text-[10px] text-slate-300 truncate">نصب مستقیم روی دستگاه و دسترسی سریع</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={handleInstallClick}
          className="px-3.5 py-1.5 rounded-xl bg-care-600 hover:bg-care-500 text-white font-black text-xs transition active:scale-95 shadow-xs"
        >
          نصب
        </button>
        <button
          onClick={handleDismiss}
          className="p-1.5 rounded-xl text-slate-400 hover:text-white transition"
          title="بستن"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
