"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fmtMoney, fmtNum } from "@/lib/format";
import { placeOrder } from "@/app/portal/actions";

export type CatalogProduct = {
  product_id: string;
  name: string;
  sku: string;
  category_name: string | null;
  base_unit_name: string | null;
  price: number | null;
  stock_qty: number | null;
};

const money = (n: number | null | undefined) => `${fmtMoney(n ?? 0)} د.ع`;

export default function PortalOrderClient({ products }: { products: CatalogProduct[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q) || (p.category_name ?? "").toLowerCase().includes(q),
    );
  }, [products, query]);

  const cart = useMemo(
    () =>
      products
        .map((p) => ({ p, q: Number(qty[p.product_id]) || 0 }))
        .filter((x) => x.q > 0),
    [products, qty],
  );
  const totalItems = cart.length;
  const totalAmount = cart.reduce((s, x) => s + x.q * (x.p.price ?? 0), 0);

  function submit() {
    setError(null);
    const items = cart.map((x) => ({ product_id: x.p.product_id, quantity: x.q }));
    if (items.length === 0) return setError("أضف منتجاً واحداً على الأقل.");
    startTransition(async () => {
      const res = await placeOrder(items, notes.trim() || null);
      if (!res.ok) {
        setError(res.error ?? "تعذّر إرسال الطلب");
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/portal/orders"), 900);
    });
  }

  if (done) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center space-y-2">
        <div className="text-3xl">✅</div>
        <p className="font-semibold text-green-800">تم إرسال طلبك بنجاح!</p>
        <p className="text-sm text-green-700">سنتابع تجهيزه، وتقدر تتابع حالته من «طلباتي».</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-28">
      <div>
        <h2 className="text-xl font-bold">اطلب بضاعة</h2>
        <p className="text-muted text-sm mt-1">الأسعار حسب فئتك. أدخل الكميات المطلوبة ثم أرسل الطلب.</p>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="بحث عن منتج…"
        className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:border-primary bg-card"
      />

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-background text-muted">
              <tr>
                <th className="px-3 py-3 font-medium">المنتج</th>
                <th className="px-3 py-3 font-medium">السعر</th>
                <th className="px-3 py-3 font-medium">المتوفّر</th>
                <th className="px-3 py-3 font-medium">الكمية</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.product_id} className="border-t border-border">
                  <td className="px-3 py-2.5">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted">{p.category_name ?? ""}{p.base_unit_name ? ` · ${p.base_unit_name}` : ""}</div>
                  </td>
                  <td className="px-3 py-2.5 tabular font-medium">{money(p.price)}</td>
                  <td className="px-3 py-2.5 tabular text-muted">
                    {(p.stock_qty ?? 0) > 0 ? fmtNum(p.stock_qty) : <span className="text-red-600">نفد</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={qty[p.product_id] ?? ""}
                      onChange={(e) => setQty((s) => ({ ...s, [p.product_id]: e.target.value }))}
                      placeholder="0"
                      dir="ltr"
                      className="w-20 border border-border rounded-lg px-2 py-1.5 outline-none focus:border-primary bg-card tabular"
                    />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-muted">لا منتجات مطابقة.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <label className="block text-sm mb-1">ملاحظات على الطلب (اختياري)</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:border-primary bg-card" />
      </div>

      {/* شريط ملخّص ثابت */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="text-sm">
            <span className="text-muted">{totalItems} صنف · </span>
            <span className="font-bold tabular">{money(totalAmount)}</span>
          </div>
          <button
            onClick={submit}
            disabled={pending || totalItems === 0}
            className="bg-primary hover:bg-[var(--primary-hover)] text-white rounded-lg py-2.5 px-6 text-sm font-medium transition disabled:opacity-40"
          >
            {pending ? "جارٍ الإرسال…" : "تقديم الطلب"}
          </button>
        </div>
      </div>
    </div>
  );
}
