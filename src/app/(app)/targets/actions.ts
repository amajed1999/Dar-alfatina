"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";

type ActionResult = { ok: boolean; error?: string };

/** ضبط هدف مندوب لشهر معيّن (month = أول يوم بالشهر YYYY-MM-01). */
export async function setTarget(
  repId: string,
  month: string,
  amount: number,
): Promise<ActionResult> {
  const ctx = await getSessionContext();
  if (!ctx || !ctx.permissions.has(PERMISSIONS.sales.targetsManage)) {
    return { ok: false, error: "غير مصرح لك بإدارة الأهداف." };
  }
  if (!(amount >= 0)) return { ok: false, error: "المبلغ غير صحيح." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_rep_target", {
    p_rep: repId,
    p_month: month,
    p_amount: amount,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/targets");
  return { ok: true };
}
