"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { fmtNum, fmtMoney, fmtDate } from "@/lib/format";
import {
  savePurchaseDraft,
  updatePurchaseDraft,
  approvePurchase,
  discardPurchase,
  type PurchaseHeader,
  type PurchaseItemInput,
} from "@/app/(app)/purchases/actions";

type InvoiceItem = {
  id: string;
  product_id: string;
  quantity: number;
  unit_cost: number;
  discount: number;
  line_total: number | null;
};
type Invoice = {
  id: string;
  invoice_number: string | null;
  invoice_date: string;
  status: string;
  currency: string;
  exchange_rate: number;
  discount: number;
  subtotal: number;
  total: number;
  notes: string | null;
  supplier_id: string | null;
  warehouse_id: string;
  suppliers: { name: string | null } | null;
  purchase_invoice_items: InvoiceItem[];
};
type Supplier = { id: string; name: string };
type Warehouse = { id: string; name: string; is_default: boolean };
export type Product = {
  id: string | null;
  name: string | null;
  sku: string | null;
  base_unit_name: string | null;
};

type Props = {
  invoices: Invoice[];
  suppliers: Supplier[];
  warehouses: Warehouse[];
  products: Product[];
  defaultUsdRate: number;
  canCreate: boolean;
  canEdit: boolean;
  canApprove: boolean;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "مسودة", cls: "bg-amber-50 text-amber-700" },
  approved: { label: "معتمدة", cls: "bg-green-50 text-green-700" },
  cancelled: { label: "ملغاة", cls: "bg-border text-muted" },
};

type ItemRow = {
  product_id: string;
  quantity: string;
  unit_cost: string;
  discount: string;
};

type FormState = {
  supplier_id: string;
  warehouse_id: string;
  invoice_date: string;
  currency: string;
  exchange_rate: string;
  discount: string;
  notes: string;
  items: ItemRow[];
};

const today = () => new Date().toISOString().slice(0, 10);
const emptyItem = (): ItemRow => ({ product_id: "", quantity: "", unit_cost: "", discount: "" });

function emptyForm(warehouses: Warehouse[]): FormState {
  const def = warehouses.find((w) => w.is_default) ?? warehouses[0];
  return {
    supplier_id: "",
    warehouse_id: def?.id ?? "",
    invoice_date: today(),
    currency: "IQD",
    exchange_rate: "1",
    discount: "0",
    notes: "",
    items: [emptyItem()],
  };
}

export default function PurchasesClient({
  invoices,
  suppliers,
  warehouses,
  products,
  defaultUsdRate,
  canCreate,
  canEdit,
  canApprove,
}: Props) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm(warehouses));
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const productName = (id: string) => {
    const p = products.find((x) => x.id === id);
    return p ? `${p.name ?? ""}${p.sku ? ` (${p.sku})` : ""}` : "—";
  };

  const totals = useMemo(() => {
    const subtotal = form.items.reduce((s, it) => {
      const q = Number(it.quantity) || 0;
      const c = Number(it.unit_cost) || 0;
      const d = Number(it.discount) || 0;
      return s + Math.max(q * c - d, 0);
    }, 0);
    const total = Math.max(subtotal - (Number(form.discount) || 0), 0);
    return { subtotal, total };
  }, [form.items, form.discount]);

  function openNew() {
    setEditingId(null);
    setForm(emptyForm(warehouses));
    setError(null);
    setModalOpen(true);
  }

  function openEdit(inv: Invoice) {
    setEditingId(inv.id);
    setError(null);
    setForm({
      supplier_id: inv.supplier_id ?? "",
      warehouse_id: inv.warehouse_id,
      invoice_date: inv.invoice_date,
      currency: inv.currency,
      exchange_rate: String(inv.exchange_rate),
      discount: String(inv.discount),
      notes: inv.notes ?? "",
      items:
        inv.purchase_invoice_items.length > 0
          ? inv.purchase_invoice_items.map((it) => ({
              product_id: it.product_id,
              quantity: String(it.quantity),
              unit_cost: String(it.unit_cost),
              discount: String(it.discount),
            }))
          : [emptyItem()],
    });
    setModalOpen(true);
  }

  function setItem(i: number, patch: Partial<ItemRow>) {
    setForm((f) => ({
      ...f,
      items: f.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)),
    }));
  }
  function addRow() {
    setForm((f) => ({ ...f, items: [...f.items, emptyItem()] }));
  }
  function removeRow(i: number) {
    setForm((f) => ({
      ...f,
      items: f.items.length > 1 ? f.items.filter((_, idx) => idx !== i) : f.items,
    }));
  }

  function onCurrencyChange(currency: string) {
    setForm((f) => ({
      ...f,
      currency,
      exchange_rate: currency === "IQD" ? "1" : String(defaultUsdRate || 1),
    }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const header: PurchaseHeader = {
      supplier_id: form.supplier_id || null,
      warehouse_id: form.warehouse_id,
      invoice_date: form.invoice_date,
      currency: form.currency,
      exchange_rate: Number(form.exchange_rate) || 1,
      discount: Number(form.discount) || 0,
      notes: form.notes.trim() || null,
    };
    const items: PurchaseItemInput[] = form.items
      .filter((it) => it.product_id && Number(it.quantity) > 0)
      .map((it) => ({
        product_id: it.product_id,
        quantity: Number(it.quantity),
        unit_cost: Number(it.unit_cost) || 0,
        discount: Number(it.discount) || 0,
      }));

    startTransition(async () => {
      const res = editingId
        ? await updatePurchaseDraft(editingId, header, items)
        : await savePurchaseDraft(header, items);
      if (!res.ok) {
        setError(res.error ?? "حدث خطأ");
        return;
      }
      setModalOpen(false);
      router.refresh();
    });
  }

  function doApprove(inv: Invoice) {
    if (!confirm(`اعتماد الفاتورة ${inv.invoice_number ?? ""}؟ سيُضاف المخزون وتُثبَّت التكلفة ولا يمكن التراجع.`))
      return;
    setRowError(null);
    startTransition(async () => {
      const res = await approvePurchase(inv.id);
      if (!res.ok) setRowError(res.error ?? "تعذّر الاعتماد");
      else router.refresh();
    });
  }
  function doDiscard(inv: Invoice) {
    if (!confirm(`حذف المسودة ${inv.invoice_number ?? ""}؟`)) return;
    setRowError(null);
    startTransition(async () => {
      const res = await discardPurchase(inv.id);
      if (!res.ok) setRowError(res.error ?? "تعذّر الحذف");
      else router.refresh();
    });
  }

  const cur = (c: string) => (c === "USD" ? "$" : "د.ع");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">المشتريات</h1>
          <p className="text-muted mt-1 text-sm">
            فواتير الشراء من الموردين. الاعتماد يزيد المخزون ويعيد حساب متوسط التكلفة.
          </p>
        </div>
        {canCreate && (
          <button
            onClick={openNew}
            className="bg-primary hover:bg-[var(--primary-hover)] text-white rounded-lg py-2.5 px-5 text-sm font-medium transition"
          >
            + فاتورة شراء
          </button>
        )}
      </div>

      {rowError && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{rowError}</p>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-background text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">الرقم</th>
                <th className="px-4 py-3 font-medium">التاريخ</th>
                <th className="px-4 py-3 font-medium">المورد</th>
                <th className="px-4 py-3 font-medium">الحالة</th>
                <th className="px-4 py-3 font-medium">الإجمالي</th>
                <th className="px-4 py-3 font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const st = STATUS[inv.status] ?? STATUS.draft;
                const isOpen = expanded === inv.id;
                return (
                  <Fragment key={inv.id}>
                    <tr className="border-t border-border">
                      <td className="px-4 py-3 tabular" dir="ltr">
                        <button
                          onClick={() => setExpanded(isOpen ? null : inv.id)}
                          className="text-primary hover:underline"
                        >
                          {inv.invoice_number ?? "—"}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-muted tabular">{fmtDate(inv.invoice_date)}</td>
                      <td className="px-4 py-3">{inv.suppliers?.name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs rounded-full px-2.5 py-1 ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3 tabular">
                        {fmtMoney(inv.total)} {cur(inv.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 flex-wrap">
                          {inv.status === "draft" && canEdit && (
                            <button
                              onClick={() => openEdit(inv)}
                              className="text-sm border border-border rounded-lg px-3 py-1.5 hover:bg-background transition"
                            >
                              تعديل
                            </button>
                          )}
                          {inv.status === "draft" && canApprove && (
                            <button
                              disabled={pending}
                              onClick={() => doApprove(inv)}
                              className="text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg px-3 py-1.5 transition disabled:opacity-40"
                            >
                              اعتماد
                            </button>
                          )}
                          {inv.status === "draft" && canEdit && (
                            <button
                              disabled={pending}
                              onClick={() => doDiscard(inv)}
                              className="text-sm border border-border rounded-lg px-3 py-1.5 hover:bg-background transition disabled:opacity-40"
                            >
                              حذف
                            </button>
                          )}
                          {inv.status !== "draft" && (
                            <button
                              onClick={() => setExpanded(isOpen ? null : inv.id)}
                              className="text-sm border border-border rounded-lg px-3 py-1.5 hover:bg-background transition"
                            >
                              {isOpen ? "إخفاء" : "عرض"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-background/50">
                        <td colSpan={6} className="px-4 py-3">
                          <div className="rounded-lg border border-border overflow-hidden">
                            <table className="w-full text-xs text-right">
                              <thead className="bg-background text-muted">
                                <tr>
                                  <th className="px-3 py-2 font-medium">المنتج</th>
                                  <th className="px-3 py-2 font-medium">الكمية</th>
                                  <th className="px-3 py-2 font-medium">التكلفة</th>
                                  <th className="px-3 py-2 font-medium">خصم</th>
                                  <th className="px-3 py-2 font-medium">الإجمالي</th>
                                </tr>
                              </thead>
                              <tbody>
                                {inv.purchase_invoice_items.map((it) => (
                                  <tr key={it.id} className="border-t border-border">
                                    <td className="px-3 py-2">{productName(it.product_id)}</td>
                                    <td className="px-3 py-2 tabular">{fmtNum(it.quantity)}</td>
                                    <td className="px-3 py-2 tabular">{fmtMoney(it.unit_cost)}</td>
                                    <td className="px-3 py-2 tabular">{fmtMoney(it.discount)}</td>
                                    <td className="px-3 py-2 tabular">{fmtMoney(it.line_total)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div className="flex gap-6 mt-2 text-xs text-muted">
                            <span>المجموع: {fmtMoney(inv.subtotal)} {cur(inv.currency)}</span>
                            <span>خصم الفاتورة: {fmtMoney(inv.discount)} {cur(inv.currency)}</span>
                            <span className="font-medium text-foreground">
                              الصافي: {fmtMoney(inv.total)} {cur(inv.currency)}
                            </span>
                            {inv.currency !== "IQD" && <span>سعر الصرف: {fmtNum(inv.exchange_rate)}</span>}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted">
                    لا توجد فواتير شراء بعد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "تعديل فاتورة شراء" : "فاتورة شراء جديدة"}
        wide
      >
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="المورد">
              <select
                value={form.supplier_id}
                onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))}
                className={inputCls}
              >
                <option value="">— بلا مورد —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="المخزن *">
              <select
                value={form.warehouse_id}
                onChange={(e) => setForm((f) => ({ ...f, warehouse_id: e.target.value }))}
                className={inputCls}
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="تاريخ الفاتورة *">
              <input
                type="date"
                value={form.invoice_date}
                onChange={(e) => setForm((f) => ({ ...f, invoice_date: e.target.value }))}
                dir="ltr"
                className={inputCls}
              />
            </Field>
            <Field label="العملة">
              <select
                value={form.currency}
                onChange={(e) => onCurrencyChange(e.target.value)}
                className={inputCls}
              >
                <option value="IQD">دينار عراقي (IQD)</option>
                <option value="USD">دولار (USD)</option>
              </select>
            </Field>
            {form.currency !== "IQD" && (
              <Field label="سعر الصرف (1 دولار = ؟ دينار)">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.exchange_rate}
                  onChange={(e) => setForm((f) => ({ ...f, exchange_rate: e.target.value }))}
                  dir="ltr"
                  className={inputCls}
                />
              </Field>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">البنود</p>
              <button
                type="button"
                onClick={addRow}
                className="text-sm border border-border rounded-lg px-3 py-1.5 hover:bg-background transition"
              >
                + بند
              </button>
            </div>
            <div className="space-y-2">
              {form.items.map((it, i) => {
                const q = Number(it.quantity) || 0;
                const c = Number(it.unit_cost) || 0;
                const d = Number(it.discount) || 0;
                const lt = Math.max(q * c - d, 0);
                return (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-12 sm:col-span-5">
                      <select
                        value={it.product_id}
                        onChange={(e) => setItem(i, { product_id: e.target.value })}
                        className={inputCls}
                      >
                        <option value="">— اختر منتجاً —</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id ?? ""}>
                            {p.name}
                            {p.sku ? ` (${p.sku})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-3 sm:col-span-2">
                      <input
                        type="number" min="0" step="any" placeholder="كمية"
                        value={it.quantity}
                        onChange={(e) => setItem(i, { quantity: e.target.value })}
                        dir="ltr" className={inputCls}
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <input
                        type="number" min="0" step="any" placeholder="تكلفة"
                        value={it.unit_cost}
                        onChange={(e) => setItem(i, { unit_cost: e.target.value })}
                        dir="ltr" className={inputCls}
                      />
                    </div>
                    <div className="col-span-3 sm:col-span-2">
                      <input
                        type="number" min="0" step="any" placeholder="خصم"
                        value={it.discount}
                        onChange={(e) => setItem(i, { discount: e.target.value })}
                        dir="ltr" className={inputCls}
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1 flex items-center justify-between gap-1">
                      <span className="text-xs text-muted tabular hidden sm:inline">{fmtMoney(lt)}</span>
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        className="text-muted hover:text-red-600 text-lg leading-none"
                        aria-label="حذف البند"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="خصم على الفاتورة">
              <input
                type="number" min="0" step="any"
                value={form.discount}
                onChange={(e) => setForm((f) => ({ ...f, discount: e.target.value }))}
                dir="ltr" className={inputCls}
              />
            </Field>
            <Field label="ملاحظات">
              <input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className={inputCls}
              />
            </Field>
          </div>

          <div className="flex gap-6 text-sm bg-background rounded-lg px-4 py-3">
            <span>المجموع: <b className="tabular">{fmtMoney(totals.subtotal)}</b> {cur(form.currency)}</span>
            <span className="font-medium">
              الصافي: <b className="tabular">{fmtMoney(totals.total)}</b> {cur(form.currency)}
            </span>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              disabled={pending}
              className="bg-primary hover:bg-[var(--primary-hover)] text-white rounded-lg py-2.5 px-6 text-sm font-medium transition disabled:opacity-60"
            >
              {pending ? "جارٍ الحفظ…" : "حفظ كمسودة"}
            </button>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm mb-1">{label}</label>
      {children}
    </div>
  );
}
