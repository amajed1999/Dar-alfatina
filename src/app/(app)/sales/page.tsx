import { requireSession, assertPermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import SalesClient, {
  type SalesProduct,
  type MerchantLite,
} from "@/components/sales/SalesClient";

export default async function SalesPage() {
  const ctx = await requireSession();
  assertPermission(ctx, PERMISSIONS.sales.view);

  const supabase = await createClient();
  const [
    { data: invoices },
    { data: returns },
    { data: merchants },
    { data: balances },
    { data: warehouses },
    { data: products },
    { data: prices },
    { data: usdSetting },
  ] = await Promise.all([
    supabase
      .from("sales_invoices")
      .select(
        "id, invoice_number, invoice_date, sale_type, status, currency, exchange_rate, discount, subtotal, total, paid_amount, notes, merchant_id, warehouse_id, merchants(name), sales_invoice_items(id, product_id, quantity, unit_price, discount, line_total)",
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("sales_returns")
      .select(
        "id, return_number, return_date, status, total, merchant_id, original_invoice_id, merchants(name), sales_return_items(id, product_id, quantity, unit_price, line_total)",
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("merchants")
      .select("id, name, price_tier_id, credit_limit, status")
      .is("deleted_at", null)
      .order("name"),
    supabase.from("v_merchant_balances").select("merchant_id, balance"),
    supabase
      .from("warehouses")
      .select("id, name, is_default")
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("name"),
    supabase.from("v_products").select("id, name, sku, barcode").eq("is_active", true).order("name"),
    supabase.from("product_prices").select("product_id, price_tier_id, price"),
    supabase.from("settings").select("value").eq("key", "usd_to_iqd_rate").maybeSingle(),
  ]);

  const balanceMap: Record<string, number> = {};
  for (const b of balances ?? []) if (b.merchant_id) balanceMap[b.merchant_id] = b.balance ?? 0;

  const merchantsLite: MerchantLite[] = (merchants ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    price_tier_id: m.price_tier_id,
    credit_limit: m.credit_limit,
    status: m.status as "active" | "suspended",
    balance: balanceMap[m.id] ?? 0,
  }));

  // خريطة الأسعار: منتج -> فئة -> سعر
  const priceMap: Record<string, Record<string, number>> = {};
  for (const p of prices ?? []) {
    priceMap[p.product_id] ??= {};
    priceMap[p.product_id][p.price_tier_id] = p.price;
  }

  const sProducts: SalesProduct[] = (products ?? []).map((p) => ({
    id: p.id ?? "",
    name: p.name ?? "",
    sku: p.sku ?? "",
    barcode: p.barcode ?? null,
  }));

  const defaultUsdRate = Number(usdSetting?.value ?? 1) || 1;

  return (
    <SalesClient
      invoices={invoices ?? []}
      returns={returns ?? []}
      merchants={merchantsLite}
      warehouses={warehouses ?? []}
      products={sProducts}
      pricesByProductTier={priceMap}
      defaultUsdRate={defaultUsdRate}
      canCreate={ctx.permissions.has(PERMISSIONS.sales.invoiceCreate)}
      canApprove={ctx.permissions.has(PERMISSIONS.sales.invoiceApprove)}
      canEditPrice={ctx.permissions.has(PERMISSIONS.sales.invoiceEditPrice)}
      canOverrideCredit={ctx.permissions.has(PERMISSIONS.merchants.approveCredit)}
      canReturn={ctx.permissions.has(PERMISSIONS.sales.returnCreate)}
    />
  );
}
