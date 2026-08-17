import Link from "next/link";
import { getSessionContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fmtMoney, fmtDate } from "@/lib/format";

const money = (n: number | null | undefined) => `${fmtMoney(n ?? 0)} د.ع`;
const KIND: Record<string, string> = { invoice: "فاتورة", payment: "دفعة", return: "مرتجع" };

export default async function PortalHome() {
  const ctx = await getSessionContext();
  const supabase = await createClient();

  const [{ data: summary }, { data: stmt }] = await Promise.all([
    supabase.rpc("portal_summary"),
    supabase.rpc("merchant_statement", { p_merchant: ctx!.portalMerchantId! }),
  ]);
  const s = summary?.[0];
  const recent = (stmt ?? []).slice(-8).reverse();

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">{s?.merchant_name ?? "التاجر"}</h2>
        {s?.shop_name && <p className="text-muted text-sm">{s.shop_name}</p>}
      </div>

      {s?.over_limit && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
          ⚠️ رصيدك تجاوز السقف الائتماني المسموح. يُرجى تسوية جزء من المستحقات.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted">الرصيد المستحق عليك</div>
          <div className={`text-2xl font-bold tabular mt-1 ${(s?.balance ?? 0) > 0 ? "text-red-600" : "text-green-700"}`}>
            {money(s?.balance)}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted">السقف الائتماني</div>
          <div className="text-2xl font-bold tabular mt-1">{money(s?.credit_limit)}</div>
        </div>
        <Link href="/portal/invoices" className="bg-card border border-border rounded-xl p-4 hover:border-primary transition">
          <div className="text-xs text-muted">فواتير غير مسدّدة</div>
          <div className="text-2xl font-bold tabular mt-1">{s?.open_invoices ?? 0}</div>
        </Link>
        <Link href="/portal/statement" className="bg-primary/5 border border-primary/20 rounded-xl p-4 hover:border-primary transition flex flex-col justify-center">
          <div className="text-sm font-medium text-primary">كشف الحساب الكامل ←</div>
        </Link>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border font-semibold text-sm">آخر الحركات</div>
        <table className="w-full text-sm text-right">
          <tbody>
            {recent.map((r, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="px-4 py-2.5 text-muted tabular text-xs w-24">{fmtDate(r.entry_date)}</td>
                <td className="px-4 py-2.5">{r.description}</td>
                <td className={`px-4 py-2.5 tabular text-left ${r.credit > 0 ? "text-green-700" : ""}`}>
                  {r.debit > 0 ? money(r.debit) : `- ${money(r.credit)}`}
                </td>
              </tr>
            ))}
            {recent.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-muted">لا حركات.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
