import { redirect } from "next/navigation";
import { RecordCancellationForm } from "@/components/admin/record-cancellation-form";
import { isAdminEmail } from "@/lib/admin";
import { createServerClient } from "@/lib/supabase/server";

export default async function RecordCancellationPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isAdminEmail(user.email)) redirect("/dashboard");

  return (
    <main className="mx-auto max-w-2xl px-4 py-8" dir="rtl">
      <section className="panel p-6 sm:p-8">
        <p className="text-sm font-bold text-gold-soft">ניהול מנויים</p>
        <h1 className="mt-2 text-2xl font-black text-white">תיעוד ביטול חידוש</h1>
        <p className="my-5 text-sm leading-7 text-zinc-300">
          תחילה בטל ואמת את הוראת הקבע בממשק Grow. פעולה זו אינה מבטלת חיוב ב־Grow;
          היא רק משמרת גישה ב־CRM עד סוף התקופה ששולמה.
        </p>
        <RecordCancellationForm />
      </section>
    </main>
  );
}
