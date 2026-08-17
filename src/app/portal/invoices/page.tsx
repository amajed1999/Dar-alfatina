import { createClient } from "@/lib/supabase/server";
import { fmtMoney, fmtDate } from "@/lib/format";

const money = (n: number | null | undefined) => `${fmtMoney(n ?? 0)} د.ع`;
const SALE_TYPE: Record<string, string> = { cash: "نقد", credit: "آجل", partial: "جزئي" };

export default async function PortalInvoices() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("portal_invoices");
  const list = data ?? [];

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold">فواتيري</h2>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-background text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">الرقم</th>
                <th className="px-4 py-3 font-medium">التاريخ</th>
                <th className="px-4 py-3 font-medium">النوع</th>
                <th className="px-4 py-3 font-medium">الإجمالي</th>
                <th className="px-4 py-3 font-medium">المتبقّي</th>
              </tr>
            </thead>
            <tbody>
              {list.map((v) => (
                <tr key={v.invoice_id} className="border-t border-border">
                  <td className="px-4 py-3 tabular" dir="ltr">{v.invoice_number ?? "—"}</td>
                  <td className="px-4 py-3 text-muted tabular">{fmtDate(v.invoice_date)}</td>
                  <td className="px-4 py-3 text-muted">{SALE_TYPE[v.sale_type] ?? v.sale_type}</td>
                  <td className="px-4 py-3 tabular">{money(v.total)}</td>
                  <td className={`px-4 py-3 tabular font-medium ${v.remaining > 0 ? "text-red-600" : "text-green-700"}`}>
                    {v.remaining > 0 ? money(v.remaining) : "مسدّدة"}
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted">لا فواتير.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
