import { requireSession, assertPermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import InventoryClient, { type Product } from "@/components/inventory/InventoryClient";

export default async function InventoryPage() {
  const ctx = await requireSession();
  assertPermission(ctx, PERMISSIONS.inventory.view);

  const supabase = await createClient();
  const [
    { data: products },
    { data: warehouses },
    { data: stockByWh },
    { data: movements },
  ] = await Promise.all([
    supabase
      .from("v_products")
      .select("id, name, sku, base_unit_name, reorder_level, stock_qty, is_active")
      .order("name"),
    supabase
      .from("warehouses")
      .select("id, name, is_default")
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("name"),
    supabase.from("v_stock_by_warehouse").select("product_id, warehouse_id, qty"),
    supabase
      .from("stock_movements")
      .select(
        "id, created_at, movement_type, quantity, notes, reference_type, products(name, sku), warehouses(name)",
      )
      .order("created_at", { ascending: false })
      .limit(150),
  ]);

  return (
    <InventoryClient
      products={(products ?? []) as Product[]}
      warehouses={warehouses ?? []}
      stockByWarehouse={stockByWh ?? []}
      movements={movements ?? []}
      canAdjust={ctx.permissions.has(PERMISSIONS.inventory.adjust)}
      canMove={ctx.permissions.has(PERMISSIONS.inventory.movement)}
      canTransfer={ctx.permissions.has(PERMISSIONS.inventory.transfer)}
    />
  );
}
