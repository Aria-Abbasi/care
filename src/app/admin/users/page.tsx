"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, UserPlus, Check, X, Shield, UserCheck, Key } from "lucide-react";
import { formatJalaliDateTime } from "@/lib/jalali";

interface UserItem {
  id: string;
  username: string;
  fullName: string;
  role: "ADMIN" | "NURSE";
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
  const [formRole, setFormRole] = useState<"NURSE" | "ADMIN">("NURSE");

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
    if (!formUsername || !formPassword || !formFullName) return;

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formUsername,
          password: formPassword,
          fullName: formFullName,
          role: formRole,
        }),
      });

      if (res.ok) {
        setIsModalOpen(false);
        setFormUsername("");
        setFormPassword("");
        setFormFullName("");
        fetchUsers();
      }
    } catch (err) {
      console.error("Failed to create user:", err);
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
      fetchUsers();
    } catch (err) {
      console.error("Failed to toggle user:", err);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-600" />
            <span>مدیریت حساب پرستاران و کاربران سامانه</span>
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-slate-500 mt-1">
            تعریف حساب برای پرستاران جدید شیفت و انتساب خودکار اقدامات پای تخت به هویت آنان
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 rounded-2xl bg-care-600 hover:bg-care-700 text-white font-bold text-xs shadow-md shadow-care-600/30 flex items-center gap-1.5 transition active:scale-95"
        >
          <UserPlus className="w-4 h-4" />
          <span>افزودن پرستار جدید</span>
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
              <tr>
                <th className="p-4">نام و نام خانوادگی</th>
                <th className="p-4">نام کاربری</th>
                <th className="p-4">نقش</th>
                <th className="p-4">وضعیت</th>
                <th className="p-4">تاریخ عضویت</th>
                <th className="p-4 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50">
                  <td className="p-4 font-black text-slate-900 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                      {u.fullName.charAt(0)}
                    </div>
                    <span>{u.fullName}</span>
                  </td>
                  <td className="p-4 font-mono font-bold text-slate-700" dir="ltr">
                    {u.username}
                  </td>
                  <td className="p-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold ${
                        u.role === "ADMIN"
                          ? "bg-slate-900 text-white"
                          : "bg-emerald-100 text-emerald-900"
                      }`}
                    >
                      {u.role === "ADMIN" ? <Shield className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                      <span>{u.role === "ADMIN" ? "سرپرست / خانواده" : "پرستار"}</span>
                    </span>
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        u.isActive
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {u.isActive ? "فعال" : "غیرفعال"}
                    </span>
                  </td>
                  <td className="p-4 text-slate-500">{formatJalaliDateTime(u.createdAt)}</td>
                  <td className="p-4 text-center">
                    {u.username !== "admin" && (
                      <button
                        onClick={() => toggleUserActive(u)}
                        className={`px-3 py-1 rounded-xl text-[11px] font-bold transition ${
                          u.isActive
                            ? "text-rose-700 hover:bg-rose-50"
                            : "text-emerald-700 hover:bg-emerald-50"
                        }`}
                      >
                        {u.isActive ? "غیرفعال‌سازی" : "فعال‌سازی"}
                      </button>
                    )}
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
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h2 className="text-base font-black text-slate-900">تعریف پرستار یا کاربر جدید</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نام و نام خانوادگی</label>
                <input
                  type="text"
                  value={formFullName}
                  onChange={(e) => setFormFullName(e.target.value)}
                  placeholder="مثلاً پرستار احمدی"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 focus:bg-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نام کاربری (انگلیسی)</label>
                <input
                  type="text"
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  placeholder="nurse2"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 focus:bg-white outline-none"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رمز عبور</label>
                <input
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 focus:bg-white outline-none"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نقش دسترسی</label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 focus:bg-white outline-none"
                >
                  <option value="NURSE">پرستار (فقط ثبت پای تخت)</option>
                  <option value="ADMIN">سرپرست (دسترسی کامل به داشبورد و انبار)</option>
                </select>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-slate-600 text-xs font-bold hover:bg-slate-100"
              >
                انصراف
              </button>
              <button
                onClick={handleCreateUser}
                className="px-5 py-2.5 rounded-xl bg-care-600 hover:bg-care-700 text-white font-bold text-xs shadow-md shadow-care-600/30"
              >
                ایجاد حساب
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
