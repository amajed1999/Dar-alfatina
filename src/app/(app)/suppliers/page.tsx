import { requireSession, assertPermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import SuppliersClient from "@/components/suppliers/SuppliersClient";

export default async function SuppliersPage() {
  const ctx = await requireSession();
  assertPermission(ctx, PERMISSIONS.purchases.view);

  const supabase = await createClient();
  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, name, phone, address, notes, is_active")
    .is("deleted_at", null)
    .order("name");

  return (
    <SuppliersClient
      suppliers={suppliers ?? []}
      canManage={ctx.permissions.has(PERMISSIONS.purchases.create)}
    />
  );
}
