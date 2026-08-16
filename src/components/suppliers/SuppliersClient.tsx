"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import {
  createSupplier,
  updateSupplier,
  setSupplierActive,
  type SupplierPayload,
} from "@/app/(app)/suppliers/actions";

type Supplier = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
};

type Props = { suppliers: Supplier[]; canManage: boolean };

type FormState = {
  name: string;
  phone: string;
  address: string;
  notes: string;
  is_active: boolean;
};

const empty: FormState = {
  name: "",
  phone: "",
  address: "",
  notes: "",
  is_active: true,
};

export default function SuppliersClient({ suppliers, canManage }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.phone ?? "").includes(q),
    );
  }, [suppliers, query]);

  function openNew() {
    setEditingId(null);
    setForm(empty);
    setError(null);
    setOpen(true);
  }
  function openEdit(s: Supplier) {
    setEditingId(s.id);
    setForm({
      name: s.name,
      phone: s.phone ?? "",
      address: s.address ?? "",
      notes: s.notes ?? "",
      is_active: s.is_active,
    });
    setError(null);
    setOpen(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) return setError("اسم المورد مطلوب.");
    const payload: SupplierPayload = {
      name: form.name,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
      is_active: form.is_active,
    };
    startTransition(async () => {
      const res = editingId
        ? await updateSupplier(editingId, payload)
        : await createSupplier(payload);
      if (!res.ok) return setError(res.error ?? "حدث خطأ");
      setOpen(false);
      router.refresh();
    });
  }

  function toggle(s: Supplier) {
    startTransition(async () => {
      const res = await setSupplierActive(s.id, !s.is_active);
      if (!res.ok) setError(res.error ?? "حدث خطأ");
      else router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">الموردون</h1>
          <p className="text-muted mt-1 text-sm">جهات التوريد المرتبطة بفواتير الشراء.</p>
        </div>
        {canManage && (
          <button
            onClick={openNew}
            className="bg-primary hover:bg-[var(--primary-hover)] text-white rounded-lg py-2.5 px-5 text-sm font-medium transition"
          >
            + مورد جديد
          </button>
        )}
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="بحث بالاسم أو الهاتف…"
        className="w-full sm:max-w-sm border border-border rounded-lg px-3 py-2 outline-none focus:border-primary bg-card"
      />

      {error && !open && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-background text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">الاسم</th>
                <th className="px-4 py-3 font-medium">الهاتف</th>
                <th className="px-4 py-3 font-medium">العنوان</th>
                <th className="px-4 py-3 font-medium">الحالة</th>
                {canManage && <th className="px-4 py-3 font-medium">إجراء</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-muted tabular" dir="ltr">
                    {s.phone ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">{s.address ?? "—"}</td>
                  <td className="px-4 py-3">
                    {s.is_active ? (
                      <span className="text-xs bg-green-50 text-green-700 rounded-full px-2.5 py-1">
                        نشط
                      </span>
                    ) : (
                      <span className="text-xs bg-border text-muted rounded-full px-2.5 py-1">
                        موقوف
                      </span>
                    )}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEdit(s)}
                          className="text-sm border border-border rounded-lg px-3 py-1.5 hover:bg-background transition"
                        >
                          تعديل
                        </button>
                        <button
                          disabled={pending}
                          onClick={() => toggle(s)}
                          className="text-sm border border-border rounded-lg px-3 py-1.5 hover:bg-background transition disabled:opacity-40"
                        >
                          {s.is_active ? "إيقاف" : "تفعيل"}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 5 : 4} className="px-4 py-10 text-center text-muted">
                    لا يوجد موردون.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? "تعديل مورد" : "مورد جديد"}
      >
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">اسم المورد *</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">الهاتف</label>
            <input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              dir="ltr"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">العنوان</label>
            <input
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">ملاحظات</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className={inputCls}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            />
            نشط
          </label>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              disabled={pending}
              className="bg-primary hover:bg-[var(--primary-hover)] text-white rounded-lg py-2.5 px-6 text-sm font-medium transition disabled:opacity-60"
            >
              {pending ? "جارٍ الحفظ…" : "حفظ"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="border border-border rounded-lg py-2.5 px-6 text-sm hover:bg-background transition"
            >
              إلغاء
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

const inputCls =
  "w-full border border-border rounded-lg px-3 py-2 outline-none focus:border-primary bg-card";
