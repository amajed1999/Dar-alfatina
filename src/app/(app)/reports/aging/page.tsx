import { requireSession, assertPermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { fmtMoney } from "@/lib/format";

export default async function AgingReportPage({
  searchParams,
}: {
  searchParams: Promise<{ as_of?: string }>;
}) {
  const ctx = await requireSession();
  assertPermission(ctx, PERMISSIONS.reports.aging);

  const sp = await searchParams;
  const asOf = sp.as_of || new Date().toISOString().slice(0, 10);

  const supabase = await createClient();
  const { data: rows, error } = await supabase.rpc("aging_report", { p_as_of: asOf });

  const list = rows ?? [];
  const totals = list.reduce(
    (t, r) => ({
      b0_30: t.b0_30 + (r.b0_30 ?? 0),
      b31_60: t.b31_60 + (r.b31_60 ?? 0),
      b61_90: t.b61_90 + (r.b61_90 ?? 0),
      b90_plus: t.b90_plus + (r.b90_plus ?? 0),
      total: t.total + (r.total ?? 0),
    }),
    { b0_30: 0, b31_60: 0, b61_90: 0, b90_plus: 0, total: 0 },
  );

  const buckets = [
    { label: "٠ – ٣٠ يوم", value: totals.b0_30, cls: "text-green-700" },
    { label: "٣١ – ٦٠ يوم", value: totals.b31_60, cls: "text-blue-700" },
    { label: "٦١ – ٩٠ يوم", value: totals.b61_90, cls: "text-amber-700" },
    { label: "أكثر من ٩٠ يوم", value: totals.b90_plus, cls: "text-red-700" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">أعمار الذمم</h1>
        <p className="text-muted mt-1 text-sm">
          توزيع المبالغ المستحقة على التجار حسب مدة التأخير. التحصيلات غير المخصّصة تُطبَّق على الأقدم أولاً.
        </p>
      </div>

      <form method="GET" className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-sm mb-1">كما في تاريخ</label>
          <input
            type="date"
            name="as_of"
            defaultValue={asOf}
            dir="ltr"
            className="border border-border rounded-lg px-3 py-2 outline-none focus:border-primary bg-card"
          />
        </div>
        <button className="bg-primary hover:bg-[var(--primary-hover)] text-white rounded-lg py-2.5 px-5 text-sm font-medium transition">
          عرض
        </button>
      </form>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error.message}</p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {buckets.map((b) => (
          <div key={b.label} className="bg-card border border-border rounded-xl p-4">
            <div className="text-xs text-muted">{b.label}</div>
            <div className={`text-xl font-bold tabular mt-1 ${b.cls}`}>{fmtMoney(b.value)}</div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-background text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">التاجر</th>
                <th className="px-4 py-3 font-medium">٠–٣٠</th>
                <th className="px-4 py-3 font-medium">٣١–٦٠</th>
                <th className="px-4 py-3 font-medium">٦١–٩٠</th>
                <th className="px-4 py-3 font-medium">+٩٠</th>
                <th className="px-4 py-3 font-medium">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.merchant_id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{r.merchant_name}</td>
                  <td className="px-4 py-3 tabular">{fmtMoney(r.b0_30)}</td>
                  <td className="px-4 py-3 tabular">{fmtMoney(r.b31_60)}</td>
                  <td className="px-4 py-3 tabular">{fmtMoney(r.b61_90)}</td>
                  <td className={`px-4 py-3 tabular ${(r.b90_plus ?? 0) > 0 ? "text-red-600 font-medium" : ""}`}>
                    {fmtMoney(r.b90_plus)}
                  </td>
                  <td className="px-4 py-3 tabular font-semibold">{fmtMoney(r.total)}</td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted">
                    لا توجد ذمم مستحقة.
                  </td>
                </tr>
              )}
            </tbody>
            {list.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border bg-background font-semibold">
                  <td className="px-4 py-3">الإجمالي</td>
                  <td className="px-4 py-3 tabular">{fmtMoney(totals.b0_30)}</td>
                  <td className="px-4 py-3 tabular">{fmtMoney(totals.b31_60)}</td>
                  <td className="px-4 py-3 tabular">{fmtMoney(totals.b61_90)}</td>
                  <td className="px-4 py-3 tabular">{fmtMoney(totals.b90_plus)}</td>
                  <td className="px-4 py-3 tabular">{fmtMoney(totals.total)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
