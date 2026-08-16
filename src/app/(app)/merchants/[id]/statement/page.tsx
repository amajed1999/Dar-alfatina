import Link from "next/link";
import { requireSession, assertPermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { fmtMoney, fmtDate } from "@/lib/format";

const KIND: Record<string, string> = {
  invoice: "فاتورة",
  payment: "تحصيل",
  return: "مرتجع",
};

export default async function MerchantStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const ctx = await requireSession();
  assertPermission(ctx, PERMISSIONS.merchants.view);

  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ data: merchant }, { data: rows, error }] = await Promise.all([
    supabase.from("merchants").select("id, name, shop_name, phone, province").eq("id", id).maybeSingle(),
    supabase.rpc("merchant_statement", {
      p_merchant: id,
      p_from: sp.from || undefined,
      p_to: sp.to || undefined,
    }),
  ]);

  const list = rows ?? [];
  const closing = list.length > 0 ? list[list.length - 1].running : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/merchants" className="text-sm text-muted hover:text-foreground">← التجار</Link>
          </div>
          <h1 className="text-2xl font-bold mt-1">كشف حساب: {merchant?.name ?? "—"}</h1>
          {merchant?.shop_name && <p className="text-muted text-sm">{merchant.shop_name}</p>}
        </div>
        <div className="bg-card border border-border rounded-xl px-5 py-3 text-center">
          <div className="text-xs text-muted">الرصيد الحالي</div>
          <div className={`text-2xl font-bold tabular ${closing > 0 ? "text-red-600" : "text-green-700"}`}>
            {fmtMoney(closing)} <span className="text-sm">د.ع</span>
          </div>
        </div>
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

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error.message}</p>}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-background text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">التاريخ</th>
                <th className="px-4 py-3 font-medium">النوع</th>
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
                  <td className="px-4 py-3 text-muted">{KIND[r.kind] ?? r.kind}</td>
                  <td className="px-4 py-3">{r.description}</td>
                  <td className="px-4 py-3 tabular">{r.debit > 0 ? fmtMoney(r.debit) : "—"}</td>
                  <td className="px-4 py-3 tabular text-green-700">{r.credit > 0 ? fmtMoney(r.credit) : "—"}</td>
                  <td className="px-4 py-3 tabular font-medium">{fmtMoney(r.running)}</td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted">لا توجد حركات في هذه الفترة.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
