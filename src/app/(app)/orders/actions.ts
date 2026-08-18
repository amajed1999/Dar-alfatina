"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";

type Result = { ok: boolean; error?: string; id?: string };

export async function updateOrderStatus(id: string, status: string): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx || !ctx.permissions.has(PERMISSIONS.orders.manage))
    return { ok: false, error: "غير مصرح لك بإدارة الطلبات." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_order_status", { p_order: id, p_status: status });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/orders");
  return { ok: true };
}

export async function convertOrderToInvoice(id: string): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx || !ctx.permissions.has(PERMISSIONS.sales.invoiceCreate))
    return { ok: false, error: "غير مصرح لك بإنشاء فواتير البيع." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_invoice_from_order", { p_order: id });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/orders");
  revalidatePath("/sales");
  return { ok: true, id: data as string };
}
