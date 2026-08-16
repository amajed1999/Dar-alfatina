import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { fmtMoney } from "@/lib/format";

const money = (n: number | null | undefined) => `${fmtMoney(n ?? 0)} د.ع`;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const ctx = await requireSession();
  const supabase = await createClient();
  const has = (p: string) => ctx.permissions.has(p);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const todayStr = now.toISOString().slice(0, 10);
  const sp = await searchParams;
  const from = sp.from || monthStart;
  const to = sp.to || todayStr;

  const [
    salesRes, payRes, balRes, belowRes,
    plPeriodRes, plAllRes, agingRes, tasksRes,
    merchantsRes, topProdRes, trendRes, invValRes,
  ] = await Promise.all([
    has(PERMISSIONS.sales.view)
      ? supabase.from("sales_invoices").select("total").in("status", ["approved", "delivered"]).gte("invoice_date", from).lte("invoice_date", to)
      : Promise.resolve({ data: null }),
    has(PERMISSIONS.payments.view)
      ? supabase.from("payments").select("amount").is("deleted_at", null).gte("payment_date", from).lte("payment_date", to)
      : Promise.resolve({ data: null }),
    has(PERMISSIONS.merchants.view)
      ? supabase.from("v_merchant_balances").select("merchant_id, balance")
      : Promise.resolve({ data: null }),
    has(PERMISSIONS.inventory.view)
      ? supabase.from("v_products").select("id", { count: "exact", head: true }).eq("below_reorder", true)
      : Promise.resolve({ count: null }),
    has(PERMISSIONS.reports.profit)
      ? supabase.rpc("profit_loss", { p_from: from, p_to: to })
      : Promise.resolve({ data: null }),
    has(PERMISSIONS.reports.profit)
      ? supabase.rpc("profit_loss", {})
      : Promise.resolve({ data: null }),
    has(PERMISSIONS.reports.aging)
      ? supabase.rpc("aging_report", { p_as_of: todayStr })
      : Promise.resolve({ data: null }),
    has(PERMISSIONS.tasks.view)
      ? supabase.from("tasks").select("id, status, due_date").is("deleted_at", null)
      : Promise.resolve({ data: null }),
    has(PERMISSIONS.merchants.view)
      ? supabase.from("merchants").select("id, name").is("deleted_at", null)
      : Promise.resolve({ data: null }),
    has(PERMISSIONS.reports.sales)
      ? supabase.rpc("report_sales_by_product", { p_from: from, p_to: to })
      : Promise.resolve({ data: null }),
    has(PERMISSIONS.sales.view)
      ? supabase.rpc("monthly_sales", { p_months: 6 })
      : Promise.resolve({ data: null }),
    has(PERMISSIONS.reports.inventory)
      ? supabase.from("v_inventory_report").select("stock_value")
      : Promise.resolve({ data: null }),
  ]);

  const salesPeriod = (salesRes.data ?? []).reduce((s, r) => s + (r.total ?? 0), 0);
  const collectPeriod = (payRes.data ?? []).reduce((s, r) => s + (r.amount ?? 0), 0);
  const balances = balRes.data ?? [];
  const outstanding = balances.reduce((s, r) => s + (r.balance ?? 0), 0);
  const belowReorder = belowRes.count ?? null;
  const plPeriod = plPeriodRes.data?.[0] ?? null;
  const plAll = plAllRes.data?.[0] ?? null;
  const inventoryValue = (invValRes.data ?? []).reduce((s, r) => s + (r.stock_value ?? 0), 0);

  const tasks = tasksRes.data ?? [];
  const openTasks = tasks.filter((t) => t.status !== "done" && t.status !== "rejected").length;
  const overdueTasks = tasks.filter(
    (t) => t.due_date && t.due_date < todayStr && t.status !== "done" && t.status !== "rejected",
  ).length;

  const merchantName: Record<string, string> = {};
  for (const m of merchantsRes.data ?? []) merchantName[m.id] = m.name;
  const topMerchants = [...balances].filter((b) => (b.balance ?? 0) > 0).sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0)).slice(0, 5);
  const topProducts = (topProdRes.data ?? []).slice(0, 5);
  const trend = trendRes.data ?? [];

  // --- أعمار الذمم (تنبيه + توزيع) ---
  const aging = agingRes.data ?? [];
  const agingBuckets = aging.reduce(
    (t, r) => ({
      b0: t.b0 + (r.b0_30 ?? 0), b1: t.b1 + (r.b31_60 ?? 0),
      b2: t.b2 + (r.b61_90 ?? 0), b3: t.b3 + (r.b90_plus ?? 0),
    }),
    { b0: 0, b1: 0, b2: 0, b3: 0 },
  );
  const overdueLate = agingBuckets.b2 + agingBuckets.b3; // +60 يوم

  // --- تنبيهات ---
  const netAll = plAll?.net_profit ?? null;
  const ratioAll = plAll?.collection_ratio ?? null;
  const profitNegative = netAll != null && netAll < 0;
  const lowCollection = ratioAll != null && ratioAll < 0.5;

  const cards: { label: string; value: string; href?: string; accent?: string }[] = [];
  if (has(PERMISSIONS.sales.view)) cards.push({ label: "المبيعات (الفترة)", value: money(salesPeriod), href: "/reports/sales" });
  if (has(PERMISSIONS.payments.view)) cards.push({ label: "التحصيلات (الفترة)", value: money(collectPeriod), href: "/payments" });
  if (has(PERMISSIONS.merchants.view)) cards.push({ label: "إجمالي الذمم", value: money(outstanding), href: "/reports/aging", accent: outstanding > 0 ? "text-amber-600" : "" });
  if (has(PERMISSIONS.reports.profit)) cards.push({ label: "صافي الربح (الفترة)", value: money(plPeriod?.net_profit ?? 0), href: "/reports/profit", accent: (plPeriod?.net_profit ?? 0) < 0 ? "text-red-600" : "text-green-700" });
  if (belowReorder != null) cards.push({ label: "أصناف تحت الحد", value: String(belowReorder), href: "/reports/inventory", accent: belowReorder > 0 ? "text-amber-600" : "" });
  if (has(PERMISSIONS.tasks.view)) cards.push({ label: "مهام مفتوحة", value: String(openTasks), href: "/tasks", accent: overdueTasks > 0 ? "text-red-600" : "" });

  const trendMax = Math.max(1, ...trend.map((t) => Math.max(t.sales_total ?? 0, t.collected_total ?? 0)));
  const agingMax = Math.max(1, agingBuckets.b0, agingBuckets.b1, agingBuckets.b2, agingBuckets.b3);
  const prodMax = Math.max(1, ...topProducts.map((p) => p.revenue ?? 0));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">مرحباً، {ctx.fullName ?? "بك"} 👋</h1>
          <p className="text-muted mt-1">
            دورك: <b className="text-foreground">{ctx.roleNameAr}</b>
          </p>
        </div>
        <form method="GET" className="flex items-end gap-2 flex-wrap">
          <div>
            <label className="block text-xs text-muted mb-1">من</label>
            <input type="date" name="from" defaultValue={from} dir="ltr" className="border border-border rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-primary bg-card" />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">إلى</label>
            <input type="date" name="to" defaultValue={to} dir="ltr" className="border border-border rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-primary bg-card" />
          </div>
          <button className="bg-primary hover:bg-[var(--primary-hover)] text-white rounded-lg py-1.5 px-4 text-sm transition">عرض</button>
        </form>
      </div>

      {/* تنبيهات تراكمية */}
      {(profitNegative || lowCollection) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl leading-none">⚠️</span>
            <div className="text-sm text-red-800 space-y-1">
              {profitNegative && (
                <p className="font-semibold">
                  صافي الربح التراكمي سالب: {money(netAll)}
                  {has(PERMISSIONS.reports.profit) && (
                    <Link href="/reports/profit" className="text-red-700 underline mr-2 font-normal">راجع الأرباح والخسائر</Link>
                  )}
                </p>
              )}
              {lowCollection && (
                <p>نسبة التحصيل النقدي منخفضة: {Math.round((ratioAll ?? 0) * 100)}% من المبيعات — خطر سيولة.</p>
              )}
              {profitNegative && inventoryValue > 0 && (
                <p className="text-red-700/90 font-normal">
                  ملاحظة سياقية: قيمة المخزون الحالي {money(inventoryValue)}. قد يكون جزء كبير من هذا استثماراً في مخزون لم يُبَع بعد (مرحلة تخزين أولي) لا خسارة تشغيلية — قارن بين تكلفة المشتريات والمبيعات المتراكمة.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* تنبيه الديون المتأخرة */}
      {has(PERMISSIONS.reports.aging) && overdueLate > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 text-sm text-amber-900">
            <span className="text-xl leading-none">🔴</span>
            <span>
              ديون متأخرة: <b>+٩٠ يوم {money(agingBuckets.b3)}</b> · ٦١–٩٠ يوم {money(agingBuckets.b2)}
            </span>
          </div>
          <Link href="/reports/aging" className="text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-4 py-1.5 transition shrink-0">
            تقرير أعمار الذمم
          </Link>
        </div>
      )}

      {/* بطاقات المؤشرات */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map((c) => {
          const inner = (
            <>
              <div className="text-xs text-muted">{c.label}</div>
              <div className={`text-xl font-bold tabular mt-1 ${c.accent ?? ""}`}>{c.value}</div>
            </>
          );
          return c.href ? (
            <Link key={c.label} href={c.href} className="bg-card border border-border rounded-xl p-4 hover:border-primary transition">{inner}</Link>
          ) : (
            <div key={c.label} className="bg-card border border-border rounded-xl p-4">{inner}</div>
          );
        })}
      </div>

      {/* رسم اتجاه المبيعات والتحصيلات */}
      {has(PERMISSIONS.sales.view) && trend.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm">اتجاه المبيعات والتحصيلات (٦ أشهر)</h2>
            <div className="flex gap-3 text-xs text-muted">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-primary inline-block" /> مبيعات</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-600 inline-block" /> تحصيلات</span>
            </div>
          </div>
          <div className="flex items-end justify-between gap-2 h-40">
            {trend.map((t) => {
              const label = new Date(t.month_start).toLocaleDateString("en-GB", { month: "2-digit", year: "2-digit" });
              return (
                <div key={t.month_start} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                  <div className="flex items-end gap-0.5 h-full w-full justify-center">
                    <div className="w-3 bg-primary rounded-t" style={{ height: `${((t.sales_total ?? 0) / trendMax) * 100}%` }} title={`مبيعات: ${money(t.sales_total)}`} />
                    <div className="w-3 bg-green-600 rounded-t" style={{ height: `${((t.collected_total ?? 0) / trendMax) * 100}%` }} title={`تحصيلات: ${money(t.collected_total)}`} />
                  </div>
                  <span className="text-[10px] text-muted tabular" dir="ltr">{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* توزيع الذمم حسب العمر */}
        {has(PERMISSIONS.reports.aging) && (
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold text-sm mb-4">توزيع الذمم حسب العمر</h2>
            <div className="space-y-3">
              {[
                { label: "٠–٣٠ يوم", val: agingBuckets.b0, cls: "bg-green-500" },
                { label: "٣١–٦٠ يوم", val: agingBuckets.b1, cls: "bg-blue-500" },
                { label: "٦١–٩٠ يوم", val: agingBuckets.b2, cls: "bg-amber-500" },
                { label: "+٩٠ يوم", val: agingBuckets.b3, cls: "bg-red-500" },
              ].map((b) => (
                <div key={b.label} className="flex items-center gap-3">
                  <span className="text-xs text-muted w-20 shrink-0">{b.label}</span>
                  <div className="flex-1 bg-background rounded-full h-4 overflow-hidden">
                    <div className={`h-full ${b.cls} rounded-full`} style={{ width: `${(b.val / agingMax) * 100}%` }} />
                  </div>
                  <span className="text-xs tabular w-24 text-left shrink-0">{money(b.val)}</span>
                </div>
              ))}
              {overdueLate === 0 && agingBuckets.b0 === 0 && agingBuckets.b1 === 0 && (
                <p className="text-sm text-muted text-center py-2">لا ذمم مستحقة.</p>
              )}
            </div>
          </div>
        )}

        {/* أعلى ٥ منتجات مبيعاً */}
        {has(PERMISSIONS.reports.sales) && (
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold text-sm mb-4">أعلى ٥ منتجات مبيعاً (الفترة)</h2>
            <div className="space-y-3">
              {topProducts.map((p) => (
                <div key={p.product_id} className="flex items-center gap-3">
                  <span className="text-xs w-28 shrink-0 truncate">{p.product_name}</span>
                  <div className="flex-1 bg-background rounded-full h-4 overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${((p.revenue ?? 0) / prodMax) * 100}%` }} />
                  </div>
                  <span className="text-xs tabular w-24 text-left shrink-0">{money(p.revenue)}</span>
                </div>
              ))}
              {topProducts.length === 0 && <p className="text-sm text-muted text-center py-2">لا مبيعات في الفترة.</p>}
            </div>
          </div>
        )}

        {/* أعلى التجار مديونيةً */}
        {has(PERMISSIONS.merchants.view) && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border font-semibold text-sm">أعلى التجار مديونيةً</div>
            <table className="w-full text-sm text-right">
              <tbody>
                {topMerchants.map((b) => (
                  <tr key={b.merchant_id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5">
                      <Link href={`/merchants/${b.merchant_id}/statement`} className="text-primary hover:underline">
                        {merchantName[b.merchant_id ?? ""] ?? "—"}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 tabular text-left">{money(b.balance)}</td>
                  </tr>
                ))}
                {topMerchants.length === 0 && <tr><td className="px-4 py-6 text-center text-muted">لا ذمم مستحقة.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
