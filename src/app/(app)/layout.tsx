import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import PendingActivation from "@/components/PendingActivation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireSession();

  // حساب بوابة تاجر -> واجهة التاجر (لا تطبيق الموظفين)
  if (ctx.portalMerchantId) redirect("/portal");

  // مستخدم مسجّل لكنه غير مفعّل أو بلا دور -> شاشة انتظار التفعيل
  if (!ctx.isActive || !ctx.roleId) {
    return <PendingActivation email={ctx.email} />;
  }

  const supabase = await createClient();
  const { count: unread } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        permissions={[...ctx.permissions]}
        fullName={ctx.fullName}
        roleNameAr={ctx.roleNameAr}
        unreadCount={unread ?? 0}
      />
      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto p-6">{children}</div>
      </main>
    </div>
  );
}
