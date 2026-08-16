import { requireSession, assertPermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import SettingsForm from "@/components/SettingsForm";

export default async function SettingsPage() {
  const ctx = await requireSession();
  assertPermission(ctx, PERMISSIONS.admin.settingsManage);

  const supabase = await createClient();
  const { data } = await supabase
    .from("settings")
    .select("key, value, description");

  const map: Record<string, { value: unknown; description: string | null }> =
    {};
  for (const row of data ?? []) {
    map[row.key] = { value: row.value, description: row.description };
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">إعدادات النظام</h1>
        <p className="text-muted mt-1 text-sm">
          إعدادات ديناميكية تُقرأ من قاعدة البيانات — لا قيم ثابتة في الكود.
        </p>
      </div>
      <SettingsForm settings={map} />
    </div>
  );
}
