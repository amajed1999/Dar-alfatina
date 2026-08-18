"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setUserRole,
  setUserActive,
  createStaffUser,
} from "@/app/(app)/users/actions";

type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role_id: string | null;
  role_name: string | null;
  is_active: boolean;
  created_at: string;
};

type Role = { id: string; name_ar: string; key: string };

export default function UsersTable({
  currentUserId,
  users,
  roles,
}: {
  currentUserId: string;
  users: UserRow[];
  roles: Role[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // نموذج إضافة موظف
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role_id: "",
  });
  const [addErr, setAddErr] = useState<string | null>(null);
  const [addMsg, setAddMsg] = useState<string | null>(null);

  function onAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAddErr(null);
    setAddMsg(null);
    if (!form.role_id) {
      setAddErr("اختر دور الموظف.");
      return;
    }
    startTransition(async () => {
      const res = await createStaffUser(form);
      if (!res.ok) {
        setAddErr(res.error ?? "تعذّر إنشاء الحساب");
        return;
      }
      setAddMsg(`تم إنشاء حساب ${form.full_name} بنجاح.`);
      setForm({ full_name: "", email: "", password: "", role_id: "" });
      router.refresh();
    });
  }

  function onRoleChange(userId: string, roleId: string) {
    setError(null);
    startTransition(async () => {
      const res = await setUserRole(userId, roleId || null);
      if (!res.ok) setError(res.error ?? "حدث خطأ");
    });
  }

  function onToggleActive(userId: string, next: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await setUserActive(userId, next);
      if (!res.ok) setError(res.error ?? "حدث خطأ");
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={() => {
            setShowAdd((s) => !s);
            setAddErr(null);
            setAddMsg(null);
          }}
          className="bg-primary hover:bg-[var(--primary-hover)] text-white rounded-lg px-4 py-2 text-sm font-medium transition"
        >
          {showAdd ? "إغلاق" : "➕ إضافة موظف"}
        </button>
      </div>

      {showAdd && (
        <form
          onSubmit={onAddSubmit}
          className="bg-card border border-border rounded-xl p-4 grid gap-3 sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <p className="text-sm font-medium">إنشاء حساب موظف جديد</p>
            <p className="text-xs text-muted mt-0.5">
              يُنشأ الحساب مفعّلاً فوراً بالدور المحدّد. سلّم الموظف بريده وكلمة المرور
              ليدخل من صفحة الدخول.
            </p>
          </div>
          <label className="text-sm">
            <span className="text-muted">الاسم الكامل</span>
            <input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              required
              className="mt-1 w-full border border-border rounded-lg px-3 py-2 bg-card outline-none focus:border-primary"
            />
          </label>
          <label className="text-sm">
            <span className="text-muted">الدور</span>
            <select
              value={form.role_id}
              onChange={(e) => setForm({ ...form, role_id: e.target.value })}
              required
              className="mt-1 w-full border border-border rounded-lg px-3 py-2 bg-card outline-none focus:border-primary"
            >
              <option value="">— اختر الدور —</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name_ar}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-muted">البريد الإلكتروني</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              dir="ltr"
              placeholder="employee@example.com"
              className="mt-1 w-full border border-border rounded-lg px-3 py-2 bg-card outline-none focus:border-primary"
            />
          </label>
          <label className="text-sm">
            <span className="text-muted">كلمة المرور (8 أحرف على الأقل)</span>
            <input
              type="text"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={8}
              dir="ltr"
              className="mt-1 w-full border border-border rounded-lg px-3 py-2 bg-card outline-none focus:border-primary"
            />
          </label>
          {addErr && (
            <p className="sm:col-span-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {addErr}
            </p>
          )}
          {addMsg && (
            <p className="sm:col-span-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
              {addMsg}
            </p>
          )}
          <div className="sm:col-span-2">
            <button
              disabled={pending}
              className="bg-primary hover:bg-[var(--primary-hover)] text-white rounded-lg px-6 py-2.5 text-sm font-medium transition disabled:opacity-60"
            >
              {pending ? "جارٍ الإنشاء…" : "إنشاء الحساب"}
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-background text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">الاسم</th>
                <th className="px-4 py-3 font-medium">البريد</th>
                <th className="px-4 py-3 font-medium">الدور</th>
                <th className="px-4 py-3 font-medium">الحالة</th>
                <th className="px-4 py-3 font-medium">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === currentUserId;
                return (
                  <tr key={u.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      {u.full_name ?? "—"}
                      {isSelf && (
                        <span className="text-xs text-primary mr-1">(أنت)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted" dir="ltr">
                      {u.email}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role_id ?? ""}
                        disabled={pending || isSelf}
                        onChange={(e) => onRoleChange(u.id, e.target.value)}
                        className="border border-border rounded-lg px-2 py-1.5 bg-card disabled:opacity-60"
                      >
                        <option value="">— بلا دور —</option>
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name_ar}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {u.is_active ? (
                        <span className="text-xs bg-green-50 text-green-700 rounded-full px-2.5 py-1">
                          مفعّل
                        </span>
                      ) : (
                        <span className="text-xs bg-amber-50 text-amber-700 rounded-full px-2.5 py-1">
                          غير مفعّل
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        disabled={pending || isSelf}
                        onClick={() => onToggleActive(u.id, !u.is_active)}
                        className="text-sm border border-border rounded-lg px-3 py-1.5 hover:bg-background transition disabled:opacity-40"
                      >
                        {u.is_active ? "تعطيل" : "تفعيل"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted">
                    لا يوجد مستخدمون بعد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
