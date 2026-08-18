import { requireSession, assertPermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import TargetsClient, { type TargetRow } from "@/components/targets/TargetsClient";

function monthStart(ym?: string): string {
  // ym = "YYYY-MM" أو غير موجود → الشهر الحالي
  const d = ym && /^\d{4}-\d{2}$/.test(ym) ? new Date(`${ym}-01T00:00:00`) : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default async function TargetsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const ctx = await requireSession();
  assertPermission(ctx, PERMISSIONS.sales.targetsView);

  const { month } = await searchParams;
  const monthDate = monthStart(month);
  const ym = monthDate.slice(0, 7);

  const supabase = await createClient();
  const { data } = await supabase.rpc("rep_targets", { p_month: monthDate });

  const rows: TargetRow[] = (data ?? []).map((r) => ({
    rep_id: r.rep_id,
    rep_name: r.rep_name,
    target_amount: r.target_amount,
    achieved: r.achieved,
    pct: r.pct,
    invoices_count: Number(r.invoices_count),
  }));

  return (
    <TargetsClient
      rows={rows}
      month={ym}
      canManage={ctx.permissions.has(PERMISSIONS.sales.targetsManage)}
    />
  );
}
