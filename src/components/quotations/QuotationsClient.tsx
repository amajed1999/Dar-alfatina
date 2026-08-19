"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { fmtMoney, fmtDate } from "@/lib/format";
import {
  saveQuotation,
  updateQuotation,
  setQuotationStatus,
  deleteQuotation,
  convertQuotation,
  type QuoteHeader,
  type QuoteItemInput,
} from "@/app/(app)/quotations/actions";

export type QMerchant = { id: string; name: string; price_tier_id: string | null; status: string };
export type QProduct = { id: string; name: string; sku: string; barcode?: string | null };
type Price = { product_id: string; price_tier_id: string; price: number };
type QItem = { product_id: string; quantity: number; unit_price: number; discount: number; line_total: number };
export type QuoteRow = {
  id: string;
  quote_number: string | null;
  quote_date: string;
  valid_until: string | null;
  currency: string;
  exchange_rate: number;
  discount: number;
  subtotal: number;
  total: number;
  status: string;
  notes: string | null;
  merchant_id: string;
  merchant_name: string;
  merchant_shop: string | null;
  merchant_phone: string | null;
  converted: boolean;
  items: QItem[];
};

const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "مسودّة", cls: "bg-border text-muted" },
  sent: { label: "مُرسَل", cls: "bg-blue-50 text-blue-700" },
  accepted: { label: "مقبول", cls: "bg-green-50 text-green-700" },
  rejected: { label: "مرفوض", cls: "bg-red-50 text-red-700" },
  converted: { label: "تحوّل لفاتورة", cls: "bg-primary/10 text-primary" },
};
const today = () => new Date().toISOString().slice(0, 10);

type ItemRow = { product_id: string; quantity: string; unit_price: string; discount: string };
const emptyItem = (): ItemRow => ({ product_id: "", quantity: "", unit_price: "", discount: "" });

type Form = {
  merchant_id: string;
  quote_date: string;
  valid_until: string;
  discount: string;
  notes: string;
  items: ItemRow[];
};
const newForm = (): Form => ({
  merchant_id: "",
  quote_date: today(),
  valid_until: "",
  discount: "",
  notes: "",
  items: [emptyItem()],
});

export default function QuotationsClient({
  quotes,
  merchants,
  products,
  prices,
  companyName,
  canCreate,
  canConvert,
  canEditPrice,
}: {
  quotes: QuoteRow[];
  merchants: QMerchant[];
  products: QProduct[];
  prices: Price[];
  companyName: string;
  canCreate: boolean;
  canConvert: boolean;
  canEditPrice: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rowError, setRowError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(newForm);
  const [error, setError] = useState<string | null>(null);
  const [scanValue, setScanValue] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);

  const merchantById = (id: string) => merchants.find((m) => m.id === id);
  const productById = (id: string) => products.find((p) => p.id === id);
  const formMerchant = merchantById(form.merchant_id);

  function priceFor(pid: string, m?: QMerchant): number {
    if (!m?.price_tier_id) return 0;
    return prices.find((p) => p.product_id === pid && p.price_tier_id === m.price_tier_id)?.price ?? 0;
  }

  const totals = useMemo(() => {
    const subtotal = form.items.reduce((s, it) => {
      const q = Number(it.quantity) || 0, p = Number(it.unit_price) || 0, d = Number(it.discount) || 0;
      return s + Math.max(q * p - d, 0);
    }, 0);
    const total = Math.max(subtotal - (Number(form.discount) || 0), 0);
    return { subtotal, total };
  }, [form]);

  function openNew() {
    setEditId(null);
    setForm(newForm());
    setError(null);
    setScanError(null);
    setOpen(true);
  }
  function openEdit(q: QuoteRow) {
    setEditId(q.id);
    setError(null);
    setScanError(null);
    setForm({
      merchant_id: q.merchant_id,
      quote_date: q.quote_date,
      valid_until: q.valid_until ?? "",
      discount: String(q.discount || ""),
      notes: q.notes ?? "",
      items: q.items.length
        ? q.items.map((it) => ({
            product_id: it.product_id,
            quantity: String(it.quantity),
            unit_price: String(it.unit_price),
            discount: String(it.discount || ""),
          }))
        : [emptyItem()],
    });
    setOpen(true);
  }

  function setItem(i: number, patch: Partial<ItemRow>) {
    setForm((f) => ({ ...f, items: f.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) }));
  }
  function onProductChange(i: number, pid: string) {
    const price = priceFor(pid, formMerchant);
    setForm((f) => ({
      ...f,
      items: f.items.map((it, idx) =>
        idx === i ? { ...it, product_id: pid, unit_price: price ? String(price) : it.unit_price } : it,
      ),
    }));
  }
  function onMerchantChange(mid: string) {
    const m = merchantById(mid);
    setForm((f) => ({
      ...f,
      merchant_id: mid,
      items: f.items.map((it) =>
        it.product_id ? { ...it, unit_price: String(priceFor(it.product_id, m) || it.unit_price) } : it,
      ),
    }));
  }
  function addByBarcode(code: string) {
    const c = code.trim();
    if (!c) return;
    setScanError(null);
    const prod = products.find((p) => (p.barcode ?? "") === c) ?? products.find((p) => p.sku === c);
    if (!prod) {
      setScanError(`لا يوجد منتج بالباركود/الرمز «${c}»`);
      setScanValue("");
      return;
    }
    const price = priceFor(prod.id, formMerchant);
    setForm((f) => {
      const idx = f.items.findIndex((it) => it.product_id === prod.id);
      if (idx >= 0) {
        return {
          ...f,
          items: f.items.map((it, i) =>
            i === idx ? { ...it, quantity: String((Number(it.quantity) || 0) + 1) } : it,
          ),
        };
      }
      const row: ItemRow = { product_id: prod.id, quantity: "1", unit_price: price ? String(price) : "", discount: "" };
      const emptyIdx = f.items.findIndex((it) => !it.product_id);
      if (emptyIdx >= 0) return { ...f, items: f.items.map((it, i) => (i === emptyIdx ? row : it)) };
      return { ...f, items: [...f.items, row] };
    });
    setScanValue("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const header: QuoteHeader = {
      merchant_id: form.merchant_id,
      quote_date: form.quote_date,
      valid_until: form.valid_until || null,
      currency: "IQD",
      exchange_rate: 1,
      discount: Number(form.discount) || 0,
      notes: form.notes.trim() || null,
    };
    const items: QuoteItemInput[] = form.items
      .filter((it) => it.product_id && Number(it.quantity) > 0)
      .map((it) => ({
        product_id: it.product_id,
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price) || 0,
        discount: Number(it.discount) || 0,
      }));
    startTransition(async () => {
      const res = editId ? await updateQuotation(editId, header, items) : await saveQuotation(header, items);
      if (!res.ok) {
        setError(res.error ?? "حدث خطأ");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  function changeStatus(q: QuoteRow, status: string) {
    setRowError(null);
    startTransition(async () => {
      const res = await setQuotationStatus(q.id, status);
      if (!res.ok) setRowError(res.error ?? "تعذّر التحديث");
      else router.refresh();
    });
  }
  function convert(q: QuoteRow) {
    if (!confirm(`تحويل عرض السعر ${q.quote_number ?? ""} إلى مسودّة فاتورة بيع؟`)) return;
    setRowError(null);
    startTransition(async () => {
      const res = await convertQuotation(q.id);
      if (!res.ok) setRowError(res.error ?? "تعذّر التحويل");
      else router.refresh();
    });
  }
  function doDelete(q: QuoteRow) {
    if (!confirm(`حذف عرض السعر ${q.quote_number ?? ""}؟`)) return;
    setRowError(null);
    startTransition(async () => {
      const res = await deleteQuotation(q.id);
      if (!res.ok) setRowError(res.error ?? "تعذّر الحذف");
      else router.refresh();
    });
  }

  function printQuote(q: QuoteRow) {
    const rowsHtml = q.items
      .map((it, i) => {
        const p = productById(it.product_id);
        return `<tr>
          <td style="text-align:center">${i + 1}</td>
          <td>${p?.name ?? "—"}${p?.sku ? ` <span style="color:#888">(${p.sku})</span>` : ""}</td>
          <td style="text-align:center">${it.quantity}</td>
          <td style="text-align:left">${fmtMoney(it.unit_price)}</td>
          <td style="text-align:left">${fmtMoney(it.discount || 0)}</td>
          <td style="text-align:left">${fmtMoney(it.line_total)}</td>
        </tr>`;
      })
      .join("");
    const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <title>${q.quote_number ?? "عرض سعر"}</title>
      <style>
        *{font-family:Tahoma,Arial,sans-serif}
        body{padding:24px;color:#222}
        h1{color:#1e40af;margin:0 0 4px}
        .muted{color:#666;font-size:13px}
        table{width:100%;border-collapse:collapse;margin-top:14px}
        th,td{border:1px solid #ddd;padding:6px 8px;font-size:13px}
        th{background:#f3f4f6}
        .tot{margin-top:12px;font-size:14px}
        .tot b{display:inline-block;min-width:120px}
      </style></head><body>
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div><h1>${companyName}</h1><div class="muted">عرض سعر</div></div>
        <div style="text-align:left" class="muted">
          <div><b>الرقم:</b> ${q.quote_number ?? "—"}</div>
          <div><b>التاريخ:</b> ${fmtDate(q.quote_date)}</div>
          ${q.valid_until ? `<div><b>صالح حتى:</b> ${fmtDate(q.valid_until)}</div>` : ""}
        </div>
      </div>
      <div style="margin-top:10px"><b>التاجر:</b> ${q.merchant_shop || q.merchant_name}${
        q.merchant_phone ? ` — ${q.merchant_phone}` : ""
      }</div>
      <table><thead><tr>
        <th>#</th><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الخصم</th><th>المجموع</th>
      </tr></thead><tbody>${rowsHtml}</tbody></table>
      <div class="tot"><b>المجموع:</b> ${fmtMoney(q.subtotal)} د.ع</div>
      ${q.discount ? `<div class="tot"><b>خصم:</b> ${fmtMoney(q.discount)} د.ع</div>` : ""}
      <div class="tot" style="font-size:16px"><b>الإجمالي:</b> ${fmtMoney(q.total)} د.ع</div>
      ${q.notes ? `<div style="margin-top:12px" class="muted"><b>ملاحظات:</b> ${q.notes}</div>` : ""}
      <script>window.onload=function(){window.print()}</script>
      </body></html>`;
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
    } else {
      setRowError("منع المتصفح فتح نافذة الطباعة.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">عروض الأسعار</h1>
          <p className="text-muted mt-1 text-sm">
            جهّز عرض سعر للتاجر، اطبعه أو شاركه، وحوّله إلى فاتورة بيع بضغطة.
          </p>
        </div>
        {canCreate && (
          <button onClick={openNew} className="bg-primary hover:bg-[var(--primary-hover)] text-white rounded-lg py-2.5 px-5 text-sm font-medium transition">
            + عرض سعر
          </button>
        )}
      </div>

      {rowError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{rowError}</p>}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-background text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">الرقم</th>
                <th className="px-4 py-3 font-medium">التاريخ</th>
                <th className="px-4 py-3 font-medium">التاجر</th>
                <th className="px-4 py-3 font-medium">الإجمالي</th>
                <th className="px-4 py-3 font-medium">صالح حتى</th>
                <th className="px-4 py-3 font-medium">الحالة</th>
                <th className="px-4 py-3 font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => {
                const st = STATUS[q.status] ?? STATUS.draft;
                const expired = q.valid_until && q.valid_until < today() && q.status !== "converted";
                const editable = q.status !== "converted";
                return (
                  <tr key={q.id} className="border-t border-border align-top">
                    <td className="px-4 py-3 tabular text-muted" dir="ltr">{q.quote_number ?? "—"}</td>
                    <td className="px-4 py-3 tabular text-muted">{fmtDate(q.quote_date)}</td>
                    <td className="px-4 py-3">{q.merchant_name}</td>
                    <td className="px-4 py-3 tabular font-medium">{fmtMoney(q.total)}</td>
                    <td className="px-4 py-3 tabular text-muted">
                      {q.valid_until ? (
                        <span className={expired ? "text-red-600" : ""}>{fmtDate(q.valid_until)}</span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] rounded-full px-2 py-0.5 ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 flex-wrap">
                        <button onClick={() => printQuote(q)} className="text-xs border border-border rounded-lg px-2.5 py-1 hover:bg-background transition">طباعة</button>
                        {canCreate && editable && (
                          <button onClick={() => openEdit(q)} className="text-xs border border-border rounded-lg px-2.5 py-1 hover:bg-background transition">تعديل</button>
                        )}
                        {canCreate && editable && q.status === "draft" && (
                          <button disabled={pending} onClick={() => changeStatus(q, "sent")} className="text-xs border border-border rounded-lg px-2.5 py-1 hover:bg-background transition disabled:opacity-40">تعليم كمُرسَل</button>
                        )}
                        {canCreate && editable && q.status !== "accepted" && q.status !== "rejected" && (
                          <>
                            <button disabled={pending} onClick={() => changeStatus(q, "accepted")} className="text-xs border border-green-200 text-green-700 rounded-lg px-2.5 py-1 hover:bg-green-50 transition disabled:opacity-40">مقبول</button>
                            <button disabled={pending} onClick={() => changeStatus(q, "rejected")} className="text-xs border border-red-200 text-red-700 rounded-lg px-2.5 py-1 hover:bg-red-50 transition disabled:opacity-40">مرفوض</button>
                          </>
                        )}
                        {canConvert && editable && (
                          <button disabled={pending} onClick={() => convert(q)} className="text-xs bg-primary text-white rounded-lg px-2.5 py-1 hover:bg-[var(--primary-hover)] transition disabled:opacity-40">تحويل لفاتورة</button>
                        )}
                        {q.converted && <span className="text-xs text-primary py-1">✓ فاتورة</span>}
                        {canCreate && editable && (
                          <button disabled={pending} onClick={() => doDelete(q)} className="text-xs border border-border rounded-lg px-2.5 py-1 hover:bg-background transition disabled:opacity-40">حذف</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {quotes.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted">لا توجد عروض أسعار بعد.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? "تعديل عرض سعر" : "عرض سعر جديد"} wide>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="التاجر *">
              <select value={form.merchant_id} onChange={(e) => onMerchantChange(e.target.value)} className={inputCls}>
                <option value="">— اختر التاجر —</option>
                {merchants.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
              </select>
            </Field>
            <Field label="التاريخ">
              <input type="date" value={form.quote_date} onChange={(e) => setForm((f) => ({ ...f, quote_date: e.target.value }))} dir="ltr" className={inputCls} />
            </Field>
            <Field label="صالح حتى">
              <input type="date" value={form.valid_until} onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))} dir="ltr" className={inputCls} />
            </Field>
          </div>

          {formMerchant && !formMerchant.price_tier_id && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">التاجر بلا فئة سعر — أدخل الأسعار يدوياً.</p>
          )}

          <div>
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <p className="text-sm font-medium">البنود</p>
              <div className="flex items-center gap-2">
                <input
                  value={scanValue}
                  onChange={(e) => setScanValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addByBarcode(scanValue); } }}
                  dir="ltr" placeholder="📷 امسح باركود…"
                  className="w-44 border border-border rounded-lg px-3 py-1.5 outline-none focus:border-primary bg-card text-sm"
                />
                <button type="button" onClick={() => setForm((f) => ({ ...f, items: [...f.items, emptyItem()] }))} className="text-sm border border-border rounded-lg px-3 py-1.5 hover:bg-background transition">+ بند</button>
              </div>
            </div>
            {scanError && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-1.5 mb-2">{scanError}</p>}
            <div className="space-y-2">
              {form.items.map((it, i) => {
                const q = Number(it.quantity) || 0, p = Number(it.unit_price) || 0, d = Number(it.discount) || 0;
                const lt = Math.max(q * p - d, 0);
                return (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-12 sm:col-span-5">
                      <select value={it.product_id} onChange={(e) => onProductChange(i, e.target.value)} className={inputCls}>
                        <option value="">— اختر منتجاً —</option>
                        {products.map((pr) => (<option key={pr.id} value={pr.id}>{pr.name}{pr.sku ? ` (${pr.sku})` : ""}</option>))}
                      </select>
                    </div>
                    <div className="col-span-3 sm:col-span-2">
                      <input type="number" min="0" step="any" placeholder="كمية" value={it.quantity} onChange={(e) => setItem(i, { quantity: e.target.value })} dir="ltr" className={inputCls} />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <input type="number" min="0" step="any" placeholder="سعر" value={it.unit_price} onChange={(e) => setItem(i, { unit_price: e.target.value })} dir="ltr" readOnly={!canEditPrice} className={`${inputCls} ${!canEditPrice ? "bg-background text-muted" : ""}`} />
                    </div>
                    <div className="col-span-3 sm:col-span-2">
                      <input type="number" min="0" step="any" placeholder="خصم" value={it.discount} onChange={(e) => setItem(i, { discount: e.target.value })} dir="ltr" className={inputCls} />
                    </div>
                    <div className="col-span-2 sm:col-span-1 flex items-center justify-between gap-1">
                      <span className="text-xs text-muted tabular hidden sm:inline">{fmtMoney(lt)}</span>
                      <button type="button" onClick={() => setForm((f) => ({ ...f, items: f.items.length > 1 ? f.items.filter((_, idx) => idx !== i) : f.items }))} className="text-muted hover:text-red-600 text-lg leading-none" aria-label="حذف">×</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="خصم على العرض">
              <input type="number" min="0" step="any" value={form.discount} onChange={(e) => setForm((f) => ({ ...f, discount: e.target.value }))} dir="ltr" className={inputCls} />
            </Field>
            <Field label="ملاحظات">
              <input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className={inputCls} />
            </Field>
          </div>

          <div className="flex gap-6 text-sm bg-background rounded-lg px-4 py-3 flex-wrap">
            <span>المجموع: <b className="tabular">{fmtMoney(totals.subtotal)}</b></span>
            <span className="font-medium">الإجمالي: <b className="tabular">{fmtMoney(totals.total)}</b></span>
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

const inputCls = "w-full border border-border rounded-lg px-3 py-2 outline-none focus:border-primary bg-card";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm mb-1">{label}</label>
      {children}
    </div>
  );
}
