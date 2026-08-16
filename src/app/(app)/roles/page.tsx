import { requireSession, assertPermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import RolesManager from "@/components/RolesManager";

export default async function RolesPage() {
  const ctx = await requireSession();
  assertPermission(ctx, PERMISSIONS.admin.rolesManage);

  const supabase = await createClient();
  const [{ data: roles }, { data: permissions }, { data: rolePerms }] =
    await Promise.all([
      supabase
        .from("roles")
        .select("id, name_ar, key, is_system")
        .is("deleted_at", null)
        .order("is_system", { ascending: false })
        .order("name_ar"),
      supabase
        .from("permissions")
        .select("id, key, module, name_ar")
        .order("module"),
      supabase.from("role_permissions").select("role_id, permission_id"),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">الأدوار والصلاحيات</h1>
        <p className="text-muted mt-1 text-sm">
          تُضبط الصلاحيات لكل دور من هنا — دون تعديل الكود. الأدوار الأساسية
          محميّة من الحذف.
        </p>
      </div>

      <RolesManager
        roles={roles ?? []}
        permissions={permissions ?? []}
        rolePerms={rolePerms ?? []}
      />
    </div>
  );
}
