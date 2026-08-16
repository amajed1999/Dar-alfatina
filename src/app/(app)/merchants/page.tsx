import { requireSession, assertPermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import MerchantsClient, { type MerchantRow } from "@/components/merchants/MerchantsClient";

export default async function MerchantsPage() {
  const ctx = await requireSession();
  assertPermission(ctx, PERMISSIONS.merchants.view);

  const canViewAll = ctx.permissions.has(PERMISSIONS.merchants.viewAll);
  const canManage = ctx.permissions.has(PERMISSIONS.admin.usersManage);
  const supabase = await createClient();

  const [{ data: merchants }, { data: balances }, { data: tiers }] = await Promise.all([
    supabase
      .from("merchants")
      .select(
        "id, name, shop_name, phone, province, address, credit_limit, price_tier_id, assigned_rep, status, notes, price_tiers(name_ar)",
      )
      .is("deleted_at", null)
      .order("name"),
    supabase.from("v_merchant_balances").select("merchant_id, balance"),
    supabase.from("price_tiers").select("id, name_ar, sort_order").order("sort_order"),
  ]);

  const balanceMap: Record<string, number> = {};
  for (const b of balances ?? []) {
    if (b.merchant_id) balanceMap[b.merchant_id] = b.balance ?? 0;
  }

  // قائمة المندوبين (للمدير فقط، لإسناد التجار)
  let reps: { id: string; full_name: string }[] = [];
  if (canViewAll && canManage) {
    const { data: users } = await supabase.rpc("admin_list_users");
    reps = (users ?? [])
      .filter((u) => u.role_name === "مندوب مبيعات" || u.role_name === "مدير المبيعات")
      .map((u) => ({ id: u.id, full_name: u.full_name || u.email }));
  }

  const rows: MerchantRow[] = (merchants ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    shop_name: m.shop_name,
    phone: m.phone,
    province: m.province,
    address: m.address,
    credit_limit: m.credit_limit,
    price_tier_id: m.price_tier_id,
    tier_name: (m.price_tiers as { name_ar: string } | null)?.name_ar ?? null,
    assigned_rep: m.assigned_rep,
    status: m.status as "active" | "suspended",
    notes: m.notes,
    balance: balanceMap[m.id] ?? 0,
  }));

  return (
    <MerchantsClient
      merchants={rows}
      tiers={tiers ?? []}
      reps={reps}
      canViewAll={canViewAll}
      canCreate={ctx.permissions.has(PERMISSIONS.merchants.create)}
      canEdit={ctx.permissions.has(PERMISSIONS.merchants.edit)}
      canVisit={ctx.permissions.has(PERMISSIONS.merchants.visit)}
    />
  );
}
