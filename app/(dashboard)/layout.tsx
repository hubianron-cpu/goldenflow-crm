import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { hasSupabaseEnv } from "@/lib/env";
import { NEW_LEAD_STATUS_VALUES } from "@/lib/leads";
import { createServerClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!hasSupabaseEnv()) {
    redirect("/login");
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ count: leadsCount }, { count: tasksCount }] = await Promise.all([
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .in("status", NEW_LEAD_STATUS_VALUES),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .or(`user_id.eq.${user.id},assigned_to.eq.${user.id}`)
      .is("deleted_at", null),
  ]);

  return (
    <AppShell badges={{ leads: leadsCount ?? 0, tasks: tasksCount ?? 0 }} userEmail={user.email ?? "מאמן"}>
      {children}
    </AppShell>
  );
}
