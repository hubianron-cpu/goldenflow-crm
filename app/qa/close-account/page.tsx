import { notFound } from "next/navigation";
import { isClosureQaRuntime, isClosureQaUser } from "@/lib/account-closure/qa-guard.mjs";
import { createServerClient } from "@/lib/supabase/server";

export default async function ClosureQaPage() {
  if (!isClosureQaRuntime(process.env)) notFound();
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !isClosureQaUser(data.user)) notFound();
  const email = data.user!.email!;

  return (
    <main className="mx-auto max-w-xl space-y-5 p-8" dir="rtl">
      <h1 className="text-2xl font-bold">בדיקת סגירת חשבון QA ב־Staging</h1>
      <p>פעולה זו מבטלת תחילה את הרשאת Google Calendar של החשבון הזה, ורק לאחר מכן מוחקת לצמיתות את חשבון ה־CRM הסינתטי.</p>
      <p className="font-mono" dir="ltr">{email}</p>
      <form action="/api/qa/close-account" method="post" className="space-y-4">
        <label className="block">להמשך, יש להקליד את כתובת החשבון בדיוק:
          <input name="confirmation" type="email" required autoComplete="off" className="field mt-2" dir="ltr" />
        </label>
        <button type="submit" className="button-primary">בטל הרשאת Google ומחק חשבון QA</button>
      </form>
    </main>
  );
}
