"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { fmtNum, fmtMoney, fmtDate } from "@/lib/format";
import {
  saveSalesDraft,
  updateSalesDraft,
  approveSale,
  discardSale,
  saveReturnDraft,
  approveReturn,
  discardReturn,
  type SalesHeader,
  type SalesItemInput,
  type ReturnHeader,
  type ReturnItemInput,
} from "@/app/(app)/sales/actions";

export type MerchantLite = {
  id: string;
  name: string;
  price_tier_id: string | null;
  credit_limit: number;
  status: "active" | "suspended";
  balance: number;
};
export type SalesProduct = { id: string; name: string; sku: string; barcode?: string | null };
type Warehouse = { id: string; name: string; is_default: boolean };

type InvItem = {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  discount: number;
  line_total: number | null;
};
type Invoice = {
  id: string;
  invoice_number: string | null;
  invoice_date: string;
  sale_type: string;
  status: string;
  currency: string;
  exchange_rate: number;
  discount: number;
  subtotal: number;
  total: number;
  paid_amount: number;
  notes: string | null;
  merchant_id: string;
  warehouse_id: string;
  merchants: { name: string | null } | null;
  sales_invoice_items: InvItem[];
};
type RetItem = {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  line_total: number | null;
};
type Return = {
  id: string;
  return_number: string | null;
  return_date: string;
  status: string;
  total: number;
  merchant_id: string;
  original_invoice_id: string | null;
  merchants: { name: string | null } | null;
  sales_return_items: RetItem[];
};

type Props = {
  invoices: Invoice[];
  returns: Return[];
  merchants: MerchantLite[];
  warehouses: Warehouse[];
  products: SalesProduct[];
  pricesByProductTier: Record<string, Record<string, number>>;
  defaultUsdRate: number;
  canCreate: boolean;
  canApprove: boolean;
  canEditPrice: boolean;
  canOverrideCredit: boolean;
  canReturn: boolean;
};

const SALE_TYPE: Record<string, string> = { cash: "نقد", credit: "آجل", partial: "جزئي" };
const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "مسودة", cls: "bg-amber-50 text-amber-700" },
  approved: { label: "معتمدة", cls: "bg-green-50 text-green-700" },
  delivered: { label: "مُسلّمة", cls: "bg-blue-50 text-blue-700" },
  cancelled: { label: "ملغاة", cls: "bg-border text-muted" },
};

type ItemRow = { product_id: string; quantity: string; unit_price: string; discount: string };
type RItemRow = { product_id: string; quantity: string; unit_price: string };
const today = () => new Date().toISOString().slice(0, 10);
const emptyItem = (): ItemRow => ({ product_id: "", quantity: "", unit_price: "", discount: "" });
const emptyRItem = (): RItemRow => ({ product_id: "", quantity: "", unit_price: "" });

type InvForm = {
  merchant_id: string;
  warehouse_id: string;
  invoice_date: string;
  sale_type: "cash" | "credit" | "partial";
  currency: string;
  exchange_rate: string;
  discount: string;
  paid_amount: string;
  notes: string;
  items: ItemRow[];
};
type RetForm = {
  merchant_id: string;
  warehouse_id: string;
  original_invoice_id: string;
  return_date: string;
  notes: string;
  items: RItemRow[];
};

export default function SalesClient(props: Props) {
  const {
    invoices, returns, merchants, warehouses, products, pricesByProductTier,
    defaultUsdRate, canCreate, canApprove, canEditPrice, canOverrideCredit, canReturn,
  } = props;

  const router = useRouter();
  const [tab, setTab] = useState<"invoices" | "returns">("invoices");
  const [pending, startTransition] = useTransition();
  const [rowError, setRowError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const defWh = warehouses.find((w) => w.is_default) ?? warehouses[0];
  const merchantById = (id: string) => merchants.find((m) => m.id === id);
  const productLabel = (id: string) => {
    const p = products.find((x) => x.id === id);
    return p ? `${p.name}${p.sku ? ` (${p.sku})` : ""}` : "—";
  };
  const priceFor = (pid: string, m?: MerchantLite) =>
    m?.price_tier_id ? pricesByProductTier[pid]?.[m.price_tier_id] ?? 0 : 0;

  // ---------------- Invoice modal ----------------
  const [invOpen, setInvOpen] = useState(false);
  const [invEditId, setInvEditId] = useState<string | null>(null);
  const [invForm, setInvForm] = useState<InvForm>(() => newInvForm(defWh?.id));
  const [invError, setInvError] = useState<string | null>(null);
  const [scanValue, setScanValue] = useState("");
  const [scanError, setScanError] = useState<string | null>(null);

  function newInvForm(whId?: string): InvForm {
    return {
      merchant_id: "",
      warehouse_id: whId ?? "",
      invoice_date: today(),
      sale_type: "cash",
      currency: "IQD",
      exchange_rate: "1",
      discount: "0",
      paid_amount: "0",
      notes: "",
      items: [emptyItem()],
    };
  }

  const invTotals = useMemo(() => {
    const subtotal = invForm.items.reduce((s, it) => {
      const q = Number(it.quantity) || 0, p = Number(it.unit_price) || 0, d = Number(it.discount) || 0;
      return s + Math.max(q * p - d, 0);
    }, 0);
    const total = Math.max(subtotal - (Number(invForm.discount) || 0), 0);
    let paid = 0;
    if (invForm.sale_type === "cash") paid = total;
    else if (invForm.sale_type === "credit") paid = 0;
    else paid = Math.min(Math.max(Number(invForm.paid_amount) || 0, 0), total);
    return { subtotal, total, paid, creditPortion: Math.max(total - paid, 0) };
  }, [invForm]);

  const invMerchant = merchantById(invForm.merchant_id);
  const willExceed =
    !!invMerchant &&
    invTotals.creditPortion > 0 &&
    invMerchant.balance + invTotals.creditPortion > invMerchant.credit_limit;

  function openNewInvoice() {
    setInvEditId(null);
    setInvForm(newInvForm(defWh?.id));
    setInvError(null);
    setInvOpen(true);
  }
  function openEditInvoice(inv: Invoice) {
    setInvEditId(inv.id);
    setInvError(null);
    setInvForm({
      merchant_id: inv.merchant_id,
      warehouse_id: inv.warehouse_id,
      invoice_date: inv.invoice_date,
      sale_type: inv.sale_type as "cash" | "credit" | "partial",
      currency: inv.currency,
      exchange_rate: String(inv.exchange_rate),
      discount: String(inv.discount),
      paid_amount: String(inv.paid_amount),
      notes: inv.notes ?? "",
      items:
        inv.sales_invoice_items.length > 0
          ? inv.sales_invoice_items.map((it) => ({
              product_id: it.product_id,
              quantity: String(it.quantity),
              unit_price: String(it.unit_price),
              discount: String(it.discount),
            }))
          : [emptyItem()],
    });
    setInvOpen(true);
  }

  function setInvItem(i: number, patch: Partial<ItemRow>) {
    setInvForm((f) => ({ ...f, items: f.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) }));
  }
  function onInvProductChange(i: number, pid: string) {
    const price = priceFor(pid, invMerchant);
    setInvForm((f) => ({
      ...f,
      items: f.items.map((it, idx) =>
        idx === i
          ? { ...it, product_id: pid, unit_price: price ? String(price) : it.unit_price }
          : it,
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
    const price = priceFor(prod.id, invMerchant);
    setInvForm((f) => {
      const existingIdx = f.items.findIndex((it) => it.product_id === prod.id);
      if (existingIdx >= 0) {
        return {
          ...f,
          items: f.items.map((it, idx) =>
            idx === existingIdx ? { ...it, quantity: String((Number(it.quantity) || 0) + 1) } : it,
          ),
        };
      }
      const newRow: ItemRow = {
        product_id: prod.id,
        quantity: "1",
        unit_price: price ? String(price) : "",
        discount: "",
      };
      const emptyIdx = f.items.findIndex((it) => !it.product_id);
      if (emptyIdx >= 0) {
        return { ...f, items: f.items.map((it, idx) => (idx === emptyIdx ? newRow : it)) };
      }
      return { ...f, items: [...f.items, newRow] };
    });
    setScanValue("");
  }

  function onMerchantChange(mid: string) {
    const m = merchantById(mid);
    setInvForm((f) => ({
      ...f,
      merchant_id: mid,
      items: f.items.map((it) =>
        it.product_id ? { ...it, unit_price: String(priceFor(it.product_id, m) || it.unit_price) } : it,
      ),
    }));
  }

  function submitInvoice(e: React.FormEvent) {
    e.preventDefault();
    setInvError(null);
    if (invMerchant?.status === "suspended") {
      setInvError("التاجر موقوف؛ لا يمكن إصدار فاتورة له.");
      return;
    }
    const header: SalesHeader = {
      merchant_id: invForm.merchant_id,
      warehouse_id: invForm.warehouse_id,
      invoice_date: invForm.invoice_date,
      sale_type: invForm.sale_type,
      currency: invForm.currency,
      exchange_rate: Number(invForm.exchange_rate) || 1,
      discount: Number(invForm.discount) || 0,
      paid_amount: invTotals.paid,
      notes: invForm.notes.trim() || null,
    };
    const items: SalesItemInput[] = invForm.items
      .filter((it) => it.product_id && Number(it.quantity) > 0)
      .map((it) => ({
        product_id: it.product_id,
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price) || 0,
        discount: Number(it.discount) || 0,
      }));
    startTransition(async () => {
      const res = invEditId
        ? await updateSalesDraft(invEditId, header, items)
        : await saveSalesDraft(header, items);
      if (!res.ok) {
        setInvError(res.error ?? "حدث خطأ");
        return;
      }
      setInvOpen(false);
      router.refresh();
    });
  }

  function doApprove(inv: Invoice, override = false) {
    setRowError(null);
    startTransition(async () => {
      const res = await approveSale(inv.id, override);
      if (!res.ok) {
        const msg = res.error ?? "تعذّر الاعتماد";
        if (!override && canOverrideCredit && msg.includes("الائتماني")) {
          if (confirm(`${msg}\n\nهل تعتمد الفاتورة بتجاوز السقف (بموافقة مدير المبيعات)؟`)) {
            doApprove(inv, true);
            return;
          }
        }
        setRowError(msg);
      } else router.refresh();
    });
  }
  function doDiscard(inv: Invoice) {
    if (!confirm(`حذف المسودة ${inv.invoice_number ?? ""}؟`)) return;
    setRowError(null);
    startTransition(async () => {
      const res = await discardSale(inv.id);
      if (!res.ok) setRowError(res.error ?? "تعذّر الحذف");
      else router.refresh();
    });
  }

  // ---------------- Return modal ----------------
  const [retOpen, setRetOpen] = useState(false);
  const [retForm, setRetForm] = useState<RetForm>(() => ({
    merchant_id: "", warehouse_id: defWh?.id ?? "", original_invoice_id: "",
    return_date: today(), notes: "", items: [emptyRItem()],
  }));
  const [retError, setRetError] = useState<string | null>(null);

  const retTotal = useMemo(
    () => retForm.items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0),
    [retForm.items],
  );
  function openNewReturn() {
    setRetForm({
      merchant_id: "", warehouse_id: defWh?.id ?? "", original_invoice_id: "",
      return_date: today(), notes: "", items: [emptyRItem()],
    });
    setRetError(null);
    setRetOpen(true);
  }
  function setRetItem(i: number, patch: Partial<RItemRow>) {
    setRetForm((f) => ({ ...f, items: f.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) }));
  }
  function submitReturn(e: React.FormEvent) {
    e.preventDefault();
    setRetError(null);
    const header: ReturnHeader = {
      merchant_id: retForm.merchant_id,
      warehouse_id: retForm.warehouse_id,
      original_invoice_id: retForm.original_invoice_id || null,
      return_date: retForm.return_date,
      notes: retForm.notes.trim() || null,
    };
    const items: ReturnItemInput[] = retForm.items
      .filter((it) => it.product_id && Number(it.quantity) > 0)
      .map((it) => ({
        product_id: it.product_id,
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price) || 0,
      }));
    startTransition(async () => {
      const res = await saveReturnDraft(header, items);
      if (!res.ok) {
        setRetError(res.error ?? "حدث خطأ");
        return;
      }
      setRetOpen(false);
      router.refresh();
    });
  }
  function doApproveReturn(r: Return) {
    if (!confirm(`اعتماد المرتجع ${r.return_number ?? ""}؟ ستُعاد الكمية للمخزون وتُنقص ذمة التاجر.`))
      return;
    setRowError(null);
    startTransition(async () => {
      const res = await approveReturn(r.id);
      if (!res.ok) setRowError(res.error ?? "تعذّر الاعتماد");
      else router.refresh();
    });
  }
  function doDiscardReturn(r: Return) {
    if (!confirm(`حذف المرتجع ${r.return_number ?? ""}؟`)) return;
    setRowError(null);
    startTransition(async () => {
      const res = await discardReturn(r.id);
      if (!res.ok) setRowError(res.error ?? "تعذّر الحذف");
      else router.refresh();
    });
  }

  const cur = (c: string) => (c === "USD" ? "$" : "د.ع");
  const activeMerchants = merchants.filter((m) => m.status === "active");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">فواتير البيع</h1>
          <p className="text-muted mt-1 text-sm">
            البيع لا يعني قبض المال. الاعتماد يخصم المخزون ويثبّت التكلفة ويسجّل الذمة.
          </p>
        </div>
        <div className="flex gap-2">
          {tab === "invoices" && canCreate && (
            <button
              onClick={openNewInvoice}
              className="bg-primary hover:bg-[var(--primary-hover)] text-white rounded-lg py-2.5 px-5 text-sm font-medium transition"
            >
              + فاتورة بيع
            </button>
          )}
          {tab === "returns" && canReturn && (
            <button
              onClick={openNewReturn}
              className="bg-primary hover:bg-[var(--primary-hover)] text-white rounded-lg py-2.5 px-5 text-sm font-medium transition"
            >
              + مرتجع بيع
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2 border-b border-border">
        {(["invoices", "returns"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              tab === t ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t === "invoices" ? "الفواتير" : "المرتجعات"}
          </button>
        ))}
      </div>

      {rowError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{rowError}</p>}

      {tab === "invoices" ? (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-background text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">الرقم</th>
                  <th className="px-4 py-3 font-medium">التاريخ</th>
                  <th className="px-4 py-3 font-medium">التاجر</th>
                  <th className="px-4 py-3 font-medium">النوع</th>
                  <th className="px-4 py-3 font-medium">الإجمالي</th>
                  <th className="px-4 py-3 font-medium">المتبقّي</th>
                  <th className="px-4 py-3 font-medium">الحالة</th>
                  <th className="px-4 py-3 font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const st = STATUS[inv.status] ?? STATUS.draft;
                  const isOpen = expanded === inv.id;
                  const remaining = Math.max(inv.total - inv.paid_amount, 0);
                  return (
                    <Fragment key={inv.id}>
                      <tr className="border-t border-border">
                        <td className="px-4 py-3 tabular" dir="ltr">
                          <button onClick={() => setExpanded(isOpen ? null : inv.id)} className="text-primary hover:underline">
                            {inv.invoice_number ?? "—"}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-muted tabular">{fmtDate(inv.invoice_date)}</td>
                        <td className="px-4 py-3">{inv.merchants?.name ?? "—"}</td>
                        <td className="px-4 py-3 text-muted">{SALE_TYPE[inv.sale_type] ?? inv.sale_type}</td>
                        <td className="px-4 py-3 tabular">{fmtMoney(inv.total)} {cur(inv.currency)}</td>
                        <td className="px-4 py-3 tabular">
                          <span className={remaining > 0 ? "text-amber-700" : "text-green-700"}>
                            {fmtMoney(remaining)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs rounded-full px-2.5 py-1 ${st.cls}`}>{st.label}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2 flex-wrap">
                            {inv.status === "draft" && canCreate && (
                              <button onClick={() => openEditInvoice(inv)} className="text-sm border border-border rounded-lg px-3 py-1.5 hover:bg-background transition">تعديل</button>
                            )}
                            {inv.status === "draft" && canApprove && (
                              <button disabled={pending} onClick={() => doApprove(inv)} className="text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg px-3 py-1.5 transition disabled:opacity-40">اعتماد</button>
                            )}
                            {inv.status === "draft" && canCreate && (
                              <button disabled={pending} onClick={() => doDiscard(inv)} className="text-sm border border-border rounded-lg px-3 py-1.5 hover:bg-background transition disabled:opacity-40">حذف</button>
                            )}
                            {inv.status !== "draft" && (
                              <button onClick={() => setExpanded(isOpen ? null : inv.id)} className="text-sm border border-border rounded-lg px-3 py-1.5 hover:bg-background transition">{isOpen ? "إخفاء" : "عرض"}</button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-background/50">
                          <td colSpan={8} className="px-4 py-3">
                            <div className="rounded-lg border border-border overflow-hidden">
                              <table className="w-full text-xs text-right">
                                <thead className="bg-background text-muted">
                                  <tr>
                                    <th className="px-3 py-2 font-medium">المنتج</th>
                                    <th className="px-3 py-2 font-medium">الكمية</th>
                                    <th className="px-3 py-2 font-medium">السعر</th>
                                    <th className="px-3 py-2 font-medium">خصم</th>
                                    <th className="px-3 py-2 font-medium">الإجمالي</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {inv.sales_invoice_items.map((it) => (
                                    <tr key={it.id} className="border-t border-border">
                                      <td className="px-3 py-2">{productLabel(it.product_id)}</td>
                                      <td className="px-3 py-2 tabular">{fmtNum(it.quantity)}</td>
                                      <td className="px-3 py-2 tabular">{fmtMoney(it.unit_price)}</td>
                                      <td className="px-3 py-2 tabular">{fmtMoney(it.discount)}</td>
                                      <td className="px-3 py-2 tabular">{fmtMoney(it.line_total)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <div className="flex gap-6 mt-2 text-xs text-muted flex-wrap">
                              <span>المجموع: {fmtMoney(inv.subtotal)} {cur(inv.currency)}</span>
                              <span>خصم: {fmtMoney(inv.discount)}</span>
                              <span className="font-medium text-foreground">الصافي: {fmtMoney(inv.total)}</span>
                              <span>مقبوض: {fmtMoney(inv.paid_amount)}</span>
                              <span className="font-medium">المتبقّي بالذمة: {fmtMoney(Math.max(inv.total - inv.paid_amount, 0))}</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {invoices.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-muted">لا توجد فواتير بعد.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-background text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">الرقم</th>
                  <th className="px-4 py-3 font-medium">التاريخ</th>
                  <th className="px-4 py-3 font-medium">التاجر</th>
                  <th className="px-4 py-3 font-medium">الإجمالي</th>
                  <th className="px-4 py-3 font-medium">الحالة</th>
                  <th className="px-4 py-3 font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {returns.map((r) => {
                  const st = STATUS[r.status] ?? STATUS.draft;
                  const isOpen = expanded === r.id;
                  return (
                    <Fragment key={r.id}>
                      <tr className="border-t border-border">
                        <td className="px-4 py-3 tabular" dir="ltr">
                          <button onClick={() => setExpanded(isOpen ? null : r.id)} className="text-primary hover:underline">{r.return_number ?? "—"}</button>
                        </td>
                        <td className="px-4 py-3 text-muted tabular">{fmtDate(r.return_date)}</td>
                        <td className="px-4 py-3">{r.merchants?.name ?? "—"}</td>
                        <td className="px-4 py-3 tabular">{fmtMoney(r.total)} د.ع</td>
                        <td className="px-4 py-3"><span className={`text-xs rounded-full px-2.5 py-1 ${st.cls}`}>{st.label}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2 flex-wrap">
                            {r.status === "draft" && canReturn && (
                              <button disabled={pending} onClick={() => doApproveReturn(r)} className="text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg px-3 py-1.5 transition disabled:opacity-40">اعتماد</button>
                            )}
                            {r.status === "draft" && canReturn && (
                              <button disabled={pending} onClick={() => doDiscardReturn(r)} className="text-sm border border-border rounded-lg px-3 py-1.5 hover:bg-background transition disabled:opacity-40">حذف</button>
                            )}
                            {r.status !== "draft" && (
                              <button onClick={() => setExpanded(isOpen ? null : r.id)} className="text-sm border border-border rounded-lg px-3 py-1.5 hover:bg-background transition">{isOpen ? "إخفاء" : "عرض"}</button>
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
                                  <tr><th className="px-3 py-2 font-medium">المنتج</th><th className="px-3 py-2 font-medium">الكمية</th><th className="px-3 py-2 font-medium">السعر</th><th className="px-3 py-2 font-medium">الإجمالي</th></tr>
                                </thead>
                                <tbody>
                                  {r.sales_return_items.map((it) => (
                                    <tr key={it.id} className="border-t border-border">
                                      <td className="px-3 py-2">{productLabel(it.product_id)}</td>
                                      <td className="px-3 py-2 tabular">{fmtNum(it.quantity)}</td>
                                      <td className="px-3 py-2 tabular">{fmtMoney(it.unit_price)}</td>
                                      <td className="px-3 py-2 tabular">{fmtMoney(it.line_total)}</td>
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
                {returns.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-muted">لا توجد مرتجعات بعد.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------- Invoice Modal ---------------- */}
      <Modal open={invOpen} onClose={() => setInvOpen(false)} title={invEditId ? "تعديل فاتورة بيع" : "فاتورة بيع جديدة"} wide>
        <form onSubmit={submitInvoice} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="التاجر *">
              <select value={invForm.merchant_id} onChange={(e) => onMerchantChange(e.target.value)} className={inputCls}>
                <option value="">— اختر تاجراً —</option>
                {activeMerchants.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </Field>
            <Field label="المخزن *">
              <select value={invForm.warehouse_id} onChange={(e) => setInvForm((f) => ({ ...f, warehouse_id: e.target.value }))} className={inputCls}>
                {warehouses.map((w) => (<option key={w.id} value={w.id}>{w.name}</option>))}
              </select>
            </Field>
            <Field label="التاريخ *">
              <input type="date" value={invForm.invoice_date} onChange={(e) => setInvForm((f) => ({ ...f, invoice_date: e.target.value }))} dir="ltr" className={inputCls} />
            </Field>
            <Field label="نوع البيع">
              <select value={invForm.sale_type} onChange={(e) => setInvForm((f) => ({ ...f, sale_type: e.target.value as InvForm["sale_type"] }))} className={inputCls}>
                <option value="cash">نقد</option>
                <option value="credit">آجل</option>
                <option value="partial">جزئي (دفعة أولى)</option>
              </select>
            </Field>
            <Field label="العملة">
              <select value={invForm.currency} onChange={(e) => setInvForm((f) => ({ ...f, currency: e.target.value, exchange_rate: e.target.value === "IQD" ? "1" : String(defaultUsdRate || 1) }))} className={inputCls}>
                <option value="IQD">دينار (IQD)</option>
                <option value="USD">دولار (USD)</option>
              </select>
            </Field>
            {invForm.currency !== "IQD" && (
              <Field label="سعر الصرف">
                <input type="number" min="0" step="any" value={invForm.exchange_rate} onChange={(e) => setInvForm((f) => ({ ...f, exchange_rate: e.target.value }))} dir="ltr" className={inputCls} />
              </Field>
            )}
          </div>

          {invMerchant && (
            <div className="text-xs bg-background rounded-lg px-4 py-2 flex gap-6 flex-wrap">
              <span>الرصيد الحالي: <b className="tabular">{fmtMoney(invMerchant.balance)}</b></span>
              <span>السقف: <b className="tabular">{fmtMoney(invMerchant.credit_limit)}</b></span>
              {invMerchant.price_tier_id ? <span className="text-muted">التسعير تلقائي حسب فئة التاجر</span> : <span className="text-amber-700">التاجر بلا فئة سعر — أدخل الأسعار يدوياً</span>}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <p className="text-sm font-medium">البنود</p>
              <div className="flex items-center gap-2">
                <input
                  value={scanValue}
                  onChange={(e) => setScanValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addByBarcode(scanValue);
                    }
                  }}
                  dir="ltr"
                  placeholder="📷 امسح باركود…"
                  className="w-44 border border-border rounded-lg px-3 py-1.5 outline-none focus:border-primary bg-card text-sm"
                />
                <button type="button" onClick={() => setInvForm((f) => ({ ...f, items: [...f.items, emptyItem()] }))} className="text-sm border border-border rounded-lg px-3 py-1.5 hover:bg-background transition">+ بند</button>
              </div>
            </div>
            {scanError && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-1.5 mb-2">{scanError}</p>}
            <div className="space-y-2">
              {invForm.items.map((it, i) => {
                const q = Number(it.quantity) || 0, p = Number(it.unit_price) || 0, d = Number(it.discount) || 0;
                const lt = Math.max(q * p - d, 0);
                return (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-12 sm:col-span-5">
                      <select value={it.product_id} onChange={(e) => onInvProductChange(i, e.target.value)} className={inputCls}>
                        <option value="">— اختر منتجاً —</option>
                        {products.map((pr) => (<option key={pr.id} value={pr.id}>{pr.name}{pr.sku ? ` (${pr.sku})` : ""}</option>))}
                      </select>
                    </div>
                    <div className="col-span-3 sm:col-span-2">
                      <input type="number" min="0" step="any" placeholder="كمية" value={it.quantity} onChange={(e) => setInvItem(i, { quantity: e.target.value })} dir="ltr" className={inputCls} />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <input type="number" min="0" step="any" placeholder="سعر" value={it.unit_price} onChange={(e) => setInvItem(i, { unit_price: e.target.value })} dir="ltr" readOnly={!canEditPrice} className={`${inputCls} ${!canEditPrice ? "bg-background text-muted" : ""}`} />
                    </div>
                    <div className="col-span-3 sm:col-span-2">
                      <input type="number" min="0" step="any" placeholder="خصم" value={it.discount} onChange={(e) => setInvItem(i, { discount: e.target.value })} dir="ltr" className={inputCls} />
                    </div>
                    <div className="col-span-2 sm:col-span-1 flex items-center justify-between gap-1">
                      <span className="text-xs text-muted tabular hidden sm:inline">{fmtMoney(lt)}</span>
                      <button type="button" onClick={() => setInvForm((f) => ({ ...f, items: f.items.length > 1 ? f.items.filter((_, idx) => idx !== i) : f.items }))} className="text-muted hover:text-red-600 text-lg leading-none" aria-label="حذف">×</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="خصم على الفاتورة">
              <input type="number" min="0" step="any" value={invForm.discount} onChange={(e) => setInvForm((f) => ({ ...f, discount: e.target.value }))} dir="ltr" className={inputCls} />
            </Field>
            {invForm.sale_type === "partial" && (
              <Field label="الدفعة الأولى (مقبوض)">
                <input type="number" min="0" step="any" value={invForm.paid_amount} onChange={(e) => setInvForm((f) => ({ ...f, paid_amount: e.target.value }))} dir="ltr" className={inputCls} />
              </Field>
            )}
            <Field label="ملاحظات">
              <input value={invForm.notes} onChange={(e) => setInvForm((f) => ({ ...f, notes: e.target.value }))} className={inputCls} />
            </Field>
          </div>

          <div className="flex gap-6 text-sm bg-background rounded-lg px-4 py-3 flex-wrap">
            <span>المجموع: <b className="tabular">{fmtMoney(invTotals.subtotal)}</b></span>
            <span className="font-medium">الصافي: <b className="tabular">{fmtMoney(invTotals.total)}</b></span>
            <span>مقبوض: <b className="tabular">{fmtMoney(invTotals.paid)}</b></span>
            <span>آجل بالذمة: <b className="tabular">{fmtMoney(invTotals.creditPortion)}</b></span>
          </div>

          {willExceed && (
            <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
              تنبيه: هذه الفاتورة ستتجاوز السقف الائتماني للتاجر. سيتطلب اعتمادها موافقة مدير المبيعات.
            </p>
          )}
          {invError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{invError}</p>}

          <div className="flex gap-3 pt-1">
            <button disabled={pending} className="bg-primary hover:bg-[var(--primary-hover)] text-white rounded-lg py-2.5 px-6 text-sm font-medium transition disabled:opacity-60">{pending ? "جارٍ الحفظ…" : "حفظ كمسودة"}</button>
            <button type="button" onClick={() => setInvOpen(false)} className="border border-border rounded-lg py-2.5 px-6 text-sm hover:bg-background transition">إلغاء</button>
          </div>
        </form>
      </Modal>

      {/* ---------------- Return Modal ---------------- */}
      <Modal open={retOpen} onClose={() => setRetOpen(false)} title="مرتجع بيع جديد" wide>
        <form onSubmit={submitReturn} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="التاجر *">
              <select value={retForm.merchant_id} onChange={(e) => setRetForm((f) => ({ ...f, merchant_id: e.target.value }))} className={inputCls}>
                <option value="">— اختر تاجراً —</option>
                {merchants.map((m) => (<option key={m.id} value={m.id}>{m.name}</option>))}
              </select>
            </Field>
            <Field label="المخزن *">
              <select value={retForm.warehouse_id} onChange={(e) => setRetForm((f) => ({ ...f, warehouse_id: e.target.value }))} className={inputCls}>
                {warehouses.map((w) => (<option key={w.id} value={w.id}>{w.name}</option>))}
              </select>
            </Field>
            <Field label="التاريخ">
              <input type="date" value={retForm.return_date} onChange={(e) => setRetForm((f) => ({ ...f, return_date: e.target.value }))} dir="ltr" className={inputCls} />
            </Field>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">البنود المرتجعة</p>
              <button type="button" onClick={() => setRetForm((f) => ({ ...f, items: [...f.items, emptyRItem()] }))} className="text-sm border border-border rounded-lg px-3 py-1.5 hover:bg-background transition">+ بند</button>
            </div>
            <div className="space-y-2">
              {retForm.items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-12 sm:col-span-6">
                    <select value={it.product_id} onChange={(e) => setRetItem(i, { product_id: e.target.value })} className={inputCls}>
                      <option value="">— اختر منتجاً —</option>
                      {products.map((pr) => (<option key={pr.id} value={pr.id}>{pr.name}{pr.sku ? ` (${pr.sku})` : ""}</option>))}
                    </select>
                  </div>
                  <div className="col-span-5 sm:col-span-3">
                    <input type="number" min="0" step="any" placeholder="كمية" value={it.quantity} onChange={(e) => setRetItem(i, { quantity: e.target.value })} dir="ltr" className={inputCls} />
                  </div>
                  <div className="col-span-5 sm:col-span-2">
                    <input type="number" min="0" step="any" placeholder="سعر" value={it.unit_price} onChange={(e) => setRetItem(i, { unit_price: e.target.value })} dir="ltr" className={inputCls} />
                  </div>
                  <div className="col-span-2 sm:col-span-1 flex justify-end">
                    <button type="button" onClick={() => setRetForm((f) => ({ ...f, items: f.items.length > 1 ? f.items.filter((_, idx) => idx !== i) : f.items }))} className="text-muted hover:text-red-600 text-lg leading-none" aria-label="حذف">×</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Field label="ملاحظات">
            <input value={retForm.notes} onChange={(e) => setRetForm((f) => ({ ...f, notes: e.target.value }))} className={inputCls} />
          </Field>

          <div className="text-sm bg-background rounded-lg px-4 py-3">
            <span className="font-medium">إجمالي المرتجع: <b className="tabular">{fmtMoney(retTotal)}</b> د.ع</span>
          </div>

          {retError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{retError}</p>}

          <div className="flex gap-3 pt-1">
            <button disabled={pending} className="bg-primary hover:bg-[var(--primary-hover)] text-white rounded-lg py-2.5 px-6 text-sm font-medium transition disabled:opacity-60">{pending ? "جارٍ الحفظ…" : "حفظ كمسودة"}</button>
            <button type="button" onClick={() => setRetOpen(false)} className="border border-border rounded-lg py-2.5 px-6 text-sm hover:bg-background transition">إلغاء</button>
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
