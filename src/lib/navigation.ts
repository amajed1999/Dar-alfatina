import { PERMISSIONS } from "@/lib/permissions";

export type NavItem = {
  href: string;
  label: string;
  /** الصلاحية المطلوبة لإظهار العنصر (null = للجميع) */
  permission: string | null;
  /** غير منفّذ بعد (يظهر معطّلاً كـ"قريباً") */
  soon?: boolean;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

/**
 * خريطة التنقّل. العناصر المنفّذة في المرحلة الحالية بلا soon.
 * البقية تظهر معطّلة للدلالة على خارطة الطريق.
 */
export const NAV: NavSection[] = [
  {
    title: "الرئيسية",
    items: [{ href: "/dashboard", label: "لوحة المعلومات", permission: null }],
  },
  {
    title: "المخزون والمشتريات",
    items: [
      { href: "/products", label: "المنتجات", permission: PERMISSIONS.products.view },
      { href: "/inventory", label: "المخزون والحركات", permission: PERMISSIONS.inventory.view },
      { href: "/purchases", label: "المشتريات", permission: PERMISSIONS.purchases.view },
      { href: "/suppliers", label: "الموردون", permission: PERMISSIONS.purchases.view },
      { href: "/consumption", label: "الاستهلاك الداخلي", permission: PERMISSIONS.consumption.view },
    ],
  },
  {
    title: "العمليات",
    items: [
      { href: "/merchants", label: "التجار", permission: PERMISSIONS.merchants.view },
      { href: "/visits", label: "زيارات المندوبين", permission: PERMISSIONS.merchants.view },
      { href: "/orders", label: "طلبات التجار", permission: PERMISSIONS.orders.view },
      { href: "/quotations", label: "عروض الأسعار", permission: PERMISSIONS.sales.quotationsView },
      { href: "/sales", label: "فواتير البيع", permission: PERMISSIONS.sales.view },
      { href: "/payments", label: "التحصيلات", permission: PERMISSIONS.payments.view },
      { href: "/expenses", label: "المصاريف", permission: PERMISSIONS.expenses.view },
      { href: "/targets", label: "أهداف المندوبين", permission: PERMISSIONS.sales.targetsView },
      { href: "/tasks", label: "المهام", permission: PERMISSIONS.tasks.view },
    ],
  },
  {
    title: "التقارير",
    items: [
      { href: "/reports/sales", label: "المبيعات", permission: PERMISSIONS.reports.sales },
      { href: "/reports/aging", label: "أعمار الذمم", permission: PERMISSIONS.reports.aging },
      { href: "/reports/inventory", label: "المخزون وقيمته", permission: PERMISSIONS.reports.inventory },
      { href: "/reports/reorder", label: "اقتراحات إعادة الطلب", permission: PERMISSIONS.inventory.view },
      { href: "/reports/item-movement", label: "حركة صنف", permission: PERMISSIONS.reports.inventory },
      { href: "/reports/profit", label: "الأرباح والخسائر", permission: PERMISSIONS.reports.profit },
      { href: "/reports/reps", label: "أداء المندوبين", permission: PERMISSIONS.reports.reps },
    ],
  },
  {
    title: "الإدارة",
    items: [
      { href: "/users", label: "المستخدمون", permission: PERMISSIONS.admin.usersManage },
      { href: "/roles", label: "الأدوار والصلاحيات", permission: PERMISSIONS.admin.rolesManage },
      { href: "/settings", label: "الإعدادات", permission: PERMISSIONS.admin.settingsManage },
      { href: "/audit", label: "سجل التدقيق", permission: PERMISSIONS.admin.auditView },
    ],
  },
];
