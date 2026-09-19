import { redirect } from "next/navigation";
import { ExpenseCenter } from "@/components/expenses/expense-center";
import { expenseContext } from "@/lib/expenses/access";

export default async function ExpensesPage() {
  const context = await expenseContext();
  if (context.error) redirect(context.error.status === 401 ? "/login" : "/upgrade");
  return <ExpenseCenter />;
}
