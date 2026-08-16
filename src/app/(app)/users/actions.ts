"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";

type ActionResult = { ok: boolean; error?: string };

async function guard(): Promise<ActionResult | null> {
  const ctx = await getSessionContext();
  if (!ctx || !ctx.permissions.has(PERMISSIONS.admin.usersManage)) {
    return { ok: false, error: "غير مصرح لك بإدارة المستخدمين." };
  }
  return null;
}

/** إسناد دور لمستخدم (أو إزالته بتمرير null) */
export async function setUserRole(
  userId: string,
  roleId: string | null,
): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase
    .from("user_profiles")
    .update({ role_id: roleId })
    .eq("id", userId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/users");
  return { ok: true };
}

/** تفعيل/تعطيل حساب مستخدم */
export async function setUserActive(
  userId: string,
  isActive: boolean,
): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase
    .from("user_profiles")
    .update({ is_active: isActive })
    .eq("id", userId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/users");
  return { ok: true };
}
