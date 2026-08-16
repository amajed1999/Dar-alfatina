# شركة دار الفاتنة — نظام إدارة المبيعات والمخزون

نظام ويب مؤسسي لإدارة شركة تجارة وتوزيع بالجملة (بيع نقد/آجل، تحصيلات، مخزون، تقارير).
مبني بمعمارية قائمة على الأدوار والصلاحيات، مع حماية على مستوى قاعدة البيانات (RLS).

## التقنيات

- **Next.js 16 (App Router) + TypeScript**
- **Supabase** (PostgreSQL + Auth + RLS)
- **Tailwind CSS v4** مع دعم RTL كامل وخط Cairo
- المصادقة بالبريد وكلمة المرور

## الإعداد المحلي

```bash
npm install
# انسخ .env.example إلى .env.local واملأ قيم Supabase
npm run dev
```

المتغيرات في `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## أول تشغيل (تهيئة المدير)

1. افتح `/signup` وأنشئ حساباً — **أول حساب يُنشأ يصبح «مدير النظام» تلقائياً ومفعّلاً** (عبر تريغر قاعدة البيانات).
2. الحسابات التالية تصل **غير مفعّلة وبلا دور**، ويفعّلها المدير من صفحة «المستخدمون».

> إذا كان تأكيد البريد مفعّلاً في إعدادات Supabase Auth، ستحتاج فتح رابط التأكيد قبل الدخول. لتعطيله: لوحة Supabase → Authentication → Providers → Email → Confirm email = Off.

## البنية

```
src/
  app/
    login/            صفحة تسجيل الدخول
    signup/           إنشاء حساب المدير الأول
    (app)/            المسارات المحمية (تتطلب جلسة مفعّلة)
      layout.tsx      يتحقق من الجلسة + التفعيل، ويعرض الشريط الجانبي
      dashboard/      لوحة المعلومات
      users/          إدارة المستخدمين (صلاحية users.manage)
      roles/          إدارة الأدوار والصلاحيات (roles.manage)
      settings/       إعدادات النظام (settings.manage)
    layout.tsx        RTL + خط عربي
  components/          مكوّنات الواجهة (Sidebar, Tables, Forms)
  lib/
    supabase/         عملاء Supabase (متصفح/خادم/middleware)
    auth.ts           جلب الجلسة والدور والصلاحيات + حرّاس الحماية
    permissions.ts    كتالوج مفاتيح الصلاحيات (يطابق قاعدة البيانات)
    navigation.ts     خريطة القائمة الجانبية حسب الصلاحيات
    database.types.ts  أنواع مولّدة من قاعدة البيانات
  middleware.ts       تحديث الجلسة وحماية المسارات
```

## نظام الصلاحيات (RBAC)

- **الجداول:** `roles`, `permissions`, `role_permissions`, `user_profiles`.
- الصلاحيات كتالوج ثابت (يُدار عبر migrations)، والأدوار وربطها **قابلة للتعديل من الواجهة** (صفحة الأدوار) دون تعديل الكود.
- الحماية الفعلية في قاعدة البيانات عبر **RLS** ودوال مساعدة:
  - `app.is_admin()`، `app.has_permission(key)`، `app.is_active_user()`.
- إخفاء عناصر الواجهة تجميلي فقط؛ لا يُعتمد عليه للحماية.

### الأدوار الأساسية

| الدور | المفتاح |
|---|---|
| مدير النظام | `admin` (كل الصلاحيات) |
| مدير المبيعات | `sales_manager` |
| مندوب مبيعات | `sales_rep` (يرى تجاره فقط) |
| محاسب | `accountant` |
| أمين مخزن | `warehouse_keeper` (بلا أسعار/أرباح) |

## قاعدة البيانات (Migrations)

كل تغييرات القاعدة عبر ملفات migration مرقّمة (مطبّقة على مشروع Supabase):

| # | الاسم | المحتوى |
|---|---|---|
| 01 | `foundation` | schema `app`، دوال مشتركة، `settings`، `audit_log` + دالة التدقيق |
| 02 | `rbac_core` | الأدوار/الصلاحيات/المستخدمون + دوال RLS + تريغر إنشاء الملف التلقائي |
| 03 | `rbac_rls_policies` | سياسات RLS + حرّاس منع تصعيد الصلاحيات وحذف الأدوار النظامية |
| 04 | `seed_rbac_settings` | كتالوج الصلاحيات + الأدوار الخمسة + الربط + الإعدادات |
| 05 | `harden_function_search_path` | تثبيت `search_path` للدوال |
| 06 | `admin_list_users` | دالة آمنة لعرض المستخدمين مع البريد |

## كيفية إضافة وحدة جديدة (مثال: التجار)

1. **قاعدة البيانات:** أنشئ migration جديداً بجداول الوحدة، مع `created_at/updated_at/created_by`، `deleted_at` (حذف منطقي)، وعمود `metadata jsonb`. فعّل RLS واكتب سياسات تستخدم `app.has_permission('merchants.*')`. اربط تريغر `app.audit_trigger()` للتدقيق.
2. **الصلاحيات:** مفاتيح الصلاحيات موجودة مسبقاً في الكتالوج (`merchants.view`, `merchants.create`, ...). أضف أي مفتاح ناقص في migration.
3. **الأنواع:** أعد توليد `database.types.ts` من قاعدة البيانات.
4. **منطق العمل:** ضعه في `src/lib/services/<module>/` (طبقة خدمات معزولة عن الواجهة).
5. **الواجهة:** أضف مجلداً تحت `src/app/(app)/merchants/` مع `page.tsx` و`actions.ts`، وفعّل الرابط في `src/lib/navigation.ts` (أزل `soon: true`).

## مبادئ غير قابلة للتفاوض (مطبّقة في التصميم)

- لا حذف فعلي للسجلات المالية — حذف منطقي عبر `deleted_at`.
- كل تغيير حسّاس يُسجَّل في `audit_log`.
- التحقق من الصلاحيات في الخادم/قاعدة البيانات، لا في الواجهة فقط.
- الإعدادات ديناميكية في جدول `settings` — لا قيم ثابتة في الكود.

## النشر على Vercel

المشروع جاهز للنشر على Vercel (Next.js يُكتشف تلقائياً).

1. ادفع المستودع إلى GitHub/GitLab، أو استخدم `vercel` CLI.
2. في إعدادات مشروع Vercel أضف متغيّري البيئة (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. بعد أول نشر، في لوحة Supabase → **Authentication → URL Configuration**:
   اضبط **Site URL** على دومين Vercel (مثال: `https://dar-alfatina.vercel.app`)
   وأضِفه إلى **Redirect URLs** — ليعمل تأكيد البريد وإعادة التوجيه.

المفتاحان عامّان (client-safe)؛ الحماية الفعلية عبر Row Level Security في قاعدة البيانات.
