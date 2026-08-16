"use client";

import { useMemo, useState, useTransition } from "react";
import { togglePermission, createRole } from "@/app/(app)/roles/actions";
import { MODULE_LABELS } from "@/lib/permissions";

type Role = { id: string; name_ar: string; key: string; is_system: boolean };
type Permission = { id: string; key: string; module: string; name_ar: string };
type RolePerm = { role_id: string; permission_id: string };

export default function RolesManager({
  roles,
  permissions,
  rolePerms,
}: {
  roles: Role[];
  permissions: Permission[];
  rolePerms: RolePerm[];
}) {
  const [selectedRoleId, setSelectedRoleId] = useState<string>(
    roles[0]?.id ?? "",
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // مجموعة صلاحيات الدور المختار (تحديث محلّي فوري)
  const initialSet = useMemo(() => {
    const s = new Set<string>();
    rolePerms
      .filter((rp) => rp.role_id === selectedRoleId)
      .forEach((rp) => s.add(rp.permission_id));
    return s;
  }, [rolePerms, selectedRoleId]);

  const [granted, setGranted] = useState<Set<string>>(initialSet);

  // إعادة المزامنة عند تغيير الدور
  const [lastRole, setLastRole] = useState(selectedRoleId);
  if (lastRole !== selectedRoleId) {
    setLastRole(selectedRoleId);
    setGranted(initialSet);
  }

  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  const isAdminRole = selectedRole?.key === "admin";

  // تجميع الصلاحيات حسب الوحدة
  const grouped = useMemo(() => {
    const m = new Map<string, Permission[]>();
    for (const p of permissions) {
      if (!m.has(p.module)) m.set(p.module, []);
      m.get(p.module)!.push(p);
    }
    return [...m.entries()];
  }, [permissions]);

  function toggle(permId: string) {
    if (isAdminRole) return; // دور المدير يملك كل شيء دائماً
    const next = new Set(granted);
    const enabled = !next.has(permId);
    if (enabled) next.add(permId);
    else next.delete(permId);
    setGranted(next);
    setError(null);
    startTransition(async () => {
      const res = await togglePermission(selectedRoleId, permId, enabled);
      if (!res.ok) {
        setError(res.error ?? "حدث خطأ");
        setGranted(granted); // تراجع
      }
    });
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-5">
      {/* قائمة الأدوار */}
      <div className="space-y-4">
        <div className="bg-card border border-border rounded-xl p-2">
          {roles.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedRoleId(r.id)}
              className={`w-full text-right px-3 py-2 rounded-lg text-sm transition flex items-center justify-between ${
                r.id === selectedRoleId
                  ? "bg-primary text-white"
                  : "hover:bg-background"
              }`}
            >
              {r.name_ar}
              {r.is_system && (
                <span
                  className={`text-[10px] rounded px-1.5 py-0.5 ${
                    r.id === selectedRoleId ? "bg-white/20" : "bg-border"
                  }`}
                >
                  أساسي
                </span>
              )}
            </button>
          ))}
        </div>
        <NewRoleForm />
      </div>

      {/* صلاحيات الدور المختار */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">
            صلاحيات: {selectedRole?.name_ar ?? "—"}
          </h2>
          {pending && <span className="text-xs text-muted">جارٍ الحفظ…</span>}
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">
            {error}
          </p>
        )}

        {isAdminRole && (
          <p className="text-sm text-muted bg-background rounded-lg px-3 py-2 mb-4">
            دور «مدير النظام» يملك جميع الصلاحيات دائماً ولا يمكن تقييده.
          </p>
        )}

        <div className="space-y-5">
          {grouped.map(([module, perms]) => (
            <div key={module}>
              <p className="text-sm font-semibold text-primary mb-2">
                {MODULE_LABELS[module] ?? module}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {perms.map((p) => {
                  const on = isAdminRole || granted.has(p.id);
                  return (
                    <label
                      key={p.id}
                      className={`flex items-center gap-2 text-sm border border-border rounded-lg px-3 py-2 cursor-pointer ${
                        isAdminRole ? "opacity-70 cursor-not-allowed" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={isAdminRole || pending}
                        onChange={() => toggle(p.id)}
                        className="accent-[var(--primary)]"
                      />
                      {p.name_ar}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NewRoleForm() {
  const [nameAr, setNameAr] = useState("");
  const [key, setKey] = useState("");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const res = await createRole(nameAr, key);
      if (res.ok) {
        setNameAr("");
        setKey("");
        setMsg("تم إنشاء الدور.");
      } else {
        setMsg(res.error ?? "حدث خطأ");
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      className="bg-card border border-border rounded-xl p-3 space-y-2"
    >
      <p className="text-sm font-semibold">إضافة دور جديد</p>
      <input
        value={nameAr}
        onChange={(e) => setNameAr(e.target.value)}
        placeholder="الاسم بالعربية"
        className="w-full border border-border rounded-lg px-2 py-1.5 text-sm"
      />
      <input
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder="المفتاح (إنجليزي)"
        dir="ltr"
        className="w-full border border-border rounded-lg px-2 py-1.5 text-sm"
      />
      <button
        disabled={pending}
        className="w-full bg-primary text-white rounded-lg py-1.5 text-sm disabled:opacity-60"
      >
        {pending ? "…" : "إضافة"}
      </button>
      {msg && <p className="text-xs text-muted">{msg}</p>}
    </form>
  );
}
