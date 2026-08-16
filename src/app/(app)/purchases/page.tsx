import { requireSession, assertPermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import PurchasesClient, { type Product } from "@/components/purchases/PurchasesClient";

export default async function PurchasesPage() {
  const ctx = await requireSession();
  assertPermission(ctx, PERMISSIONS.purchases.view);

  const supabase = await createClient();
  const [
    { data: invoices },
    { data: suppliers },
    { data: warehouses },
    { data: products },
    { data: usdSetting },
  ] = await Promise.all([
    supabase
      .from("purchase_invoices")
      .select(
        "id, invoice_number, invoice_date, status, currency, exchange_rate, discount, subtotal, total, notes, supplier_id, warehouse_id, suppliers(name), purchase_invoice_items(id, product_id, quantity, unit_cost, discount, line_total)",
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("suppliers")
      .select("id, name")
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("warehouses")
      .select("id, name, is_default")
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("v_products")
      .select("id, name, sku, base_unit_name")
      .eq("is_active", true)
      .order("name"),
    supabase.from("settings").select("value").eq("key", "usd_to_iqd_rate").maybeSingle(),
  ]);

  const defaultUsdRate = Number(usdSetting?.value ?? 1) || 1;

  return (
    <PurchasesClient
      invoices={invoices ?? []}
      suppliers={suppliers ?? []}
      warehouses={warehouses ?? []}
      products={(products ?? []) as Product[]}
      defaultUsdRate={defaultUsdRate}
      canCreate={ctx.permissions.has(PERMISSIONS.purchases.create)}
      canEdit={ctx.permissions.has(PERMISSIONS.purchases.edit)}
      canApprove={ctx.permissions.has(PERMISSIONS.purchases.approve)}
    />
  );
}
