import { getSessionContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fmtMoney, fmtDate } from "@/lib/format";

const money = (n: number | null | undefined) => `${fmtMoney(n ?? 0)} د.ع`;
const KIND: Record<string, string> = { invoice: "فاتورة", payment: "دفعة", return: "مرتجع" };

export default async function PortalStatement({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const ctx = await getSessionContext();
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: rows } = await supabase.rpc("merchant_statement", {
    p_merchant: ctx!.portalMerchantId!,
    p_from: sp.from || undefined,
    p_to: sp.to || undefined,
  });
  const list = rows ?? [];
  const closing = list.length > 0 ? list[list.length - 1].running : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-xl font-bold">كشف الحساب</h2>
        <div className="bg-card border border-border rounded-xl px-4 py-2 text-center">
          <div className="text-xs text-muted">الرصيد الحالي</div>
          <div className={`text-xl font-bold tabular ${closing > 0 ? "text-red-600" : "text-green-700"}`}>{money(closing)}</div>
        </div>
      </div>

      <form method="GET" className="flex items-end gap-2 flex-wrap">
        <div>
          <label className="block text-xs text-muted mb-1">من</label>
          <input type="date" name="from" defaultValue={sp.from ?? ""} dir="ltr" className="border border-border rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-primary bg-card" />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">إلى</label>
          <input type="date" name="to" defaultValue={sp.to ?? ""} dir="ltr" className="border border-border rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-primary bg-card" />
        </div>
        <button className="bg-primary hover:bg-[var(--primary-hover)] text-white rounded-lg py-1.5 px-4 text-sm transition">عرض</button>
      </form>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-background text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">التاريخ</th>
                <th className="px-4 py-3 font-medium">البيان</th>
                <th className="px-4 py-3 font-medium">مدين</th>
                <th className="px-4 py-3 font-medium">دائن</th>
                <th className="px-4 py-3 font-medium">الرصيد</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-4 py-3 text-muted tabular">{fmtDate(r.entry_date)}</td>
                  <td className="px-4 py-3">{r.description}</td>
                  <td className="px-4 py-3 tabular">{r.debit > 0 ? money(r.debit) : "—"}</td>
                  <td className="px-4 py-3 tabular text-green-700">{r.credit > 0 ? money(r.credit) : "—"}</td>
                  <td className="px-4 py-3 tabular font-medium">{money(r.running)}</td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted">لا حركات في هذه الفترة.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
