import { requireSession, assertPermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import UsersTable from "@/components/UsersTable";

export default async function UsersPage() {
  const ctx = await requireSession();
  assertPermission(ctx, PERMISSIONS.admin.usersManage);

  const supabase = await createClient();
  const [{ data: users }, { data: roles }] = await Promise.all([
    supabase.rpc("admin_list_users"),
    supabase
      .from("roles")
      .select("id, name_ar, key")
      .is("deleted_at", null)
      .order("name_ar"),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">المستخدمون</h1>
        <p className="text-muted mt-1 text-sm">
          تفعيل الحسابات وإسناد الأدوار. الحسابات الجديدة تصل غير مفعّلة وبلا دور.
        </p>
      </div>

      <UsersTable
        currentUserId={ctx.userId}
        users={users ?? []}
        roles={roles ?? []}
      />
    </div>
  );
}
