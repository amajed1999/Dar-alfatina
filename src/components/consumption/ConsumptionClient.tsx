"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { fmtNum, fmtMoney, fmtDate } from "@/lib/format";
import {
  saveConsumptionDraft,
  updateConsumptionDraft,
  approveConsumption,
  discardConsumption,
  type ConsumptionHeader,
  type ConsumptionItemInput,
} from "@/app/(app)/consumption/actions";

type Item = { id: string; product_id: string; quantity: number; line_cost: number | null };
export type NoteRow = {
  id: string;
  note_number: string | null;
  note_date: string;
  reason_type: string;
  reason: string;
  status: string;
  total_cost: number;
  warehouse_id: string;
  items: Item[];
};
export type SProduct = { id: string; name: string; sku: string };
type Warehouse = { id: string; name: string; is_default: boolean };

const REASON: Record<string, string> = {
  sample: "عينات",
  gift: "هدايا",
  damage: "تالف",
  internal: "استهلاك داخلي",
  other: "أخرى",
};
const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "مسودة", cls: "bg-amber-50 text-amber-700" },
  approved: { label: "معتمدة", cls: "bg-green-50 text-green-700" },
  cancelled: { label: "ملغاة", cls: "bg-border text-muted" },
};

type ItemRow = { product_id: string; quantity: string };
const emptyItem = (): ItemRow => ({ product_id: "", quantity: "" });
const today = () => new Date().toISOString().slice(0, 10);

type FormState = {
  warehouse_id: string;
  note_date: string;
  reason_type: ConsumptionHeader["reason_type"];
  reason: string;
  notes: string;
  items: ItemRow[];
};

export default function ConsumptionClient({
  notes,
  warehouses,
  products,
  canViewCost,
  canCreate,
  canApprove,
}: {
  notes: NoteRow[];
  warehouses: Warehouse[];
  products: SProduct[];
  canViewCost: boolean;
  canCreate: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();
  const defWh = warehouses.find((w) => w.is_default) ?? warehouses[0];
  const [pending, startTransition] = useTransition();
  const [rowError, setRowError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => newForm(defWh?.id));

  function newForm(whId?: string): FormState {
    return {
      warehouse_id: whId ?? "",
      note_date: today(),
      reason_type: "sample",
      reason: "",
      notes: "",
      items: [emptyItem()],
    };
  }

  const productLabel = (id: string) => {
    const p = products.find((x) => x.id === id);
    return p ? `${p.name}${p.sku ? ` (${p.sku})` : ""}` : "—";
  };

  // ملخّص القيمة المعتمدة حسب السبب (مؤشر خطر عند الارتفاع)
  const byReason = useMemo(() => {
    const m: Record<string, number> = {};
    for (const n of notes) {
      if (n.status !== "approved") continue;
      m[n.reason_type] = (m[n.reason_type] ?? 0) + n.total_cost;
    }
    return m;
  }, [notes]);
  const totalApproved = Object.values(byReason).reduce((s, v) => s + v, 0);

  function openNew() {
    setEditingId(null);
    setForm(newForm(defWh?.id));
    setError(null);
    setOpen(true);
  }
  function openEdit(n: NoteRow) {
    setEditingId(n.id);
    setError(null);
    setForm({
      warehouse_id: n.warehouse_id,
      note_date: n.note_date,
      reason_type: n.reason_type as ConsumptionHeader["reason_type"],
      reason: n.reason,
      notes: "",
      items: n.items.length > 0
        ? n.items.map((it) => ({ product_id: it.product_id, quantity: String(it.quantity) }))
        : [emptyItem()],
    });
    setOpen(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const header: ConsumptionHeader = {
      warehouse_id: form.warehouse_id,
      note_date: form.note_date,
      reason_type: form.reason_type,
      reason: form.reason,
      notes: form.notes.trim() || null,
    };
    const items: ConsumptionItemInput[] = form.items
      .filter((it) => it.product_id && Number(it.quantity) > 0)
      .map((it) => ({ product_id: it.product_id, quantity: Number(it.quantity) }));
    startTransition(async () => {
      const res = editingId
        ? await updateConsumptionDraft(editingId, header, items)
        : await saveConsumptionDraft(header, items);
      if (!res.ok) {
        setError(res.error ?? "حدث خطأ");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  function doApprove(n: NoteRow) {
    if (!confirm(`اعتماد القائمة ${n.note_number ?? ""}؟ ستُخصم الكميات من المخزون كمصروف ولا يمكن التراجع.`))
      return;
    setRowError(null);
    startTransition(async () => {
      const res = await approveConsumption(n.id);
      if (!res.ok) setRowError(res.error ?? "تعذّر الاعتماد");
      else router.refresh();
    });
  }
  function doDiscard(n: NoteRow) {
    if (!confirm(`حذف المسودة ${n.note_number ?? ""}؟`)) return;
    setRowError(null);
    startTransition(async () => {
      const res = await discardConsumption(n.id);
      if (!res.ok) setRowError(res.error ?? "تعذّر الحذف");
      else router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">الاستهلاك الداخلي</h1>
          <p className="text-muted mt-1 text-sm">
            إخراج بضاعة بلا بيع (عينات/هدايا/تالف/استهلاك). تُخصم من المخزون وتُحسب مصروفاً.
          </p>
        </div>
        {canCreate && (
          <button onClick={openNew} className="bg-primary hover:bg-[var(--primary-hover)] text-white rounded-lg py-2.5 px-5 text-sm font-medium transition">
            + قائمة استهلاك
          </button>
        )}
      </div>

      {canViewCost && totalApproved > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="font-semibold mb-3 text-sm">قيمة الاستهلاك المعتمد حسب السبب</h2>
          <div className="flex gap-4 flex-wrap">
            {Object.entries(byReason).map(([k, v]) => (
              <div key={k} className="border border-border rounded-lg px-4 py-2">
                <div className="text-xs text-muted">{REASON[k] ?? k}</div>
                <div className="tabular font-semibold">{fmtMoney(v)} د.ع</div>
              </div>
            ))}
            <div className="border border-primary/40 bg-primary/5 rounded-lg px-4 py-2">
              <div className="text-xs text-muted">الإجمالي</div>
              <div className="tabular font-bold">{fmtMoney(totalApproved)} د.ع</div>
            </div>
          </div>
        </div>
      )}

      {rowError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{rowError}</p>}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-background text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">الرقم</th>
                <th className="px-4 py-3 font-medium">التاريخ</th>
                <th className="px-4 py-3 font-medium">السبب</th>
                <th className="px-4 py-3 font-medium">البيان</th>
                {canViewCost && <th className="px-4 py-3 font-medium">القيمة</th>}
                <th className="px-4 py-3 font-medium">الحالة</th>
                <th className="px-4 py-3 font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {notes.map((n) => {
                const st = STATUS[n.status] ?? STATUS.draft;
                const isOpen = expanded === n.id;
                return (
                  <Fragment key={n.id}>
                    <tr className="border-t border-border">
                      <td className="px-4 py-3 tabular" dir="ltr">
                        <button onClick={() => setExpanded(isOpen ? null : n.id)} className="text-primary hover:underline">{n.note_number ?? "—"}</button>
                      </td>
                      <td className="px-4 py-3 text-muted tabular">{fmtDate(n.note_date)}</td>
                      <td className="px-4 py-3">{REASON[n.reason_type] ?? n.reason_type}</td>
                      <td className="px-4 py-3 text-muted">{n.reason}</td>
                      {canViewCost && <td className="px-4 py-3 tabular">{n.status === "approved" ? fmtMoney(n.total_cost) : "—"}</td>}
                      <td className="px-4 py-3"><span className={`text-xs rounded-full px-2.5 py-1 ${st.cls}`}>{st.label}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 flex-wrap">
                          {n.status === "draft" && canCreate && (
                            <button onClick={() => openEdit(n)} className="text-sm border border-border rounded-lg px-3 py-1.5 hover:bg-background transition">تعديل</button>
                          )}
                          {n.status === "draft" && canApprove && (
                            <button disabled={pending} onClick={() => doApprove(n)} className="text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg px-3 py-1.5 transition disabled:opacity-40">اعتماد</button>
                          )}
                          {n.status === "draft" && canCreate && (
                            <button disabled={pending} onClick={() => doDiscard(n)} className="text-sm border border-border rounded-lg px-3 py-1.5 hover:bg-background transition disabled:opacity-40">حذف</button>
                          )}
                          {n.status !== "draft" && (
                            <button onClick={() => setExpanded(isOpen ? null : n.id)} className="text-sm border border-border rounded-lg px-3 py-1.5 hover:bg-background transition">{isOpen ? "إخفاء" : "عرض"}</button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-background/50">
                        <td colSpan={canViewCost ? 7 : 6} className="px-4 py-3">
                          <div className="rounded-lg border border-border overflow-hidden">
                            <table className="w-full text-xs text-right">
                              <thead className="bg-background text-muted">
                                <tr>
                                  <th className="px-3 py-2 font-medium">المنتج</th>
                                  <th className="px-3 py-2 font-medium">الكمية</th>
                                  {canViewCost && <th className="px-3 py-2 font-medium">القيمة</th>}
                                </tr>
                              </thead>
                              <tbody>
                                {n.items.map((it) => (
                                  <tr key={it.id} className="border-t border-border">
                                    <td className="px-3 py-2">{productLabel(it.product_id)}</td>
                                    <td className="px-3 py-2 tabular">{fmtNum(it.quantity)}</td>
                                    {canViewCost && <td className="px-3 py-2 tabular">{it.line_cost != null ? fmtMoney(it.line_cost) : "—"}</td>}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {notes.length === 0 && (
                <tr><td colSpan={canViewCost ? 7 : 6} className="px-4 py-10 text-center text-muted">لا توجد قوائم استهلاك بعد.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editingId ? "تعديل قائمة استهلاك" : "قائمة استهلاك جديدة"} wide>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm mb-1">المخزن *</label>
              <select value={form.warehouse_id} onChange={(e) => setForm((f) => ({ ...f, warehouse_id: e.target.value }))} className={inputCls}>
                {warehouses.map((w) => (<option key={w.id} value={w.id}>{w.name}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">السبب (النوع)</label>
              <select value={form.reason_type} onChange={(e) => setForm((f) => ({ ...f, reason_type: e.target.value as ConsumptionHeader["reason_type"] }))} className={inputCls}>
                <option value="sample">عينات</option>
                <option value="gift">هدايا</option>
                <option value="damage">تالف</option>
                <option value="internal">استهلاك داخلي</option>
                <option value="other">أخرى</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">التاريخ</label>
              <input type="date" value={form.note_date} onChange={(e) => setForm((f) => ({ ...f, note_date: e.target.value }))} dir="ltr" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-sm mb-1">البيان / التبرير *</label>
            <input value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="سبب الإخراج (إلزامي)" className={inputCls} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">البنود</p>
              <button type="button" onClick={() => setForm((f) => ({ ...f, items: [...f.items, emptyItem()] }))} className="text-sm border border-border rounded-lg px-3 py-1.5 hover:bg-background transition">+ بند</button>
            </div>
            <div className="space-y-2">
              {form.items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-8">
                    <select value={it.product_id} onChange={(e) => setForm((f) => ({ ...f, items: f.items.map((x, idx) => idx === i ? { ...x, product_id: e.target.value } : x) }))} className={inputCls}>
                      <option value="">— اختر منتجاً —</option>
                      {products.map((p) => (<option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ""}</option>))}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <input type="number" min="0" step="any" placeholder="كمية" value={it.quantity} onChange={(e) => setForm((f) => ({ ...f, items: f.items.map((x, idx) => idx === i ? { ...x, quantity: e.target.value } : x) }))} dir="ltr" className={inputCls} />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button type="button" onClick={() => setForm((f) => ({ ...f, items: f.items.length > 1 ? f.items.filter((_, idx) => idx !== i) : f.items }))} className="text-muted hover:text-red-600 text-lg leading-none" aria-label="حذف">×</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button disabled={pending} className="bg-primary hover:bg-[var(--primary-hover)] text-white rounded-lg py-2.5 px-6 text-sm font-medium transition disabled:opacity-60">{pending ? "جارٍ الحفظ…" : "حفظ كمسودة"}</button>
            <button type="button" onClick={() => setOpen(false)} className="border border-border rounded-lg py-2.5 px-6 text-sm hover:bg-background transition">إلغاء</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

const inputCls =
  "w-full border border-border rounded-lg px-3 py-2 outline-none focus:border-primary bg-card";
