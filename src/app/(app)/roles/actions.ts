"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";

type ActionResult = { ok: boolean; error?: string };

async function guard(): Promise<ActionResult | null> {
  const ctx = await getSessionContext();
  if (!ctx || !ctx.permissions.has(PERMISSIONS.admin.rolesManage)) {
    return { ok: false, error: "غير مصرح لك بإدارة الأدوار." };
  }
  return null;
}

/** تفعيل/إلغاء صلاحية لدور معيّن */
export async function togglePermission(
  roleId: string,
  permissionId: string,
  enabled: boolean,
): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const supabase = await createClient();

  if (enabled) {
    const { error } = await supabase
      .from("role_permissions")
      .upsert({ role_id: roleId, permission_id: permissionId });
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("role_permissions")
      .delete()
      .eq("role_id", roleId)
      .eq("permission_id", permissionId);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/roles");
  return { ok: true };
}

/** إنشاء دور جديد (قابل للتوسّع من الواجهة) */
export async function createRole(
  nameAr: string,
  key: string,
): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const cleanKey = key.trim().toLowerCase().replace(/\s+/g, "_");
  if (!cleanKey || !nameAr.trim()) {
    return { ok: false, error: "الاسم والمفتاح مطلوبان." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("roles")
    .insert({ name_ar: nameAr.trim(), key: cleanKey, is_system: false });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/roles");
  return { ok: true };
}
