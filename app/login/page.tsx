import Link from "next/link";
import { AlertTriangle, LogIn } from "lucide-react";
import { StatusMessage } from "@/components/status-message";
import { ThemeToggle } from "@/components/theme-toggle";
import { hasSupabaseEnv } from "@/lib/env";
import { signIn } from "@/lib/actions";

const paymentHref = "https://meshulam.co.il/s/e89b2737-e347-bbf1-34ce-ca6ba2b0fb94";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const supabaseReady = hasSupabaseEnv();
  const visibleError = params.error === "fetch failed" ? undefined : params.error;

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl items-center px-4 py-8">
      <div className="grid w-full gap-6 lg:grid-cols-[1fr_420px]">
        <section className="overflow-hidden rounded-[28px] border border-gold/20 bg-[radial-gradient(circle_at_top_right,rgba(201,162,39,0.20),rgba(8,8,8,0.96)_52%)] p-8 text-white shadow-gold lg:p-10">
          <p className="text-sm font-bold text-gold-soft">מרכז השליטה של העסק שלך</p>
          <h1 className="mt-5 max-w-2xl text-4xl font-black leading-tight lg:text-6xl">
            מערכת CRM שעוזרת לך לסגור יותר עסקאות בכל יום.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-300">
            לידים, המשימות שלי, מסלול המכירה ומערכת סגירה יומית במקום אחד. פחות ניחושים, יותר פעולות שמביאות כסף.
          </p>

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {[
              ["Daily Closing", "מי צריך פעולה עכשיו"],
              ["Pipeline", "איפה נמצא הכסף"],
              ["Follow-up", "מה חוזר לטיפול היום"],
            ].map(([title, description]) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="font-bold text-gold-soft">{title}</p>
                <p className="mt-2 text-sm leading-6 text-zinc-300">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="panel p-6 lg:p-8">
          <div className="mb-4 flex justify-end">
            <ThemeToggle />
          </div>
          <h2 className="text-center text-2xl font-black">כניסה למערכת</h2>
          <p className="mt-2 text-center text-sm text-zinc-400">התחברו כדי לנהל לידים, המשימות שלי ומסלול המכירה.</p>

          <div className="mt-5">
            <StatusMessage error={visibleError} success={params.success} />
          </div>

          {!supabaseReady ? (
            <div className="mb-5 flex gap-3 rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm leading-6 text-red-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>חסרים משתני Supabase בקובץ .env.local להפעלת התחברות ושמירת נתונים.</p>
            </div>
          ) : null}

          <form action={signIn} className="space-y-4">
            <label className="block text-sm font-semibold text-zinc-200">
              <span className="block text-center">מייל</span>
              <input name="email" type="email" className="field mt-2" required disabled={!supabaseReady} />
            </label>
            <label className="block text-sm font-semibold text-zinc-200">
              <span className="block text-center">סיסמה</span>
              <input name="password" type="password" className="field mt-2" minLength={6} required disabled={!supabaseReady} />
            </label>
            <button type="submit" className="button-primary w-full gap-2" disabled={!supabaseReady}>
              <LogIn className="h-4 w-4" />
              התחברות
            </button>
          </form>

          <div className="my-6 h-px bg-white/10" />

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
            <p className="text-sm text-zinc-300">עדיין אין לך חשבון?</p>
            <Link href="/register" className="button-secondary mt-3 w-full">
              פתח חשבון ניסיון ל־14 יום
            </Link>
            <a href={paymentHref} className="button-secondary mt-3 w-full" target="_blank" rel="noopener noreferrer">
              לרכישת מנוי בצורה מאובטחת
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
