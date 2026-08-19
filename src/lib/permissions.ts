/**
 * كتالوج مفاتيح الصلاحيات — يطابق حرفياً جدول public.permissions في قاعدة البيانات.
 * الصلاحيات مصدرها قاعدة البيانات (وهي التي تُطبَّق فعلياً عبر RLS)؛ هذا الملف
 * لتلوين الواجهة فقط. إخفاء زر في الواجهة ليس حمايةً — الحماية في قاعدة البيانات.
 */
export const PERMISSIONS = {
  merchants: {
    view: "merchants.view",
    viewAll: "merchants.view_all",
    create: "merchants.create",
    edit: "merchants.edit",
    delete: "merchants.delete",
    approveCredit: "merchants.approve_credit",
    visit: "merchants.visit",
  },
  products: {
    view: "products.view",
    viewPrices: "products.view_prices",
    create: "products.create",
    edit: "products.edit",
    delete: "products.delete",
  },
  inventory: {
    view: "inventory.view",
    movement: "inventory.movement",
    adjust: "inventory.adjust",
    transfer: "inventory.transfer",
  },
  purchases: {
    view: "purchases.view",
    create: "purchases.create",
    edit: "purchases.edit",
    approve: "purchases.approve",
  },
  sales: {
    view: "sales.view",
    viewAll: "sales.view_all",
    invoiceCreate: "sales.invoice.create",
    invoiceEditPrice: "sales.invoice.edit_price",
    invoiceApprove: "sales.invoice.approve",
    invoiceOversell: "sales.invoice.oversell",
    returnCreate: "sales.return.create",
    discountApprove: "sales.discount.approve",
    targetsView: "targets.view",
    targetsManage: "targets.manage",
    quotationsView: "quotations.view",
    quotationsCreate: "quotations.create",
  },
  orders: {
    view: "orders.view",
    manage: "orders.manage",
  },
  consumption: {
    view: "consumption.view",
    create: "consumption.create",
    approve: "consumption.approve",
  },
  payments: {
    view: "payments.view",
    create: "payments.create",
    custody: "payments.custody",
  },
  expenses: {
    view: "expenses.view",
    create: "expenses.create",
    approve: "expenses.approve",
  },
  tasks: {
    view: "tasks.view",
    viewAll: "tasks.view_all",
    create: "tasks.create",
    assign: "tasks.assign",
    requestCreate: "tasks.request.create",
    requestApprove: "tasks.request.approve",
  },
  reports: {
    sales: "reports.sales",
    collections: "reports.collections",
    aging: "reports.aging",
    inventory: "reports.inventory",
    profit: "reports.profit",
    reps: "reports.reps",
    consumption: "reports.consumption",
  },
  admin: {
    usersManage: "users.manage",
    rolesManage: "roles.manage",
    settingsManage: "settings.manage",
    auditView: "audit.view",
  },
} as const;

export type PermissionKey = string;

/** ترجمة أسماء الوحدات للعرض */
export const MODULE_LABELS: Record<string, string> = {
  merchants: "التجار",
  products: "المنتجات",
  inventory: "المخزون",
  purchases: "المشتريات",
  sales: "المبيعات",
  consumption: "الاستهلاك الداخلي",
  payments: "التحصيلات",
  expenses: "المصاريف",
  tasks: "المهام",
  reports: "التقارير",
  admin: "الإدارة",
};
