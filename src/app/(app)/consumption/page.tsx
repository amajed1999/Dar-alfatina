import { requireSession, assertPermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import ConsumptionClient, {
  type NoteRow,
  type SProduct,
} from "@/components/consumption/ConsumptionClient";

export default async function ConsumptionPage() {
  const ctx = await requireSession();
  assertPermission(ctx, PERMISSIONS.consumption.view);

  const canViewCost = ctx.permissions.has(PERMISSIONS.products.viewPrices);
  const supabase = await createClient();
  const [{ data: notes }, { data: warehouses }, { data: products }] = await Promise.all([
    supabase
      .from("consumption_notes")
      .select(
        "id, note_number, note_date, reason_type, reason, status, total_cost, warehouse_id, consumption_note_items(id, product_id, quantity, line_cost)",
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("warehouses")
      .select("id, name, is_default")
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("name"),
    supabase.from("v_products").select("id, name, sku").eq("is_active", true).order("name"),
  ]);

  const rows: NoteRow[] = (notes ?? []).map((n) => ({
    id: n.id,
    note_number: n.note_number,
    note_date: n.note_date,
    reason_type: n.reason_type,
    reason: n.reason,
    status: n.status,
    total_cost: n.total_cost,
    warehouse_id: n.warehouse_id,
    items: (n.consumption_note_items ?? []).map((it) => ({
      id: it.id,
      product_id: it.product_id,
      quantity: it.quantity,
      line_cost: it.line_cost,
    })),
  }));

  const sProducts: SProduct[] = (products ?? []).map((p) => ({
    id: p.id ?? "",
    name: p.name ?? "",
    sku: p.sku ?? "",
  }));

  return (
    <ConsumptionClient
      notes={rows}
      warehouses={warehouses ?? []}
      products={sProducts}
      canViewCost={canViewCost}
      canCreate={ctx.permissions.has(PERMISSIONS.consumption.create)}
      canApprove={ctx.permissions.has(PERMISSIONS.consumption.approve)}
    />
  );
}
