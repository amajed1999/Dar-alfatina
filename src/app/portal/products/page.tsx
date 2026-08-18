import { createClient } from "@/lib/supabase/server";
import PortalOrderClient, { type CatalogProduct } from "@/components/portal/PortalOrderClient";

export default async function PortalProductsPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("portal_products");

  const products: CatalogProduct[] = (data ?? []).map((p) => ({
    product_id: p.product_id,
    name: p.name,
    sku: p.sku,
    category_name: p.category_name,
    base_unit_name: p.base_unit_name,
    price: p.price,
    stock_qty: p.stock_qty,
  }));

  return <PortalOrderClient products={products} />;
}
