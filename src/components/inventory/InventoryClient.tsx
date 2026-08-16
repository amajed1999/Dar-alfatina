"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { fmtNum, fmtDateTime } from "@/lib/format";
import {
  recordAdjustment,
  recordDamage,
  transferStock,
} from "@/app/(app)/inventory/actions";

export type Product = {
  id: string;
  name: string | null;
  sku: string | null;
  base_unit_name: string | null;
  reorder_level: number | null;
  stock_qty: number | null;
  is_active: boolean | null;
};
type Warehouse = { id: string; name: string; is_default: boolean };
type StockRow = {
  product_id: string | null;
  warehouse_id: string | null;
  qty: number | null;
};
type Movement = {
  id: string;
  created_at: string;
  movement_type: string;
  quantity: number;
  notes: string | null;
  reference_type: string | null;
  products: { name: string | null; sku: string | null } | null;
  warehouses: { name: string | null } | null;
};

type Props = {
  products: Product[];
  warehouses: Warehouse[];
  stockByWarehouse: StockRow[];
  movements: Movement[];
  canAdjust: boolean;
  canMove: boolean;
  canTransfer: boolean;
};

const TYPE_LABELS: Record<string, string> = {
  opening: "رصيد افتتاحي",
  purchase: "شراء",
  sale: "بيع",
  sale_return: "مرتجع بيع",
  purchase_return: "مرتجع شراء",
  consumption: "استهلاك",
  damage: "تالف",
  adjustment: "تسوية جرد",
  transfer_in: "تحويل وارد",
  transfer_out: "تحويل صادر",
};

type Dialog = "adjust" | "damage" | "transfer" | null;

export default function InventoryClient({
  products,
  warehouses,
  stockByWarehouse,
  movements,
  canAdjust,
  canMove,
  canTransfer,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"balances" | "ledger">("balances");
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // form state
  const [productId, setProductId] = useState("");
  const [warehouseId, setWarehouseId] = useState(
    warehouses.find((w) => w.is_default)?.id ?? warehouses[0]?.id ?? "",
  );
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [qty, setQty] = useState("");
  const [sign, setSign] = useState<"in" | "out">("in");
  const [notes, setNotes] = useState("");

  const multiWarehouse = warehouses.length > 1;

  const stockMap = useMemo(() => {
    const m: Record<string, Record<string, number>> = {};
    for (const s of stockByWarehouse) {
      if (!s.product_id || !s.warehouse_id) continue;
      m[s.product_id] ??= {};
      m[s.product_id][s.warehouse_id] = s.qty ?? 0;
    }
    return m;
  }, [stockByWarehouse]);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        (p.name ?? "").toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q),
    );
  }, [products, query]);

  function openDialog(d: Dialog) {
    setError(null);
    setProductId("");
    setQty("");
    setNotes("");
    setSign("in");
    setWarehouseId(warehouses.find((w) => w.is_default)?.id ?? warehouses[0]?.id ?? "");
    setToWarehouseId(warehouses.find((w) => !w.is_default)?.id ?? "");
    setDialog(d);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const q = Number(qty);
    if (!productId) return setError("اختر المنتج.");
    if (!q || q <= 0) return setError("أدخل كمية صحيحة أكبر من صفر.");

    startTransition(async () => {
      let res;
      if (dialog === "adjust") {
        res = await recordAdjustment({
          product_id: productId,
          warehouse_id: warehouseId,
          quantity: sign === "in" ? q : -q,
          notes,
        });
      } else if (dialog === "damage") {
        res = await recordDamage({
          product_id: productId,
          warehouse_id: warehouseId,
          quantity: q,
          notes,
        });
      } else {
        if (warehouseId === toWarehouseId)
          return setError("اختر مخزنين مختلفين.");
        res = await transferStock({
          product_id: productId,
          from_warehouse_id: warehouseId,
          to_warehouse_id: toWarehouseId,
          quantity: q,
          notes,
        });
      }
      if (!res.ok) {
        setError(res.error ?? "حدث خطأ");
        return;
      }
      setDialog(null);
      router.refresh();
    });
  }

  const dialogTitle =
    dialog === "adjust"
      ? "تسوية جرد"
      : dialog === "damage"
        ? "تسجيل تالف"
        : "تحويل بين المخازن";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">المخزون والحركات</h1>
          <p className="text-muted mt-1 text-sm">
            الأرصدة مشتقّة بالكامل من حركات المخزون — لا تُعدَّل الكمية يدوياً.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canAdjust && (
            <button
              onClick={() => openDialog("adjust")}
              className="bg-primary hover:bg-[var(--primary-hover)] text-white rounded-lg py-2 px-4 text-sm font-medium transition"
            >
              تسوية جرد
            </button>
          )}
          {canMove && (
            <button
              onClick={() => openDialog("damage")}
              className="border border-border rounded-lg py-2 px-4 text-sm hover:bg-background transition"
            >
              تسجيل تالف
            </button>
          )}
          {canTransfer && multiWarehouse && (
            <button
              onClick={() => openDialog("transfer")}
              className="border border-border rounded-lg py-2 px-4 text-sm hover:bg-background transition"
            >
              تحويل
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 border-b border-border">
        <TabBtn active={tab === "balances"} onClick={() => setTab("balances")}>
          الأرصدة
        </TabBtn>
        <TabBtn active={tab === "ledger"} onClick={() => setTab("ledger")}>
          سجلّ الحركات
        </TabBtn>
      </div>

      {error && !dialog && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      {tab === "balances" && (
        <>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="بحث بالاسم أو الرمز…"
            className="w-full sm:max-w-sm border border-border rounded-lg px-3 py-2 outline-none focus:border-primary bg-card"
          />
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-background text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">المنتج</th>
                    <th className="px-4 py-3 font-medium">الوحدة</th>
                    {multiWarehouse &&
                      warehouses.map((w) => (
                        <th key={w.id} className="px-4 py-3 font-medium">
                          {w.name}
                        </th>
                      ))}
                    <th className="px-4 py-3 font-medium">الإجمالي</th>
                    <th className="px-4 py-3 font-medium">حد الطلب</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p) => {
                    const total = p.stock_qty ?? 0;
                    const below =
                      p.reorder_level != null && total <= p.reorder_level;
                    return (
                      <tr key={p.id} className="border-t border-border">
                        <td className="px-4 py-3 font-medium">
                          {p.name}
                          <span className="text-muted tabular text-xs mr-2" dir="ltr">
                            {p.sku}
                          </span>
                          {below && (
                            <span className="text-[10px] bg-amber-50 text-amber-700 rounded px-1.5 py-0.5 mr-2">
                              تحت الحد
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {p.base_unit_name ?? "—"}
                        </td>
                        {multiWarehouse &&
                          warehouses.map((w) => (
                            <td key={w.id} className="px-4 py-3 tabular">
                              {fmtNum(stockMap[p.id]?.[w.id] ?? 0)}
                            </td>
                          ))}
                        <td className="px-4 py-3 tabular font-medium">
                          {fmtNum(total)}
                        </td>
                        <td className="px-4 py-3 tabular text-muted">
                          {fmtNum(p.reorder_level ?? 0)}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredProducts.length === 0 && (
                    <tr>
                      <td
                        colSpan={multiWarehouse ? warehouses.length + 4 : 4}
                        className="px-4 py-10 text-center text-muted"
                      >
                        لا توجد منتجات.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === "ledger" && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-background text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">التاريخ</th>
                  <th className="px-4 py-3 font-medium">المنتج</th>
                  <th className="px-4 py-3 font-medium">المخزن</th>
                  <th className="px-4 py-3 font-medium">النوع</th>
                  <th className="px-4 py-3 font-medium">الكمية</th>
                  <th className="px-4 py-3 font-medium">ملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-t border-border">
                    <td className="px-4 py-3 text-muted tabular whitespace-nowrap" dir="ltr">
                      {fmtDateTime(m.created_at)}
                    </td>
                    <td className="px-4 py-3">{m.products?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted">{m.warehouses?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-background border border-border rounded-full px-2.5 py-1">
                        {TYPE_LABELS[m.movement_type] ?? m.movement_type}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-3 tabular font-medium ${
                        m.quantity >= 0 ? "text-green-700" : "text-red-600"
                      }`}
                      dir="ltr"
                    >
                      {m.quantity >= 0 ? "+" : ""}
                      {fmtNum(m.quantity)}
                    </td>
                    <td className="px-4 py-3 text-muted">{m.notes ?? "—"}</td>
                  </tr>
                ))}
                {movements.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted">
                      لا توجد حركات بعد.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={dialog !== null} onClose={() => setDialog(null)} title={dialogTitle}>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">المنتج</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className={inputCls}
            >
              <option value="">— اختر المنتج —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">
              {dialog === "transfer" ? "من مخزن" : "المخزن"}
            </label>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className={inputCls}
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          {dialog === "transfer" && (
            <div>
              <label className="block text-sm mb-1">إلى مخزن</label>
              <select
                value={toWarehouseId}
                onChange={(e) => setToWarehouseId(e.target.value)}
                className={inputCls}
              >
                <option value="">— اختر —</option>
                {warehouses
                  .filter((w) => w.id !== warehouseId)
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {dialog === "adjust" && (
            <div>
              <label className="block text-sm mb-1">نوع التسوية</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSign("in")}
                  className={`flex-1 rounded-lg py-2 text-sm border transition ${
                    sign === "in"
                      ? "bg-primary text-white border-primary"
                      : "border-border hover:bg-background"
                  }`}
                >
                  زيادة (+)
                </button>
                <button
                  type="button"
                  onClick={() => setSign("out")}
                  className={`flex-1 rounded-lg py-2 text-sm border transition ${
                    sign === "out"
                      ? "bg-primary text-white border-primary"
                      : "border-border hover:bg-background"
                  }`}
                >
                  نقص (−)
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm mb-1">الكمية (بالوحدة الأساسية)</label>
            <input
              type="number"
              min="0"
              step="any"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              dir="ltr"
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">
              السبب / ملاحظات {dialog !== "transfer" && "(مطلوب)"}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={inputCls}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              disabled={pending}
              className="bg-primary hover:bg-[var(--primary-hover)] text-white rounded-lg py-2.5 px-6 text-sm font-medium transition disabled:opacity-60"
            >
              {pending ? "جارٍ التنفيذ…" : "تأكيد"}
            </button>
            <button
              type="button"
              onClick={() => setDialog(null)}
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

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
