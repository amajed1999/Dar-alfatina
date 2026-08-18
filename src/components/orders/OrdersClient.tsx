"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fmtMoney, fmtNum, fmtDate } from "@/lib/format";
import { updateOrderStatus, convertOrderToInvoice } from "@/app/(app)/orders/actions";

type Item = { id: string; name: string; qty: number; price: number; line: number };
export type OrderRow = {
  id: string;
  order_number: string | null;
  order_date: string;
  status: string;
  total: number;
  notes: string | null;
  merchant_name: string;
  shop_name: string | null;
  has_invoice: boolean;
  items: Item[];
};

const money = (n: number | null | undefined) => `${fmtMoney(n ?? 0)} د.ع`;
const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "قيد المراجعة", cls: "bg-blue-50 text-blue-700" },
  preparing: { label: "قيد التجهيز", cls: "bg-amber-50 text-amber-700" },
  shipping: { label: "بالطريق", cls: "bg-purple-50 text-purple-700" },
  delivered: { label: "تم التسليم", cls: "bg-green-50 text-green-700" },
  cancelled: { label: "ملغى", cls: "bg-red-50 text-red-700" },
};
const NEXT: Record<string, { to: string; label: string }[]> = {
  pending: [{ to: "preparing", label: "بدء التجهيز" }, { to: "cancelled", label: "إلغاء" }],
  preparing: [{ to: "shipping", label: "إرسال (بالطريق)" }, { to: "cancelled", label: "إلغاء" }],
  shipping: [{ to: "delivered", label: "تم التسليم" }],
  delivered: [],
  cancelled: [],
};

export default function OrdersClient({
  orders, canManage, canInvoice,
}: {
  orders: OrderRow[];
  canManage: boolean;
  canInvoice: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length };
    for (const o of orders) c[o.status] = (c[o.status] ?? 0) + 1;
    return c;
  }, [orders]);

  const filtered = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  function setStatus(o: OrderRow, to: string) {
    if (to === "cancelled" && !confirm(`إلغاء الطلب ${o.order_number ?? ""}؟`)) return;
    setError(null);
    startTransition(async () => {
      const res = await updateOrderStatus(o.id, to);
      if (!res.ok) setError(res.error ?? "تعذّر التحديث");
      else router.refresh();
    });
  }
  function toInvoice(o: OrderRow) {
    if (!confirm(`تحويل الطلب ${o.order_number ?? ""} إلى فاتورة بيع مسودّة؟`)) return;
    setError(null);
    startTransition(async () => {
      const res = await convertOrderToInvoice(o.id);
      if (!res.ok) setError(res.error ?? "تعذّر التحويل");
      else router.refresh();
    });
  }

  const tabs: [string, string][] = [
    ["all", "الكل"], ["pending", "قيد المراجعة"], ["preparing", "قيد التجهيز"],
    ["shipping", "بالطريق"], ["delivered", "تم التسليم"],
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">طلبات التجار</h1>
        <p className="text-muted mt-1 text-sm">الطلبات الواردة من بوابات التجار. حدّث حالتها وحوّلها لفواتير.</p>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex gap-2 border-b border-border flex-wrap">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              filter === k ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {label}{counts[k] ? <span className="text-xs mr-1 tabular">({counts[k]})</span> : ""}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((o) => {
          const st = STATUS[o.status] ?? STATUS.pending;
          const isOpen = expanded === o.id;
          return (
            <div key={o.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="p-4 flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => setExpanded(isOpen ? null : o.id)} className="font-semibold tabular hover:text-primary" dir="ltr">
                      {o.order_number}
                    </button>
                    <span className={`text-xs rounded-full px-2.5 py-1 ${st.cls}`}>{st.label}</span>
                    {o.has_invoice && <span className="text-[10px] bg-green-50 text-green-700 rounded px-1.5 py-0.5">حُوّل لفاتورة</span>}
                  </div>
                  <div className="text-xs text-muted mt-1 flex gap-3 flex-wrap">
                    <span className="font-medium text-foreground">{o.merchant_name}</span>
                    {o.shop_name && <span>{o.shop_name}</span>}
                    <span>{fmtDate(o.order_date)}</span>
                    <span className="font-semibold text-foreground tabular">{money(o.total)}</span>
                  </div>
                </div>
                <button onClick={() => setExpanded(isOpen ? null : o.id)} className="text-sm border border-border rounded-lg px-3 py-1.5 hover:bg-background transition shrink-0">
                  {isOpen ? "إخفاء" : "التفاصيل"}
                </button>
              </div>

              {isOpen && (
                <div className="border-t border-border p-4 bg-background/40 space-y-3">
                  <table className="w-full text-sm text-right">
                    <thead className="text-muted">
                      <tr><th className="pb-2 font-medium">المنتج</th><th className="pb-2 font-medium">الكمية</th><th className="pb-2 font-medium">السعر</th><th className="pb-2 font-medium">الإجمالي</th></tr>
                    </thead>
                    <tbody>
                      {o.items.map((it) => (
                        <tr key={it.id} className="border-t border-border">
                          <td className="py-2">{it.name}</td>
                          <td className="py-2 tabular">{fmtNum(it.qty)}</td>
                          <td className="py-2 tabular">{money(it.price)}</td>
                          <td className="py-2 tabular">{money(it.line)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {o.notes && <p className="text-xs text-muted">ملاحظة التاجر: {o.notes}</p>}

                  {(canManage || canInvoice) && (
                    <div className="flex gap-2 flex-wrap pt-1">
                      {canManage && (NEXT[o.status] ?? []).map((n) => (
                        <button
                          key={n.to}
                          disabled={pending}
                          onClick={() => setStatus(o, n.to)}
                          className={`text-sm rounded-lg px-3 py-1.5 transition disabled:opacity-40 ${
                            n.to === "cancelled"
                              ? "border border-border hover:bg-card"
                              : "bg-primary hover:bg-[var(--primary-hover)] text-white"
                          }`}
                        >
                          {n.label}
                        </button>
                      ))}
                      {canInvoice && !o.has_invoice && o.status !== "cancelled" && (
                        <button
                          disabled={pending}
                          onClick={() => toInvoice(o)}
                          className="text-sm border border-primary/30 text-primary bg-primary/5 rounded-lg px-3 py-1.5 hover:bg-primary/10 transition disabled:opacity-40"
                        >
                          تحويل لفاتورة
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="bg-card border border-border rounded-xl px-4 py-12 text-center text-muted">لا طلبات.</div>
        )}
      </div>
    </div>
  );
}
