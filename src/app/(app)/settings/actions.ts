"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import type { Json } from "@/lib/database.types";

type ActionResult = { ok: boolean; error?: string };

export async function updateSettings(
  entries: { key: string; value: Json }[],
): Promise<ActionResult> {
  const ctx = await getSessionContext();
  if (!ctx || !ctx.permissions.has(PERMISSIONS.admin.settingsManage)) {
    return { ok: false, error: "غير مصرح لك بتعديل الإعدادات." };
  }

  const supabase = await createClient();
  for (const { key, value } of entries) {
    const { error } = await supabase
      .from("settings")
      .update({ value, updated_by: ctx.userId })
      .eq("key", key);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/settings");
  return { ok: true };
}
