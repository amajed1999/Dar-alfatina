import { requireSession, assertPermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { fmtMoney, fmtNum, fmtDate } from "@/lib/format";
import ExportButtons from "@/components/ExportButtons";

export default async function InventoryReportPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; days?: string }>;
}) {
  const ctx = await requireSession();
  assertPermission(ctx, PERMISSIONS.reports.inventory);

  const sp = await searchParams;
  const filter = sp.filter || "all";
  const days = Number(sp.days) || 60;

  const supabase = await createClient();
  const { data } = await supabase.from("v_inventory_report").select("*").order("name");

  const now = Date.now();
  const daysSince = (d: string | null) =>
    d ? Math.floor((now - new Date(d).getTime()) / 86400000) : null;

  let list = (data ?? []).map((r) => ({
    ...r,
    idle_days: daysSince(r.last_movement_at),
  }));

  if (filter === "below") list = list.filter((r) => r.below_reorder);
  else if (filter === "stagnant")
    list = list.filter((r) => (r.stock_qty ?? 0) > 0 && (r.idle_days == null || r.idle_days >= days));

  const totalValue = list.reduce((s, r) => s + (r.stock_value ?? 0), 0);
  const totalQty = list.reduce((s, r) => s + (r.stock_qty ?? 0), 0);

  const tabs = [
    { key: "all", label: "الكل" },
    { key: "below", label: "تحت الحد الأدنى" },
    { key: "stagnant", label: `راكدة (+${days} يوم)` },
  ];

  const headers = ["الرمز", "المنتج", "التصنيف", "المتوفّر", "تكلفة الوحدة", "قيمة المخزون", "حد الطلب", "آخر حركة", "أيام ركود"];
  const rows = list.map((r) => [
    r.sku ?? "", r.name ?? "", r.category_name ?? "", r.stock_qty ?? 0,
    r.unit_cost ?? "", r.stock_value ?? "", r.reorder_level ?? 0,
    r.last_movement_at ? fmtDate(r.last_movement_at) : "—", r.idle_days ?? "",
  ]);

  return (
    <div className="space-y-6 print-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">المخزون وقيمته</h1>
          <p className="text-muted mt-1 text-sm">الكميات المتوفّرة وقيمتها بالتكلفة، مع الأصناف الراكدة وتحت الحد الأدنى.</p>
        </div>
        <ExportButtons filename="inventory-report" headers={headers} rows={rows} />
      </div>

      <div className="flex gap-2 border-b border-border no-print">
        {tabs.map((t) => (
          <a
            key={t.key}
            href={`/reports/inventory?filter=${t.key}&days=${days}`}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              filter === t.key ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </a>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted">عدد الأصناف</div>
          <div className="text-xl font-bold tabular mt-1">{fmtNum(list.length)}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted">إجمالي الكميات</div>
          <div className="text-xl font-bold tabular mt-1">{fmtNum(totalQty)}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted">قيمة المخزون بالتكلفة</div>
          <div className="text-xl font-bold tabular mt-1">{fmtMoney(totalValue)} د.ع</div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-background text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">الرمز</th>
                <th className="px-4 py-3 font-medium">المنتج</th>
                <th className="px-4 py-3 font-medium">التصنيف</th>
                <th className="px-4 py-3 font-medium">المتوفّر</th>
                <th className="px-4 py-3 font-medium">تكلفة الوحدة</th>
                <th className="px-4 py-3 font-medium">قيمة المخزون</th>
                <th className="px-4 py-3 font-medium">آخر حركة</th>
                <th className="px-4 py-3 font-medium">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.product_id} className="border-t border-border">
                  <td className="px-4 py-3 tabular text-muted" dir="ltr">{r.sku}</td>
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3 text-muted">{r.category_name ?? "—"}</td>
                  <td className="px-4 py-3 tabular">{fmtNum(r.stock_qty)}</td>
                  <td className="px-4 py-3 tabular">{r.unit_cost != null ? fmtMoney(r.unit_cost) : "—"}</td>
                  <td className="px-4 py-3 tabular">{r.stock_value != null ? fmtMoney(r.stock_value) : "—"}</td>
                  <td className="px-4 py-3 text-muted tabular">
                    {r.last_movement_at ? fmtDate(r.last_movement_at) : "—"}
                    {r.idle_days != null && r.idle_days >= days && (r.stock_qty ?? 0) > 0 && (
                      <span className="text-[10px] bg-amber-50 text-amber-700 rounded px-1.5 py-0.5 mr-1">راكد</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.below_reorder ? (
                      <span className="text-xs bg-red-50 text-red-700 rounded-full px-2.5 py-1">تحت الحد</span>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-muted">لا أصناف مطابقة.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
