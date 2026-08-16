import { requireSession, assertPermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import ProductsClient, { type ProductRow } from "@/components/products/ProductsClient";

export default async function ProductsPage() {
  const ctx = await requireSession();
  assertPermission(ctx, PERMISSIONS.products.view);

  const canViewPrices = ctx.permissions.has(PERMISSIONS.products.viewPrices);
  const supabase = await createClient();

  const [{ data: products }, { data: categories }, { data: units }, { data: tiers }] =
    await Promise.all([
      supabase.from("v_products").select("*").order("name"),
      supabase.from("categories").select("id, name").is("deleted_at", null).order("name"),
      supabase.from("units").select("id, name").order("name"),
      supabase.from("price_tiers").select("id, key, name_ar, sort_order").order("sort_order"),
    ]);

  // الأسعار (فقط لمن يملك صلاحية رؤيتها)
  let pricesByProduct: Record<string, Record<string, number>> = {};
  if (canViewPrices) {
    const { data: prices } = await supabase
      .from("product_prices")
      .select("product_id, price_tier_id, price");
    for (const p of prices ?? []) {
      pricesByProduct[p.product_id] ??= {};
      pricesByProduct[p.product_id][p.price_tier_id] = p.price;
    }
  }

  return (
    <ProductsClient
      products={(products ?? []) as ProductRow[]}
      categories={categories ?? []}
      units={units ?? []}
      tiers={tiers ?? []}
      pricesByProduct={pricesByProduct}
      canViewPrices={canViewPrices}
      canCreate={ctx.permissions.has(PERMISSIONS.products.create)}
      canEdit={ctx.permissions.has(PERMISSIONS.products.edit)}
    />
  );
}
