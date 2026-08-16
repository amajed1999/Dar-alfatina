import { requireSession, assertPermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { fmtDateTime } from "@/lib/format";

const ACTION: Record<string, { label: string; cls: string }> = {
  INSERT: { label: "إضافة", cls: "bg-green-50 text-green-700" },
  UPDATE: { label: "تعديل", cls: "bg-blue-50 text-blue-700" },
  DELETE: { label: "حذف", cls: "bg-red-50 text-red-700" },
};

const TABLE_AR: Record<string, string> = {
  merchants: "التجار", products: "المنتجات", product_prices: "أسعار المنتجات",
  sales_invoices: "فواتير البيع", sales_invoice_items: "بنود فواتير البيع",
  sales_returns: "مرتجعات البيع", purchase_invoices: "فواتير الشراء",
  payments: "التحصيلات", payment_allocations: "تخصيصات التحصيل",
  rep_settlements: "تسليم العهدة", expenses: "المصاريف",
  consumption_notes: "قوائم الاستهلاك", stock_movements: "حركات المخزون",
  categories: "التصنيفات", suppliers: "الموردون", warehouses: "المخازن",
  user_profiles: "المستخدمون", roles: "الأدوار", tasks: "المهام",
  merchant_visits: "زيارات المندوبين",
};

export default async function AuditPage() {
  const ctx = await requireSession();
  assertPermission(ctx, PERMISSIONS.admin.auditView);

  const supabase = await createClient();
  const [{ data: logs }, { data: users }] = await Promise.all([
    supabase
      .from("audit_log")
      .select("id, action, table_name, record_id, changed_by, changed_at")
      .order("changed_at", { ascending: false })
      .limit(200),
    supabase.rpc("admin_list_users"),
  ]);

  const userName: Record<string, string> = {};
  for (const u of users ?? []) userName[u.id] = u.full_name || u.email;

  const list = logs ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">سجل التدقيق</h1>
        <p className="text-muted mt-1 text-sm">
          كل تغيير حسّاس في النظام (من غيّر، ماذا، ومتى). آخر ٢٠٠ عملية.
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-background text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">الوقت</th>
                <th className="px-4 py-3 font-medium">العملية</th>
                <th className="px-4 py-3 font-medium">الجدول</th>
                <th className="px-4 py-3 font-medium">المستخدم</th>
                <th className="px-4 py-3 font-medium">معرّف السجل</th>
              </tr>
            </thead>
            <tbody>
              {list.map((l) => {
                const a = ACTION[l.action] ?? { label: l.action, cls: "bg-border text-muted" };
                return (
                  <tr key={l.id} className="border-t border-border">
                    <td className="px-4 py-3 text-muted tabular">{fmtDateTime(l.changed_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs rounded-full px-2.5 py-1 ${a.cls}`}>{a.label}</span>
                    </td>
                    <td className="px-4 py-3">{TABLE_AR[l.table_name] ?? l.table_name}</td>
                    <td className="px-4 py-3 text-muted">
                      {l.changed_by ? userName[l.changed_by] ?? "—" : "النظام"}
                    </td>
                    <td className="px-4 py-3 text-muted text-xs tabular" dir="ltr">
                      {l.record_id ? l.record_id.slice(0, 8) : "—"}
                    </td>
                  </tr>
                );
              })}
              {list.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted">لا سجلّات.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
