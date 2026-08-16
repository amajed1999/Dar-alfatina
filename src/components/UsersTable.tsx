"use client";

import { useState, useTransition } from "react";
import { setUserRole, setUserActive } from "@/app/(app)/users/actions";

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
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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
