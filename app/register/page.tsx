import Link from "next/link";
import { RegisterForm } from "@/components/register/register-form";
import { hasSupabaseEnv } from "@/lib/env";

export default function RegisterPage() {
  const supabaseReady = hasSupabaseEnv();

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl items-center px-4 py-8">
      <div className="grid w-full gap-6 lg:grid-cols-[1fr_460px]">
        <section className="overflow-hidden rounded-[28px] border border-gold/20 bg-[radial-gradient(circle_at_top_right,rgba(201,162,39,0.20),rgba(8,8,8,0.96)_52%)] p-8 text-white shadow-gold lg:p-10">
          <p className="text-sm font-bold text-gold-soft">GoldenFlow</p>
          <h1 className="mt-5 max-w-2xl text-4xl font-black leading-tight lg:text-6xl">
            פתח חשבון ניסיון ל־14 יום והתחל לעבוד מסודר יותר.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-300">
            GoldenFlow עוזרת לך לנהל לידים, משימות, מסלול מכירה ופולואפים במקום אחד.
          </p>

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {[
              ["14 יום", "ניסיון מלא למערכת"],
              ["לידים ומשימות", "סדר יומי ברור"],
              ["סגירות", "פחות ניחושים, יותר פעולות"],
            ].map(([title, description]) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="font-bold text-gold-soft">{title}</p>
                <p className="mt-2 text-sm leading-6 text-zinc-300">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="panel p-6 lg:p-8">
          <h2 className="text-2xl font-black">פתיחת חשבון ניסיון</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            מלא את הפרטים ותקבל גישה ל־14 יום.
          </p>

          {!supabaseReady ? (
            <div className="mt-5 rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm leading-6 text-red-100">
              חסרים משתני Supabase להפעלת הרשמה.
            </div>
          ) : (
            <div className="mt-5">
              <RegisterForm />
            </div>
          )}

          <div className="mt-6 border-t border-white/10 pt-5 text-center">
            <Link className="text-sm font-bold text-gold-soft hover:text-gold" href="/login">
              חזרה להתחברות
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
