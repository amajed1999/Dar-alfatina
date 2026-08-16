import { requireSession, assertPermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { fmtMoney, fmtNum } from "@/lib/format";
import ExportButtons from "@/components/ExportButtons";

export default async function SalesReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const ctx = await requireSession();
  assertPermission(ctx, PERMISSIONS.reports.sales);

  const sp = await searchParams;
  const args = { p_from: sp.from || undefined, p_to: sp.to || undefined };
  const supabase = await createClient();

  const [{ data: byMerchant }, { data: byProduct }, { data: byRegion }] = await Promise.all([
    supabase.rpc("report_sales_by_merchant", args),
    supabase.rpc("report_sales_by_product", args),
    supabase.rpc("report_sales_by_region", args),
  ]);

  const total = (byMerchant ?? []).reduce((s, r) => s + (r.total_sales ?? 0), 0);

  return (
    <div className="space-y-6 print-full">
      <div>
        <h1 className="text-2xl font-bold">تقرير المبيعات</h1>
        <p className="text-muted mt-1 text-sm">المبيعات خلال الفترة، مفصّلة حسب التاجر والمنتج والمنطقة.</p>
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

      <div className="bg-card border border-border rounded-xl px-5 py-3 inline-block">
        <span className="text-xs text-muted">إجمالي المبيعات في الفترة</span>
        <div className="text-2xl font-bold tabular">{fmtMoney(total)} د.ع</div>
      </div>

      <Section
        title="حسب التاجر"
        filename="sales-by-merchant"
        head={["التاجر", "عدد الفواتير", "المبيعات"]}
        rows={(byMerchant ?? []).map((r) => [r.merchant_name, r.invoices_count, r.total_sales])}
        render={(byMerchant ?? []).map((r) => (
          <tr key={r.merchant_id} className="border-t border-border">
            <td className="px-4 py-3 font-medium">{r.merchant_name}</td>
            <td className="px-4 py-3 tabular">{fmtNum(r.invoices_count)}</td>
            <td className="px-4 py-3 tabular">{fmtMoney(r.total_sales)}</td>
          </tr>
        ))}
      />

      <Section
        title="حسب المنتج"
        filename="sales-by-product"
        head={["المنتج", "الكمية", "الإيراد"]}
        rows={(byProduct ?? []).map((r) => [`${r.product_name} (${r.sku})`, r.qty, r.revenue])}
        render={(byProduct ?? []).map((r) => (
          <tr key={r.product_id} className="border-t border-border">
            <td className="px-4 py-3 font-medium">{r.product_name} <span className="text-muted text-xs" dir="ltr">({r.sku})</span></td>
            <td className="px-4 py-3 tabular">{fmtNum(r.qty)}</td>
            <td className="px-4 py-3 tabular">{fmtMoney(r.revenue)}</td>
          </tr>
        ))}
      />

      <Section
        title="حسب المنطقة"
        filename="sales-by-region"
        head={["المنطقة", "عدد الفواتير", "المبيعات"]}
        rows={(byRegion ?? []).map((r) => [r.region, r.invoices_count, r.total_sales])}
        render={(byRegion ?? []).map((r, i) => (
          <tr key={i} className="border-t border-border">
            <td className="px-4 py-3 font-medium">{r.region}</td>
            <td className="px-4 py-3 tabular">{fmtNum(r.invoices_count)}</td>
            <td className="px-4 py-3 tabular">{fmtMoney(r.total_sales)}</td>
          </tr>
        ))}
      />
    </div>
  );
}

function Section({
  title, filename, head, rows, render,
}: {
  title: string;
  filename: string;
  head: string[];
  rows: (string | number)[][];
  render: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold">{title}</h2>
        {rows.length > 0 && <ExportButtons filename={filename} headers={head} rows={rows} />}
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-background text-muted">
              <tr>{head.map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {render}
              {rows.length === 0 && (
                <tr><td colSpan={head.length} className="px-4 py-8 text-center text-muted">لا بيانات في الفترة.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
