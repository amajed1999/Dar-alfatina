import { requireSession, assertPermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { fmtNum, fmtDateTime } from "@/lib/format";
import ExportButtons from "@/components/ExportButtons";

const TYPE: Record<string, string> = {
  purchase: "شراء",
  sale: "بيع",
  sale_return: "مرتجع بيع",
  purchase_return: "مرتجع شراء",
  consumption: "استهلاك",
  damage: "تالف",
  adjustment: "تسوية جرد",
  transfer_in: "تحويل وارد",
  transfer_out: "تحويل صادر",
};

export default async function ItemMovementPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; from?: string; to?: string }>;
}) {
  const ctx = await requireSession();
  assertPermission(ctx, PERMISSIONS.reports.inventory);

  const sp = await searchParams;
  const supabase = await createClient();

  const { data: products } = await supabase
    .from("v_products")
    .select("id, name, sku")
    .order("name");

  let rows: { mv_date: string; movement_type: string; quantity: number; running: number; reference_type: string | null; notes: string | null }[] = [];
  let errMsg: string | null = null;
  if (sp.product) {
    const { data, error } = await supabase.rpc("item_movement", {
      p_product: sp.product,
      p_from: sp.from || undefined,
      p_to: sp.to || undefined,
    });
    rows = data ?? [];
    errMsg = error?.message ?? null;
  }

  const headers = ["التاريخ", "نوع الحركة", "الكمية", "الرصيد المتراكم", "المرجع"];
  const exportRows = rows.map((r) => [
    fmtDateTime(r.mv_date), TYPE[r.movement_type] ?? r.movement_type, r.quantity, r.running, r.reference_type ?? "",
  ]);

  return (
    <div className="space-y-6 print-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">حركة صنف</h1>
          <p className="text-muted mt-1 text-sm">كل الحركات على منتج معيّن خلال فترة، برصيد متراكم.</p>
        </div>
        {rows.length > 0 && <ExportButtons filename="item-movement" headers={headers} rows={exportRows} />}
      </div>

      <form method="GET" className="flex items-end gap-3 flex-wrap no-print">
        <div className="min-w-56">
          <label className="block text-sm mb-1">المنتج</label>
          <select name="product" defaultValue={sp.product ?? ""} className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:border-primary bg-card">
            <option value="">— اختر منتجاً —</option>
            {(products ?? []).map((p) => (
              <option key={p.id} value={p.id ?? ""}>{p.name}{p.sku ? ` (${p.sku})` : ""}</option>
            ))}
          </select>
        </div>
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

      {errMsg && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{errMsg}</p>}

      {sp.product ? (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-background text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">التاريخ</th>
                  <th className="px-4 py-3 font-medium">نوع الحركة</th>
                  <th className="px-4 py-3 font-medium">الكمية</th>
                  <th className="px-4 py-3 font-medium">الرصيد المتراكم</th>
                  <th className="px-4 py-3 font-medium">المرجع</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-4 py-3 text-muted tabular">{fmtDateTime(r.mv_date)}</td>
                    <td className="px-4 py-3">{TYPE[r.movement_type] ?? r.movement_type}</td>
                    <td className={`px-4 py-3 tabular ${r.quantity < 0 ? "text-red-600" : "text-green-700"}`}>
                      {r.quantity > 0 ? "+" : ""}{fmtNum(r.quantity)}
                    </td>
                    <td className="px-4 py-3 tabular font-medium">{fmtNum(r.running)}</td>
                    <td className="px-4 py-3 text-muted text-xs">{r.reference_type ?? "—"}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-muted">لا حركات في هذه الفترة.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl px-4 py-12 text-center text-muted">اختر منتجاً لعرض حركته.</div>
      )}
    </div>
  );
}
