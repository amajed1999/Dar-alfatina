import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { fmtMoney } from "@/lib/format";

export default async function DashboardPage() {
  const ctx = await requireSession();
  const supabase = await createClient();
  const has = (p: string) => ctx.permissions.has(p);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const todayStr = now.toISOString().slice(0, 10);

  const [
    salesRes,
    payRes,
    balRes,
    belowRes,
    profitRes,
    tasksRes,
    merchantsRes,
    topProdRes,
  ] = await Promise.all([
    has(PERMISSIONS.sales.view)
      ? supabase.from("sales_invoices").select("total").in("status", ["approved", "delivered"]).gte("invoice_date", monthStart)
      : Promise.resolve({ data: null }),
    has(PERMISSIONS.payments.view)
      ? supabase.from("payments").select("amount").is("deleted_at", null).gte("payment_date", monthStart)
      : Promise.resolve({ data: null }),
    has(PERMISSIONS.merchants.view)
      ? supabase.from("v_merchant_balances").select("merchant_id, balance")
      : Promise.resolve({ data: null }),
    has(PERMISSIONS.inventory.view)
      ? supabase.from("v_products").select("id", { count: "exact", head: true }).eq("below_reorder", true)
      : Promise.resolve({ count: null }),
    has(PERMISSIONS.reports.profit)
      ? supabase.rpc("profit_loss", { p_from: monthStart, p_to: todayStr })
      : Promise.resolve({ data: null }),
    has(PERMISSIONS.tasks.view)
      ? supabase.from("tasks").select("id, status, due_date").is("deleted_at", null)
      : Promise.resolve({ data: null }),
    has(PERMISSIONS.merchants.view)
      ? supabase.from("merchants").select("id, name").is("deleted_at", null)
      : Promise.resolve({ data: null }),
    has(PERMISSIONS.reports.sales)
      ? supabase.rpc("report_sales_by_product", { p_from: monthStart, p_to: todayStr })
      : Promise.resolve({ data: null }),
  ]);

  const salesMonth = (salesRes.data ?? []).reduce((s, r) => s + (r.total ?? 0), 0);
  const collectMonth = (payRes.data ?? []).reduce((s, r) => s + (r.amount ?? 0), 0);
  const balances = balRes.data ?? [];
  const outstanding = balances.reduce((s, r) => s + (r.balance ?? 0), 0);
  const belowReorder = belowRes.count ?? null;
  const profitMonth = profitRes.data?.[0]?.net_profit ?? null;

  const tasks = tasksRes.data ?? [];
  const openTasks = tasks.filter((t) => t.status !== "done" && t.status !== "rejected").length;
  const overdueTasks = tasks.filter(
    (t) => t.due_date && t.due_date < todayStr && t.status !== "done" && t.status !== "rejected",
  ).length;

  const merchantName: Record<string, string> = {};
  for (const m of merchantsRes.data ?? []) merchantName[m.id] = m.name;
  const topMerchants = [...balances]
    .filter((b) => (b.balance ?? 0) > 0)
    .sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0))
    .slice(0, 5);
  const topProducts = (topProdRes.data ?? []).slice(0, 5);

  const cards: { label: string; value: string; href?: string; accent?: string }[] = [];
  if (has(PERMISSIONS.sales.view)) cards.push({ label: "مبيعات هذا الشهر", value: fmtMoney(salesMonth), href: "/sales" });
  if (has(PERMISSIONS.payments.view)) cards.push({ label: "تحصيلات هذا الشهر", value: fmtMoney(collectMonth), href: "/payments" });
  if (has(PERMISSIONS.merchants.view)) cards.push({ label: "إجمالي الذمم", value: fmtMoney(outstanding), href: "/reports/aging", accent: "text-red-600" });
  if (has(PERMISSIONS.reports.profit)) cards.push({ label: "الربح التقديري (الشهر)", value: fmtMoney(profitMonth ?? 0), href: "/reports/profit", accent: (profitMonth ?? 0) < 0 ? "text-red-600" : "text-green-700" });
  if (belowReorder != null) cards.push({ label: "أصناف تحت الحد", value: String(belowReorder), href: "/reports/inventory", accent: belowReorder > 0 ? "text-amber-600" : "" });
  if (has(PERMISSIONS.tasks.view)) cards.push({ label: "مهام مفتوحة", value: String(openTasks), href: "/tasks", accent: overdueTasks > 0 ? "text-red-600" : "" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">مرحباً، {ctx.fullName ?? "بك"} 👋</h1>
        <p className="text-muted mt-1">
          دورك: <b className="text-foreground">{ctx.roleNameAr}</b>
          {overdueTasks > 0 && has(PERMISSIONS.tasks.view) && (
            <span className="text-red-600 text-sm mr-3">· لديك {overdueTasks} مهمة متأخرة</span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map((c) => {
          const inner = (
            <>
              <div className="text-xs text-muted">{c.label}</div>
              <div className={`text-2xl font-bold tabular mt-1 ${c.accent ?? ""}`}>{c.value}</div>
            </>
          );
          return c.href ? (
            <Link key={c.label} href={c.href} className="bg-card border border-border rounded-xl p-4 hover:border-primary transition">
              {inner}
            </Link>
          ) : (
            <div key={c.label} className="bg-card border border-border rounded-xl p-4">{inner}</div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                    <td className="px-4 py-2.5 tabular text-left">{fmtMoney(b.balance)}</td>
                  </tr>
                ))}
                {topMerchants.length === 0 && (
                  <tr><td className="px-4 py-6 text-center text-muted">لا ذمم مستحقة.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {has(PERMISSIONS.reports.sales) && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border font-semibold text-sm">الأكثر مبيعاً هذا الشهر</div>
            <table className="w-full text-sm text-right">
              <tbody>
                {topProducts.map((p) => (
                  <tr key={p.product_id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5">{p.product_name}</td>
                    <td className="px-4 py-2.5 tabular text-left">{fmtMoney(p.revenue)}</td>
                  </tr>
                ))}
                {topProducts.length === 0 && (
                  <tr><td className="px-4 py-6 text-center text-muted">لا مبيعات هذا الشهر.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
