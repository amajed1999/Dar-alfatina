import { requireSession, assertPermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import OrdersClient, { type OrderRow } from "@/components/orders/OrdersClient";

export default async function OrdersPage() {
  const ctx = await requireSession();
  assertPermission(ctx, PERMISSIONS.orders.view);

  const supabase = await createClient();
  const { data } = await supabase
    .from("merchant_orders")
    .select(
      "id, order_number, order_date, status, total, notes, merchant_id, metadata, merchants(name, shop_name), merchant_order_items(id, quantity, unit_price, line_total, products(name))",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const rows: OrderRow[] = (data ?? []).map((o) => ({
    id: o.id,
    order_number: o.order_number,
    order_date: o.order_date,
    status: o.status,
    total: o.total,
    notes: o.notes,
    merchant_name: (o.merchants as { name: string | null } | null)?.name ?? "—",
    shop_name: (o.merchants as { shop_name: string | null } | null)?.shop_name ?? null,
    has_invoice: !!(o.metadata as { invoice_id?: string } | null)?.invoice_id,
    items: (o.merchant_order_items ?? []).map((it) => ({
      id: it.id,
      name: (it.products as { name: string | null } | null)?.name ?? "—",
      qty: it.quantity,
      price: it.unit_price,
      line: it.line_total ?? 0,
    })),
  }));

  return (
    <OrdersClient
      orders={rows}
      canManage={ctx.permissions.has(PERMISSIONS.orders.manage)}
      canInvoice={ctx.permissions.has(PERMISSIONS.sales.invoiceCreate)}
    />
  );
}
