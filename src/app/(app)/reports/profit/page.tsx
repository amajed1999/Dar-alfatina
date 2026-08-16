import { requireSession, assertPermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { fmtMoney } from "@/lib/format";

export default async function ProfitReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const ctx = await requireSession();
  assertPermission(ctx, PERMISSIONS.reports.profit);

  const sp = await searchParams;
  const from = sp.from || undefined;
  const to = sp.to || undefined;

  const supabase = await createClient();
  const [{ data: pl }, { data: byProduct }, { data: byMerchant }] = await Promise.all([
    supabase.rpc("profit_loss", { p_from: from, p_to: to }),
    supabase.rpc("profit_by_product", { p_from: from, p_to: to }),
    supabase.rpc("profit_by_merchant", { p_from: from, p_to: to }),
  ]);

  const p = pl?.[0];
  const ratioPct = p?.collection_ratio != null ? Math.round(p.collection_ratio * 100) : null;

  const lines = [
    { label: "إجمالي المبيعات", value: p?.gross_sales ?? 0 },
    { label: "− المرتجعات", value: -(p?.returns_total ?? 0) },
    { label: "= صافي المبيعات", value: p?.net_sales ?? 0, strong: true },
    { label: "− تكلفة البضاعة المباعة", value: -(p?.cogs ?? 0) },
    { label: "= مجمل الربح", value: p?.gross_profit ?? 0, strong: true },
    { label: "− المصاريف التشغيلية", value: -(p?.operating_expenses ?? 0) },
    { label: "− قيمة الاستهلاك والتالف", value: -(p?.consumption_cost ?? 0) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">الأرباح والخسائر</h1>
        <p className="text-muted mt-1 text-sm">
          الربح يُحسب على أساس الفواتير المعتمدة (الربح الدفتري)، مع مؤشر نسبة التحصيل النقدي.
        </p>
      </div>

      <form method="GET" className="flex items-end gap-3 flex-wrap">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* قائمة الدخل */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm text-right">
            <tbody>
              {lines.map((l) => (
                <tr key={l.label} className="border-b border-border last:border-0">
                  <td className={`px-5 py-3 ${l.strong ? "font-semibold" : ""}`}>{l.label}</td>
                  <td className={`px-5 py-3 tabular text-left ${l.strong ? "font-semibold" : ""} ${l.value < 0 ? "text-red-600" : ""}`}>
                    {fmtMoney(l.value)}
                  </td>
                </tr>
              ))}
              <tr className="bg-background">
                <td className="px-5 py-4 font-bold">صافي الربح</td>
                <td className={`px-5 py-4 tabular text-left text-lg font-bold ${(p?.net_profit ?? 0) < 0 ? "text-red-600" : "text-green-700"}`}>
                  {fmtMoney(p?.net_profit ?? 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* مؤشر النقد */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div>
            <div className="text-xs text-muted">الربح الدفتري (على الفواتير)</div>
            <div className={`text-xl font-bold tabular ${(p?.net_profit ?? 0) < 0 ? "text-red-600" : "text-green-700"}`}>
              {fmtMoney(p?.net_profit ?? 0)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted">المحصّل نقداً خلال الفترة</div>
            <div className="text-xl font-bold tabular">{fmtMoney(p?.collected ?? 0)}</div>
          </div>
          <div>
            <div className="text-xs text-muted mb-1">نسبة التحصيل من صافي المبيعات</div>
            {ratioPct != null ? (
              <>
                <div className="h-3 rounded-full bg-background overflow-hidden">
                  <div
                    className={`h-full ${ratioPct >= 80 ? "bg-green-600" : ratioPct >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                    style={{ width: `${Math.min(ratioPct, 100)}%` }}
                  />
                </div>
                <div className="text-sm font-semibold mt-1 tabular">{ratioPct}%</div>
              </>
            ) : (
              <div className="text-muted text-sm">—</div>
            )}
          </div>
          <p className="text-xs text-muted leading-relaxed">
            شركة رابحة دفترياً قد تكون مأزومة نقدياً إذا كانت نسبة التحصيل منخفضة.
          </p>
        </div>
      </div>

      {/* تفصيل بالمنتج */}
      <ReportTable
        title="الربح تفصيلاً بالمنتج"
        head={["المنتج", "الكمية", "الإيراد", "التكلفة", "الربح"]}
        rows={(byProduct ?? []).map((r) => ({
          key: r.product_id,
          cells: [r.product_name, fmtMoney(r.qty), fmtMoney(r.revenue), fmtMoney(r.cogs), fmtMoney(r.profit)],
          profit: r.profit,
        }))}
      />

      {/* تفصيل بالتاجر */}
      <ReportTable
        title="الربح تفصيلاً بالتاجر"
        head={["التاجر", "الإيراد", "التكلفة", "الربح"]}
        rows={(byMerchant ?? []).map((r) => ({
          key: r.merchant_id,
          cells: [r.merchant_name, fmtMoney(r.revenue), fmtMoney(r.cogs), fmtMoney(r.profit)],
          profit: r.profit,
        }))}
      />
    </div>
  );
}

function ReportTable({
  title,
  head,
  rows,
}: {
  title: string;
  head: string[];
  rows: { key: string; cells: string[]; profit: number }[];
}) {
  return (
    <div>
      <h2 className="font-semibold mb-2">{title}</h2>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-background text-muted">
              <tr>
                {head.map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-t border-border">
                  {r.cells.map((c, i) => (
                    <td
                      key={i}
                      className={`px-4 py-3 ${i === 0 ? "font-medium" : "tabular"} ${
                        i === r.cells.length - 1 ? (r.profit < 0 ? "text-red-600 font-medium" : "font-medium") : ""
                      }`}
                    >
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={head.length} className="px-4 py-8 text-center text-muted">لا توجد بيانات في الفترة.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
