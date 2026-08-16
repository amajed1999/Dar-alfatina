import { requireSession, assertPermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { fmtDateTime } from "@/lib/format";

const OUTCOME: Record<string, string> = {
  order: "طلبية",
  collection: "تحصيل",
  follow_up: "متابعة",
  no_order: "بلا طلب",
  other: "أخرى",
};

export default async function VisitsPage() {
  const ctx = await requireSession();
  assertPermission(ctx, PERMISSIONS.merchants.view);

  const canManage = ctx.permissions.has(PERMISSIONS.admin.usersManage);
  const supabase = await createClient();

  const [{ data: visits }, { data: merchants }] = await Promise.all([
    supabase
      .from("merchant_visits")
      .select("id, visited_at, merchant_id, rep_id, outcome, notes, latitude, longitude, accuracy")
      .is("deleted_at", null)
      .order("visited_at", { ascending: false })
      .limit(300),
    supabase.from("merchants").select("id, name").is("deleted_at", null),
  ]);

  const merchantName: Record<string, string> = {};
  for (const m of merchants ?? []) merchantName[m.id] = m.name;

  let repNames: Record<string, string> = {};
  if (canManage) {
    const { data: users } = await supabase.rpc("admin_list_users");
    for (const u of users ?? []) repNames[u.id] = u.full_name || u.email;
  }
  const repLabel = (id: string | null) =>
    !id ? "—" : id === ctx.userId ? ctx.fullName ?? "أنت" : repNames[id] ?? "—";

  const list = visits ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">زيارات المندوبين</h1>
        <p className="text-muted mt-1 text-sm">
          سجلّ الزيارات الميدانية للتجار مع الموقع والنتيجة. تُسجَّل من صفحة «التجار» بزرّ 📍 زيارة.
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-background text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">الوقت</th>
                <th className="px-4 py-3 font-medium">التاجر</th>
                <th className="px-4 py-3 font-medium">المندوب</th>
                <th className="px-4 py-3 font-medium">النتيجة</th>
                <th className="px-4 py-3 font-medium">الموقع</th>
                <th className="px-4 py-3 font-medium">ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              {list.map((v) => (
                <tr key={v.id} className="border-t border-border">
                  <td className="px-4 py-3 text-muted tabular">{fmtDateTime(v.visited_at)}</td>
                  <td className="px-4 py-3 font-medium">{merchantName[v.merchant_id] ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">{repLabel(v.rep_id)}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-background border border-border rounded-full px-2.5 py-1">
                      {OUTCOME[v.outcome] ?? v.outcome}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {v.latitude != null && v.longitude != null ? (
                      <a
                        href={`https://maps.google.com/?q=${v.latitude},${v.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        📍 خريطة{v.accuracy != null ? ` (~${v.accuracy}م)` : ""}
                      </a>
                    ) : (
                      <span className="text-muted text-xs">بلا موقع</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">{v.notes ?? "—"}</td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted">
                    لا زيارات مسجّلة بعد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
