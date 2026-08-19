import { requireSession, assertPermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import QuotationsClient, {
  type QuoteRow,
  type QMerchant,
  type QProduct,
} from "@/components/quotations/QuotationsClient";

export default async function QuotationsPage() {
  const ctx = await requireSession();
  assertPermission(ctx, PERMISSIONS.sales.quotationsView);

  const supabase = await createClient();
  const [
    { data: quotes },
    { data: merchants },
    { data: products },
    { data: prices },
    { data: company },
  ] = await Promise.all([
    supabase
      .from("quotations")
      .select(
        "id, quote_number, quote_date, valid_until, currency, exchange_rate, discount, subtotal, total, status, notes, merchant_id, converted_invoice_id, merchants(name, shop_name, phone), quotation_items(id, product_id, quantity, unit_price, discount, line_total)",
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("merchants").select("id, name, price_tier_id, status").is("deleted_at", null).order("name"),
    supabase.from("v_products").select("id, name, sku, barcode").eq("is_active", true).order("name"),
    supabase.from("product_prices").select("product_id, price_tier_id, price"),
    supabase.from("settings").select("value").eq("key", "company_name").maybeSingle(),
  ]);

  const merchantsLite: QMerchant[] = (merchants ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    price_tier_id: m.price_tier_id,
    status: m.status,
  }));
  const productsLite: QProduct[] = (products ?? []).map((p) => ({
    id: p.id ?? "",
    name: p.name ?? "",
    sku: p.sku ?? "",
    barcode: p.barcode ?? null,
  }));
  const priceList = (prices ?? []).map((p) => ({
    product_id: p.product_id,
    price_tier_id: p.price_tier_id,
    price: p.price,
  }));

  const rows: QuoteRow[] = (quotes ?? []).map((q) => ({
    id: q.id,
    quote_number: q.quote_number,
    quote_date: q.quote_date,
    valid_until: q.valid_until,
    currency: q.currency,
    exchange_rate: q.exchange_rate,
    discount: q.discount,
    subtotal: q.subtotal,
    total: q.total,
    status: q.status,
    notes: q.notes,
    merchant_id: q.merchant_id,
    merchant_name: (q.merchants as { name: string | null } | null)?.name ?? "—",
    merchant_shop: (q.merchants as { shop_name: string | null } | null)?.shop_name ?? null,
    merchant_phone: (q.merchants as { phone: string | null } | null)?.phone ?? null,
    converted: !!q.converted_invoice_id,
    items: (q.quotation_items ?? []).map((it) => ({
      product_id: it.product_id,
      quantity: it.quantity,
      unit_price: it.unit_price,
      discount: it.discount,
      line_total: it.line_total ?? 0,
    })),
  }));

  return (
    <QuotationsClient
      quotes={rows}
      merchants={merchantsLite}
      products={productsLite}
      prices={priceList}
      companyName={(company?.value as string) ?? "شركة دار الفاتنة"}
      canCreate={ctx.permissions.has(PERMISSIONS.sales.quotationsCreate)}
      canConvert={ctx.permissions.has(PERMISSIONS.sales.invoiceCreate)}
      canEditPrice={ctx.permissions.has(PERMISSIONS.sales.invoiceEditPrice)}
    />
  );
}
