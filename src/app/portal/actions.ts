"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth";

type Result = { ok: boolean; error?: string; id?: string };

export async function placeOrder(
  items: { product_id: string; quantity: number }[],
  notes: string | null,
): Promise<Result> {
  const ctx = await getSessionContext();
  if (!ctx?.portalMerchantId) return { ok: false, error: "غير مصرح." };
  const clean = items.filter((i) => i.product_id && i.quantity > 0);
  if (clean.length === 0) return { ok: false, error: "أضف منتجاً واحداً على الأقل." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("portal_place_order", {
    p_items: clean,
    p_notes: notes ?? undefined,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/portal/orders");
  return { ok: true, id: data as string };
}
