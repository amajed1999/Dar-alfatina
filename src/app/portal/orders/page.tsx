import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fmtMoney, fmtNum, fmtDate } from "@/lib/format";

const money = (n: number | null | undefined) => `${fmtMoney(n ?? 0)} د.ع`;

const STEPS = [
  { key: "pending", label: "قيد المراجعة" },
  { key: "preparing", label: "قيد التجهيز" },
  { key: "shipping", label: "بالطريق" },
  { key: "delivered", label: "تم التسليم" },
];
const STATUS_AR: Record<string, string> = {
  pending: "قيد المراجعة", preparing: "قيد التجهيز", shipping: "بالطريق",
  delivered: "تم التسليم", cancelled: "ملغى",
};

type Row = {
  order_id: string; order_number: string; order_date: string; status: string;
  total: number; notes: string | null;
  item_id: string | null; product_name: string | null; quantity: number | null; unit_price: number | null; line_total: number | null;
};

export default async function PortalOrders() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("portal_my_orders");
  const rows = (data ?? []) as Row[];

  // تجميع البنود حسب الطلب
  const orders: {
    id: string; number: string; date: string; status: string; total: number; notes: string | null;
    items: { name: string; qty: number; price: number; line: number }[];
  }[] = [];
  const map = new Map<string, number>();
  for (const r of rows) {
    let idx = map.get(r.order_id);
    if (idx == null) {
      idx = orders.length;
      map.set(r.order_id, idx);
      orders.push({ id: r.order_id, number: r.order_number, date: r.order_date, status: r.status, total: r.total, notes: r.notes, items: [] });
    }
    if (r.item_id) orders[idx].items.push({ name: r.product_name ?? "—", qty: r.quantity ?? 0, price: r.unit_price ?? 0, line: r.line_total ?? 0 });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-xl font-bold">طلباتي</h2>
        <Link href="/portal/products" className="bg-primary hover:bg-[var(--primary-hover)] text-white rounded-lg py-2 px-4 text-sm transition">+ طلب جديد</Link>
      </div>

      {orders.length === 0 && (
        <div className="bg-card border border-border rounded-xl px-4 py-12 text-center text-muted">
          لا طلبات بعد. <Link href="/portal/products" className="text-primary hover:underline">اطلب الآن</Link>
        </div>
      )}

      {orders.map((o) => {
        const stepIdx = STEPS.findIndex((s) => s.key === o.status);
        const cancelled = o.status === "cancelled";
        return (
          <div key={o.id} className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3 flex-wrap">
              <div>
                <span className="font-semibold tabular" dir="ltr">{o.number}</span>
                <span className="text-xs text-muted mr-2">{fmtDate(o.date)}</span>
              </div>
              <span className={`text-xs rounded-full px-3 py-1 ${cancelled ? "bg-red-50 text-red-700" : "bg-primary/10 text-primary"}`}>
                {STATUS_AR[o.status] ?? o.status}
              </span>
            </div>

            {!cancelled && (
              <div className="px-4 pt-4">
                <div className="flex items-center">
                  {STEPS.map((s, i) => (
                    <div key={s.key} className="flex-1 flex flex-col items-center relative">
                      {i > 0 && (
                        <div className={`absolute top-2.5 right-1/2 w-full h-0.5 ${i <= stepIdx ? "bg-primary" : "bg-border"}`} />
                      )}
                      <div className={`w-5 h-5 rounded-full z-10 flex items-center justify-center text-[10px] ${
                        i <= stepIdx ? "bg-primary text-white" : "bg-background border border-border text-muted"
                      }`}>{i < stepIdx ? "✓" : i + 1}</div>
                      <span className={`text-[10px] mt-1 ${i <= stepIdx ? "text-foreground font-medium" : "text-muted"}`}>{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-4">
              <table className="w-full text-sm text-right">
                <tbody>
                  {o.items.map((it, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="py-2">{it.name}</td>
                      <td className="py-2 tabular text-muted">{fmtNum(it.qty)} × {money(it.price)}</td>
                      <td className="py-2 tabular text-left">{money(it.line)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-border">
                {o.notes ? <span className="text-xs text-muted">ملاحظة: {o.notes}</span> : <span />}
                <span className="font-bold tabular">الإجمالي: {money(o.total)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
