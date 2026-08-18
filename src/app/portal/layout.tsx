import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionContext } from "@/lib/auth";
import PortalSignOut from "@/components/portal/PortalSignOut";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  if (!ctx.portalMerchantId) redirect("/dashboard");

  return (
    <div className="min-h-screen">
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-bold text-primary leading-tight">شركة دار الفاتنة</h1>
            <p className="text-xs text-muted">بوابة التاجر</p>
          </div>
          <div className="flex items-center gap-2">
            <nav className="flex gap-1 text-sm flex-wrap">
              <Link href="/portal" className="px-3 py-1.5 rounded-lg hover:bg-background transition">الرئيسية</Link>
              <Link href="/portal/products" className="px-3 py-1.5 rounded-lg hover:bg-background transition">اطلب بضاعة</Link>
              <Link href="/portal/orders" className="px-3 py-1.5 rounded-lg hover:bg-background transition">طلباتي</Link>
              <Link href="/portal/invoices" className="px-3 py-1.5 rounded-lg hover:bg-background transition">فواتيري</Link>
              <Link href="/portal/statement" className="px-3 py-1.5 rounded-lg hover:bg-background transition">كشف الحساب</Link>
            </nav>
            <PortalSignOut />
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto p-4">{children}</main>
    </div>
  );
}
