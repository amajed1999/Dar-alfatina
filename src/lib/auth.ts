import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SessionContext = {
  userId: string;
  email: string | null;
  fullName: string | null;
  isActive: boolean;
  roleId: string | null;
  roleKey: string | null;
  roleNameAr: string | null;
  permissions: Set<string>;
};

/**
 * يجلب المستخدم الحالي مع دوره وصلاحياته.
 * يعيد null إذا لم يكن مسجّلاً للدخول.
 */
export async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("full_name, is_active, role_id, roles(key, name_ar)")
    .eq("id", user.id)
    .maybeSingle();

  const roleId = profile?.role_id ?? null;
  let permissions = new Set<string>();

  if (roleId) {
    const { data: perms } = await supabase
      .from("role_permissions")
      .select("permissions(key)")
      .eq("role_id", roleId);
    permissions = new Set(
      (perms ?? [])
        .map((p) => (p.permissions as { key: string } | null)?.key)
        .filter((k): k is string => Boolean(k)),
    );
  }

  const role = profile?.roles as { key: string; name_ar: string } | null;

  return {
    userId: user.id,
    email: user.email ?? null,
    fullName: profile?.full_name ?? null,
    isActive: profile?.is_active ?? false,
    roleId,
    roleKey: role?.key ?? null,
    roleNameAr: role?.name_ar ?? null,
    permissions,
  };
}

/**
 * يضمن وجود مستخدم مسجّل ومفعّل. يعيد التوجيه إن لم يكن كذلك.
 * يُستخدم في تخطيط المسارات المحمية.
 */
export async function requireSession(): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  return ctx;
}

/** يتحقق من امتلاك صلاحية معيّنة، ويعيد التوجيه للوحة إن لم تتوفر. */
export function assertPermission(ctx: SessionContext, key: string) {
  if (!ctx.permissions.has(key)) redirect("/dashboard");
}
