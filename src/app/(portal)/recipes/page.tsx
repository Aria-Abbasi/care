"use client";

import { useEffect, useState, useCallback } from "react";
import { UtensilsCrossed, Sparkles, Plus, X, Coffee, Salad } from "lucide-react";

interface Diet {
  id: string;
  mealType: string;
  title: string;
  description?: string | null;
  instructions?: string | null;
}

interface Smoothie {
  id: string;
  title: string;
  ingredients: string;
  instructions?: string | null;
}

export default function AdminRecipesPage() {
  const [diets, setDiets] = useState<Diet[]>([]);
  const [smoothies, setSmoothies] = useState<Smoothie[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"diet" | "smoothie">("diet");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userRole, setUserRole] = useState<string>("ADMIN");

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formType, setFormType] = useState<"LUNCH" | "DINNER" | "SMOOTHIE">("LUNCH");
  const [formIngredients, setFormIngredients] = useState("");

  const fetchRecipes = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/recipes");
      if (res.ok) {
        const data = await res.json();
        setDiets(data.diets || []);
        setSmoothies(data.smoothies || []);
      }
    } catch (err) {
      console.error("Failed to load recipes:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user?.role) setUserRole(data.user.role);
      })
      .catch(() => {});

    fetchRecipes();
  }, [fetchRecipes]);

  async function handleCreateRecipe() {
    if (!formTitle) return;

    try {
      if (formType === "SMOOTHIE") {
        await fetch("/api/admin/recipes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "smoothie",
            title: formTitle,
            ingredients: formIngredients,
          }),
        });
      } else {
        await fetch("/api/admin/recipes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "diet",
            title: formTitle,
            mealType: formType,
          }),
        });
      }

      setIsModalOpen(false);
      setFormTitle("");
      setFormIngredients("");
      fetchRecipes();
    } catch (err) {
      console.error("Failed to save recipe:", err);
    }
  }

  const lunches = diets.filter((d) => d.mealType === "LUNCH");
  const dinners = diets.filter((d) => d.mealType === "DINNER");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <UtensilsCrossed className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            <span>دستور غذاها و اسموتی‌های مقوی</span>
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 mt-1">
            برنامه غذایی استاندارد ناهار، شام و ترکیبات اسموتی میان‌وعده بیمار
          </p>
        </div>

        {userRole === "ADMIN" && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2.5 rounded-2xl bg-care-600 hover:bg-care-700 text-white font-bold text-xs shadow-md shadow-care-600/30 flex items-center gap-1.5 transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>افزودن دستور جدید</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveTab("diet")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition ${
            activeTab === "diet"
              ? "bg-slate-900 dark:bg-slate-700 text-white shadow-sm"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Salad className="w-4 h-4 text-emerald-400" />
          <span>غذاهای اصلی (ناهار و شام)</span>
        </button>

        <button
          onClick={() => setActiveTab("smoothie")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition ${
            activeTab === "smoothie"
              ? "bg-slate-900 dark:bg-slate-700 text-white shadow-sm"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>اسموتی‌های میان‌وعده</span>
        </button>
      </div>

      {/* Diet Content */}
      {activeTab === "diet" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Lunch List */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-base font-black text-slate-900 dark:text-slate-100 mb-3 pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>پیشنهادهای ناهار</span>
            </h2>
            <div className="space-y-2">
              {lunches.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200"
                >
                  {item.title}
                </div>
              ))}
            </div>
          </div>

          {/* Dinner List */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-base font-black text-slate-900 dark:text-slate-100 mb-3 pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
              <span>پیشنهادهای شام</span>
            </h2>
            <div className="space-y-2">
              {dinners.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200"
                >
                  {item.title}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Smoothies Content */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {smoothies.map((sm) => (
            <div
              key={sm.id}
              className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition flex flex-col justify-between"
            >
              <div>
                <h2 className="text-sm font-black text-emerald-900 dark:text-emerald-300 flex items-center gap-2 mb-2">
                  <Coffee className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{sm.title}</span>
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed bg-emerald-50/40 dark:bg-emerald-950/30 p-3 rounded-2xl border border-emerald-100 dark:border-emerald-900/40">
                  {sm.ingredients}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-6 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h2 className="text-base font-black text-slate-900 dark:text-slate-100">افزودن دستور جدید</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">نوع غذا / نوشیدنی</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 outline-none"
                >
                  <option value="LUNCH">ناهار</option>
                  <option value="DINNER">شام</option>
                  <option value="SMOOTHIE">اسموتی میان‌وعده</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">عنوان غذا یا اسموتی</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="مثلاً اسموتی سیب و زنجبیل یا سوپ جو"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 outline-none"
                />
              </div>

              {formType === "SMOOTHIE" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">ترکیبات و مواد لازم</label>
                  <textarea
                    rows={3}
                    value={formIngredients}
                    onChange={(e) => setFormIngredients(e.target.value)}
                    placeholder="کرفس: ۱ خوشه&#10;سیب: ۲ عدد&#10;زنجبیل: کم"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 outline-none"
                  />
                </div>
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                انصراف
              </button>
              <button
                onClick={handleCreateRecipe}
                className="px-5 py-2.5 rounded-xl bg-care-600 hover:bg-care-700 text-white font-bold text-xs shadow-md shadow-care-600/30 transition active:scale-95"
              >
                ذخیره دستور
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
