"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { fmtMoney, fmtDate } from "@/lib/format";
import {
  createExpense,
  updateExpense,
  deleteExpense,
  createExpenseCategory,
  type ExpensePayload,
} from "@/app/(app)/expenses/actions";

export type ExpenseRow = {
  id: string;
  expense_number: string | null;
  category_id: string | null;
  category_name: string | null;
  amount: number;
  expense_date: string;
  description: string | null;
  payment_method: string | null;
  notes: string | null;
};
type Category = { id: string; name: string };

const METHOD: Record<string, string> = { cash: "نقد", transfer: "تحويل", cheque: "صك" };
const today = () => new Date().toISOString().slice(0, 10);

type FormState = {
  category_id: string;
  amount: string;
  expense_date: string;
  description: string;
  payment_method: string;
  notes: string;
};
const emptyForm = (): FormState => ({
  category_id: "",
  amount: "",
  expense_date: today(),
  description: "",
  payment_method: "cash",
  notes: "",
});

export default function ExpensesClient({
  expenses,
  categories,
  canCreate,
}: {
  expenses: ExpenseRow[];
  categories: Category[];
  canCreate: boolean;
}) {
  const router = useRouter();
  const [cats, setCats] = useState<Category[]>(categories);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [newCat, setNewCat] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const total = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);

  function openNew() {
    setEditingId(null);
    setForm(emptyForm());
    setError(null);
    setOpen(true);
  }
  function openEdit(e: ExpenseRow) {
    setEditingId(e.id);
    setError(null);
    setForm({
      category_id: e.category_id ?? "",
      amount: String(e.amount),
      expense_date: e.expense_date,
      description: e.description ?? "",
      payment_method: e.payment_method ?? "cash",
      notes: e.notes ?? "",
    });
    setOpen(true);
  }

  function addCategory() {
    const n = newCat.trim();
    if (!n) return;
    startTransition(async () => {
      const res = await createExpenseCategory(n);
      if (!res.ok || !res.id) {
        setError(res.error ?? "تعذّر إضافة التصنيف");
        return;
      }
      setCats((c) => [...c, { id: res.id!, name: n }]);
      setForm((f) => ({ ...f, category_id: res.id! }));
      setNewCat("");
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amt = Number(form.amount) || 0;
    if (amt <= 0) return setError("المبلغ يجب أن يكون أكبر من صفر.");
    const payload: ExpensePayload = {
      category_id: form.category_id || null,
      amount: amt,
      expense_date: form.expense_date,
      description: form.description.trim() || null,
      payment_method: (form.payment_method || null) as ExpensePayload["payment_method"],
      notes: form.notes.trim() || null,
    };
    startTransition(async () => {
      const res = editingId
        ? await updateExpense(editingId, payload)
        : await createExpense(payload);
      if (!res.ok) {
        setError(res.error ?? "حدث خطأ");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  function doDelete(e: ExpenseRow) {
    if (!confirm(`حذف المصروف ${e.expense_number ?? ""} (${fmtMoney(e.amount)})؟`)) return;
    startTransition(async () => {
      const res = await deleteExpense(e.id);
      if (!res.ok) setError(res.error ?? "تعذّر الحذف");
      else router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">المصاريف</h1>
          <p className="text-muted mt-1 text-sm">
            المصاريف التشغيلية بتصنيفاتها. تدخل في حساب صافي الربح.
          </p>
        </div>
        {canCreate && (
          <button
            onClick={openNew}
            className="bg-primary hover:bg-[var(--primary-hover)] text-white rounded-lg py-2.5 px-5 text-sm font-medium transition"
          >
            + مصروف
          </button>
        )}
      </div>

      {error && !open && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="bg-card border border-border rounded-xl px-5 py-3 inline-block">
        <span className="text-xs text-muted">إجمالي المعروض</span>
        <div className="text-xl font-bold tabular">{fmtMoney(total)} د.ع</div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-background text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">الرقم</th>
                <th className="px-4 py-3 font-medium">التاريخ</th>
                <th className="px-4 py-3 font-medium">التصنيف</th>
                <th className="px-4 py-3 font-medium">البيان</th>
                <th className="px-4 py-3 font-medium">المبلغ</th>
                <th className="px-4 py-3 font-medium">الطريقة</th>
                {canCreate && <th className="px-4 py-3 font-medium">إجراء</th>}
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="px-4 py-3 tabular text-muted" dir="ltr">{e.expense_number ?? "—"}</td>
                  <td className="px-4 py-3 text-muted tabular">{fmtDate(e.expense_date)}</td>
                  <td className="px-4 py-3">{e.category_name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">{e.description ?? "—"}</td>
                  <td className="px-4 py-3 tabular font-medium">{fmtMoney(e.amount)}</td>
                  <td className="px-4 py-3 text-muted">{e.payment_method ? METHOD[e.payment_method] : "—"}</td>
                  {canCreate && (
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(e)} className="text-sm border border-border rounded-lg px-3 py-1.5 hover:bg-background transition">تعديل</button>
                        <button disabled={pending} onClick={() => doDelete(e)} className="text-sm border border-border rounded-lg px-3 py-1.5 hover:bg-background transition disabled:opacity-40">حذف</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={canCreate ? 7 : 6} className="px-4 py-10 text-center text-muted">لا توجد مصاريف بعد.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editingId ? "تعديل مصروف" : "مصروف جديد"}>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">التصنيف</label>
              <select value={form.category_id} onChange={(ev) => setForm((f) => ({ ...f, category_id: ev.target.value }))} className={inputCls}>
                <option value="">— بلا تصنيف —</option>
                {cats.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
              <div className="flex gap-2 mt-2">
                <input value={newCat} onChange={(ev) => setNewCat(ev.target.value)} placeholder="تصنيف جديد" className={inputCls} />
                <button type="button" onClick={addCategory} disabled={pending || !newCat.trim()} className="shrink-0 text-sm border border-border rounded-lg px-3 hover:bg-background transition disabled:opacity-40">إضافة</button>
              </div>
            </div>
            <div>
              <label className="block text-sm mb-1">المبلغ *</label>
              <input type="number" min="0" step="any" value={form.amount} onChange={(ev) => setForm((f) => ({ ...f, amount: ev.target.value }))} dir="ltr" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm mb-1">التاريخ</label>
              <input type="date" value={form.expense_date} onChange={(ev) => setForm((f) => ({ ...f, expense_date: ev.target.value }))} dir="ltr" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm mb-1">طريقة الدفع</label>
              <select value={form.payment_method} onChange={(ev) => setForm((f) => ({ ...f, payment_method: ev.target.value }))} className={inputCls}>
                <option value="cash">نقد</option>
                <option value="transfer">تحويل</option>
                <option value="cheque">صك</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm mb-1">البيان</label>
            <input value={form.description} onChange={(ev) => setForm((f) => ({ ...f, description: ev.target.value }))} className={inputCls} />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button disabled={pending} className="bg-primary hover:bg-[var(--primary-hover)] text-white rounded-lg py-2.5 px-6 text-sm font-medium transition disabled:opacity-60">{pending ? "جارٍ الحفظ…" : "حفظ"}</button>
            <button type="button" onClick={() => setOpen(false)} className="border border-border rounded-lg py-2.5 px-6 text-sm hover:bg-background transition">إلغاء</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

const inputCls =
  "w-full border border-border rounded-lg px-3 py-2 outline-none focus:border-primary bg-card";
