import { requireSession, assertPermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { fmtNum } from "@/lib/format";
import ExportButtons from "@/components/ExportButtons";

export default async function ReorderReportPage() {
  const ctx = await requireSession();
  assertPermission(ctx, PERMISSIONS.inventory.view);

  const supabase = await createClient();
  const { data } = await supabase.rpc("reorder_suggestions");
  const list = data ?? [];

  const headers = ["المنتج", "الرمز", "المتوفّر", "حد الطلب", "بيع 90 يوم", "متوسط/يوم", "تغطية (يوم)", "الكمية المقترحة"];
  const rows = list.map((r) => [
    r.name ?? "",
    r.sku ?? "",
    r.current_stock ?? 0,
    r.reorder_level ?? 0,
    r.sold_90d ?? 0,
    r.avg_daily ?? 0,
    r.days_cover ?? "",
    r.suggested_qty ?? 0,
  ]);

  return (
    <div className="space-y-6 print-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">اقتراحات إعادة الطلب</h1>
          <p className="text-muted mt-1 text-sm">
            أصناف قاربت على النفاد أو تحت الحد الأدنى، مع كمية شراء مقترحة حسب سرعة البيع.
          </p>
        </div>
        {list.length > 0 && (
          <ExportButtons filename="reorder-suggestions" headers={headers} rows={rows} />
        )}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-background text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">المنتج</th>
                <th className="px-4 py-3 font-medium">المتوفّر</th>
                <th className="px-4 py-3 font-medium">حد الطلب</th>
                <th className="px-4 py-3 font-medium">بيع 90 يوم</th>
                <th className="px-4 py-3 font-medium">متوسط/يوم</th>
                <th className="px-4 py-3 font-medium">تغطية</th>
                <th className="px-4 py-3 font-medium">الكمية المقترحة</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const urgent = r.days_cover != null && Number(r.days_cover) <= 14;
                return (
                  <tr key={r.product_id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.name}</div>
                      {r.sku && <div className="text-xs text-muted" dir="ltr">{r.sku}</div>}
                    </td>
                    <td className="px-4 py-3 tabular">{fmtNum(r.current_stock ?? 0)}</td>
                    <td className="px-4 py-3 tabular text-muted">{fmtNum(r.reorder_level ?? 0)}</td>
                    <td className="px-4 py-3 tabular text-muted">{fmtNum(r.sold_90d ?? 0)}</td>
                    <td className="px-4 py-3 tabular text-muted">{fmtNum(r.avg_daily ?? 0)}</td>
                    <td className="px-4 py-3 tabular">
                      {r.days_cover == null ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <span className={urgent ? "text-red-600 font-medium" : ""}>
                          {fmtNum(r.days_cover)} يوم
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular font-bold text-primary">
                      {fmtNum(r.suggested_qty ?? 0)}
                    </td>
                  </tr>
                );
              })}
              {list.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted">
                    لا توجد أصناف بحاجة لإعادة طلب حالياً. حدّد «حد الطلب» للأصناف من صفحة المنتجات
                    ليظهر التنبيه مبكراً.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted">
        الكمية المقترحة = ما يغطّي الطلب المتوقّع لعدد أيام محدّد (افتراضياً 30 يوماً) أو يبلغ حد الطلب،
        أيّهما أكبر، مطروحاً منه المتوفّر. «التغطية» = كم يوماً يكفي المخزون الحالي بسرعة البيع الحالية.
      </p>
    </div>
  );
}
