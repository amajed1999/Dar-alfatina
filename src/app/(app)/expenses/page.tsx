import { requireSession, assertPermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import ExpensesClient, { type ExpenseRow } from "@/components/expenses/ExpensesClient";

export default async function ExpensesPage() {
  const ctx = await requireSession();
  assertPermission(ctx, PERMISSIONS.expenses.view);

  const supabase = await createClient();
  const [{ data: expenses }, { data: categories }] = await Promise.all([
    supabase
      .from("expenses")
      .select(
        "id, expense_number, category_id, amount, expense_date, description, payment_method, notes, expense_categories(name)",
      )
      .is("deleted_at", null)
      .order("expense_date", { ascending: false })
      .limit(300),
    supabase.from("expense_categories").select("id, name").eq("is_active", true).order("name"),
  ]);

  const rows: ExpenseRow[] = (expenses ?? []).map((e) => ({
    id: e.id,
    expense_number: e.expense_number,
    category_id: e.category_id,
    category_name: (e.expense_categories as { name: string } | null)?.name ?? null,
    amount: e.amount,
    expense_date: e.expense_date,
    description: e.description,
    payment_method: e.payment_method,
    notes: e.notes,
  }));

  return (
    <ExpensesClient
      expenses={rows}
      categories={categories ?? []}
      canCreate={ctx.permissions.has(PERMISSIONS.expenses.create)}
    />
  );
}
