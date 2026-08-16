import { requireSession, assertPermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { fmtMoney, fmtNum } from "@/lib/format";
import ExportButtons from "@/components/ExportButtons";

export default async function RepsReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const ctx = await requireSession();
  assertPermission(ctx, PERMISSIONS.reports.reps);

  const sp = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rep_performance", {
    p_from: sp.from || undefined,
    p_to: sp.to || undefined,
  });

  const list = data ?? [];
  const headers = ["المندوب", "المبيعات", "عدد الفواتير", "التحصيلات", "عدد التجار", "الزيارات", "نسبة التحصيل"];
  const rows = list.map((r) => {
    const ratio = r.sales_total > 0 ? Math.round((r.collections_total / r.sales_total) * 100) : 0;
    return [r.rep_name, r.sales_total, r.invoices_count, r.collections_total, r.merchants_count, r.visits_count, `${ratio}%`];
  });

  return (
    <div className="space-y-6 print-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">أداء المندوبين</h1>
          <p className="text-muted mt-1 text-sm">مبيعات وتحصيلات كل مندوب ونسبة تحصيله خلال الفترة.</p>
        </div>
        {list.length > 0 && <ExportButtons filename="rep-performance" headers={headers} rows={rows} />}
      </div>

      <form method="GET" className="flex items-end gap-3 flex-wrap no-print">
        <div>
          <label className="block text-sm mb-1">من</label>
          <input type="date" name="from" defaultValue={sp.from ?? ""} dir="ltr" className="border border-border rounded-lg px-3 py-2 outline-none focus:border-primary bg-card" />
        </div>
        <div>
          <label className="block text-sm mb-1">إلى</label>
          <input type="date" name="to" defaultValue={sp.to ?? ""} dir="ltr" className="border border-border rounded-lg px-3 py-2 outline-none focus:border-primary bg-card" />
        </div>
        <button className="bg-primary hover:bg-[var(--primary-hover)] text-white rounded-lg py-2.5 px-5 text-sm font-medium transition">عرض</button>
      </form>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error.message}</p>}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-background text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">المندوب</th>
                <th className="px-4 py-3 font-medium">المبيعات</th>
                <th className="px-4 py-3 font-medium">الفواتير</th>
                <th className="px-4 py-3 font-medium">التحصيلات</th>
                <th className="px-4 py-3 font-medium">التجار</th>
                <th className="px-4 py-3 font-medium">الزيارات</th>
                <th className="px-4 py-3 font-medium">نسبة التحصيل</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const ratio = r.sales_total > 0 ? Math.round((r.collections_total / r.sales_total) * 100) : 0;
                return (
                  <tr key={r.rep_id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{r.rep_name}</td>
                    <td className="px-4 py-3 tabular">{fmtMoney(r.sales_total)}</td>
                    <td className="px-4 py-3 tabular">{fmtNum(r.invoices_count)}</td>
                    <td className="px-4 py-3 tabular">{fmtMoney(r.collections_total)}</td>
                    <td className="px-4 py-3 tabular">{fmtNum(r.merchants_count)}</td>
                    <td className="px-4 py-3 tabular">{fmtNum(r.visits_count)}</td>
                    <td className={`px-4 py-3 tabular ${ratio >= 80 ? "text-green-700" : ratio >= 50 ? "text-amber-600" : "text-red-600"}`}>{ratio}%</td>
                  </tr>
                );
              })}
              {list.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-muted">لا بيانات مندوبين في الفترة.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-muted no-print">ملاحظة: «الزيارات» تُسجَّل ميدانياً من صفحة التجار (زرّ 📍 زيارة). «نسبة تحقيق الهدف» تتطلب تحديد أهداف شهرية للمندوبين (خارطة الطريق).</p>
    </div>
  );
}
