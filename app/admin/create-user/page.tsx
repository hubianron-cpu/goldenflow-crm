import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { AdminCreateUserForm } from "@/components/admin/create-user-form";
import { isAdminEmail } from "@/lib/admin";
import { hasSupabaseEnv } from "@/lib/env";
import { createServerClient } from "@/lib/supabase/server";

export default async function AdminCreateUserPage() {
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

  if (!isAdminEmail(user.email)) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-8">
        <section className="panel w-full p-6 text-center sm:p-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-danger/25 bg-danger/10 text-red-100">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h1 className="mt-5 text-2xl font-black text-white">אין הרשאה</h1>
          <p className="mt-3 text-sm leading-7 text-zinc-400">רק מנהל מורשה יכול ליצור חשבונות חדשים למערכת.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl items-center px-4 py-8">
      <section className="panel w-full p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-gold/25 bg-gold/10 text-gold-soft">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-gold-soft">Admin</p>
            <h1 className="text-2xl font-black text-white">יצירת חשבון לקוח</h1>
          </div>
        </div>

        <p className="mt-4 text-sm leading-7 text-zinc-400">
          פתיחת משתמש חדש ללקוח ששילם וקיבל גישה למערכת.
        </p>

        <div className="mt-7">
          <AdminCreateUserForm />
        </div>
        <Link className="mt-6 inline-block text-sm font-bold text-gold-soft underline" href="/admin/subscriptions/record-cancellation">
          תיעוד ביטול חידוש לאחר אימות ב־Grow
        </Link>
      </section>
    </main>
  );
}
