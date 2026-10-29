"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, UserPlus, Check, X, Shield, UserCheck, Key, Eye, EyeOff, AlertCircle } from "lucide-react";
import { formatJalaliDateTime } from "@/lib/jalali";

interface UserItem {
  id: string;
  username: string;
  fullName: string;
  role: "ADMIN" | "NURSE" | "VIEWER";
  isActive: boolean;
  createdAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formFullName, setFormFullName] = useState("");
  const [formRole, setFormRole] = useState<"ADMIN" | "NURSE" | "VIEWER">("NURSE");
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Change Password state
  const [changePasswordUser, setChangePasswordUser] = useState<UserItem | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleCreateUser() {
    setCreateError(null);
    if (!formUsername.trim() || !formPassword.trim() || !formFullName.trim()) {
      setCreateError("لطفاً تمامی فیلدها را تکمیل کنید.");
      return;
    }

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formUsername.trim(),
          password: formPassword.trim(),
          fullName: formFullName.trim(),
          role: formRole,
        }),
      });

      if (res.ok) {
        setIsModalOpen(false);
        setFormUsername("");
        setFormPassword("");
        setFormFullName("");
        setFormRole("NURSE");
        setShowCreatePassword(false);
        showToast("کاربر جدید با موفقیت ایجاد شد");
        fetchUsers();
      } else {
        const err = await res.json();
        setCreateError(err.error || "خطا در ایجاد کاربر");
      }
    } catch (err) {
      console.error("Failed to create user:", err);
      setCreateError("خطای ارتباط با سرور");
    }
  }

  async function handleChangePassword() {
    if (!changePasswordUser || !newPassword.trim()) {
      setChangePasswordError("رمز عبور جدید را وارد کنید.");
      return;
    }
    if (newPassword.trim().length < 4) {
      setChangePasswordError("رمز عبور جدید باید حداقل ۴ کاراکتر باشد.");
      return;
    }

    try {
      setChangePasswordLoading(true);
      setChangePasswordError(null);
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: changePasswordUser.id,
          password: newPassword.trim(),
        }),
      });

      if (res.ok) {
        setChangePasswordUser(null);
        setNewPassword("");
        setShowNewPassword(false);
        showToast(`رمز عبور کاربر «${changePasswordUser.fullName}» با موفقیت تغییر یافت`);
      } else {
        const err = await res.json();
        setChangePasswordError(err.error || "خطا در تغییر رمز عبور");
      }
    } catch (err) {
      console.error("Failed to change password:", err);
      setChangePasswordError("خطای ارتباط با سرور");
    } finally {
      setChangePasswordLoading(false);
    }
  }

  async function toggleUserActive(user: UserItem) {
    try {
      await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: user.id,
          isActive: !user.isActive,
        }),
      });
      showToast(user.isActive ? "کاربر غیرفعال شد" : "کاربر فعال شد");
      fetchUsers();
    } catch (err) {
      console.error("Failed to toggle user:", err);
    }
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-emerald-900/90 backdrop-blur-md text-white font-bold text-sm shadow-2xl flex items-center gap-2 border border-emerald-500/40 animate-bounce">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            <span>مدیریت کاربران و سطح دسترسی</span>
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 mt-1">
            تعریف حساب‌های کاربری با سه سطح دسترسی (مدیر، پرستار، مشاهده‌کننده) و مدیریت رمزهای عبور
          </p>
        </div>

        <button
          onClick={() => {
            setCreateError(null);
            setIsModalOpen(true);
          }}
          className="px-4 py-2.5 rounded-2xl bg-care-600 hover:bg-care-700 text-white font-bold text-xs shadow-md shadow-care-600/30 flex items-center gap-1.5 transition active:scale-95"
        >
          <UserPlus className="w-4 h-4" />
          <span>افزودن کاربر جدید</span>
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold">
              <tr>
                <th className="p-4">نام و نام خانوادگی</th>
                <th className="p-4">نام کاربری</th>
                <th className="p-4">سطح کاربری (نقش)</th>
                <th className="p-4">وضعیت</th>
                <th className="p-4">تاریخ عضویت</th>
                <th className="p-4 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                  <td className="p-4 font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-bold">
                      {u.fullName.charAt(0)}
                    </div>
                    <span>{u.fullName}</span>
                  </td>
                  <td className="p-4 font-mono font-bold text-slate-700 dark:text-slate-300" dir="ltr">
                    {u.username}
                  </td>
                  <td className="p-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold ${
                        u.role === "ADMIN"
                          ? "bg-slate-900 dark:bg-slate-700 text-white shadow-2xs"
                          : u.role === "VIEWER"
                          ? "bg-sky-100 dark:bg-sky-950/60 text-sky-900 dark:text-sky-200 border border-sky-200 dark:border-sky-800"
                          : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200"
                      }`}
                    >
                      {u.role === "ADMIN" ? (
                        <Shield className="w-3 h-3 text-amber-400" />
                      ) : u.role === "VIEWER" ? (
                        <Eye className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                      ) : (
                        <UserCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      )}
                      <span>
                        {u.role === "ADMIN"
                          ? "مدیر"
                          : u.role === "VIEWER"
                          ? "مشاهده‌کننده"
                          : "پرستار"}
                      </span>
                    </span>
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        u.isActive
                          ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                          : "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300"
                      }`}
                    >
                      {u.isActive ? "فعال" : "غیرفعال"}
                    </span>
                  </td>
                  <td className="p-4 text-slate-500 dark:text-slate-400">{formatJalaliDateTime(u.createdAt)}</td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => {
                          setChangePasswordUser(u);
                          setNewPassword("");
                          setShowNewPassword(false);
                          setChangePasswordError(null);
                        }}
                        className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-bold transition flex items-center gap-1 active:scale-95 text-[11px]"
                        title="تغییر رمز عبور کاربر"
                      >
                        <Key className="w-3.5 h-3.5 text-indigo-500" />
                        <span>تغییر رمز</span>
                      </button>

                      {u.username !== "admin" && (
                        <button
                          onClick={() => toggleUserActive(u)}
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition ${
                            u.isActive
                              ? "text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                              : "text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                          }`}
                        >
                          {u.isActive ? "غیرفعال‌سازی" : "فعال‌سازی"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-6 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h2 className="text-base font-black text-slate-900 dark:text-slate-100">تعریف کاربر جدید سامانه</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="p-3 mb-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">نام و نام خانوادگی</label>
                <input
                  type="text"
                  value={formFullName}
                  onChange={(e) => setFormFullName(e.target.value)}
                  placeholder="نام و نام خانوادگی..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">نام کاربری (انگلیسی)</label>
                <input
                  type="text"
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  placeholder="username"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 outline-none"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">رمز عبور</label>
                <div className="relative">
                  <input
                    type={showCreatePassword ? "text" : "password"}
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="رمز ورود..."
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 outline-none"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePassword(!showCreatePassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                    title={showCreatePassword ? "مخفی‌سازی رمز" : "نمایش رمز"}
                  >
                    {showCreatePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">سطح کاربری (نقش)</label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 outline-none"
                >
                  <option value="ADMIN">مدیر (دسترسی کامل به تعریف، تغییر و حذف)</option>
                  <option value="NURSE">پرستار (ثبت بالینی و اجرای تسک‌های پای تخت)</option>
                  <option value="VIEWER">مشاهده‌کننده (فقط مشاهده گزارشات و پرونده، بدون امکان تغییر)</option>
                </select>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  مشاهده‌کننده می‌تواند گزارشات را ببیند اما دکمه‌ها و فرم‌های ویرایش برای او غیرفعال است.
                </p>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                انصراف
              </button>
              <button
                onClick={handleCreateUser}
                className="px-5 py-2.5 rounded-xl bg-care-600 hover:bg-care-700 text-white font-bold text-xs shadow-md shadow-care-600/30 transition active:scale-95"
              >
                ایجاد حساب
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {changePasswordUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-6 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100">
                    تغییر رمز عبور کاربر
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {changePasswordUser.fullName} ({changePasswordUser.username})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setChangePasswordUser(null)}
                className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {changePasswordError && (
              <div className="p-3 mb-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{changePasswordError}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  رمز عبور جدید:
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="حداقل ۴ کاراکتر..."
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 outline-none"
                    dir="ltr"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                    title={showNewPassword ? "مخفی‌سازی رمز" : "نمایش رمز"}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  با فشردن آیکون چشم می‌توانید رمز تایپ‌شده را به وضوح بررسی کنید.
                </p>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                onClick={() => setChangePasswordUser(null)}
                className="px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                انصراف
              </button>
              <button
                onClick={handleChangePassword}
                disabled={changePasswordLoading}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition active:scale-95 disabled:opacity-50"
              >
                {changePasswordLoading ? "در حال ذخیره..." : "ذخیره رمز جدید"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
