import Link from "next/link";
import { CheckCircle2, MessageCircle } from "lucide-react";

const supportHref =
  "https://wa.me/972524780853?text=%D7%A8%D7%9B%D7%A9%D7%AA%D7%99%20%D7%9E%D7%A0%D7%95%D7%99%20%D7%9C-GoldenFlow%20CRM%20%D7%95%D7%90%D7%A0%D7%99%20%D7%A6%D7%A8%D7%99%D7%9A%20%D7%A2%D7%96%D7%A8%D7%94%20%D7%91%D7%94%D7%AA%D7%97%D7%91%D7%A8%D7%95%D7%AA";

export default function PaymentSuccessPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-8" dir="rtl">
      <section className="panel w-full p-6 text-center sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-gold/30 bg-gold/10 text-gold-soft shadow-gold">
          <CheckCircle2 className="h-7 w-7" />
        </div>

        <p className="mt-5 text-sm font-bold text-gold-soft">GoldenFlow CRM</p>
        <h1 className="mt-4 text-3xl font-black leading-tight text-white sm:text-5xl">התשלום התקבל בהצלחה 🎉</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg font-semibold leading-8 text-zinc-200">
          המנוי שלך ל־GoldenFlow CRM מופעל עכשיו.
        </p>

        <div className="mx-auto mt-6 max-w-2xl space-y-2 text-sm leading-7 text-zinc-300">
          <p>הפעלת המנוי מתבצעת אוטומטית ועשויה לקחת עד דקה.</p>
          <p>אם כבר יש לך משתמש, אפשר להיכנס למערכת.</p>
          <p>אם עדיין לא פתחת משתמש, אפשר לפתוח משתמש או לפנות אלינו ונעזור לך להתחיל.</p>
        </div>

        <div className="mx-auto mt-8 grid max-w-md gap-3 sm:grid-cols-2">
          <Link className="button-primary w-full" href="/login">
            כניסה למערכת
          </Link>
          <Link className="button-secondary w-full" href="/register">
            פתיחת משתמש
          </Link>
        </div>

        <a
          className="button-secondary mx-auto mt-3 w-full max-w-md gap-2"
          href={supportHref}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MessageCircle className="h-4 w-4" />
          צריך עזרה?
        </a>

        <p className="mx-auto mt-5 max-w-xl rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-7 text-zinc-400">
          אם המנוי עדיין לא מופיע כפעיל, המתינו דקה ורעננו את המערכת.
        </p>
      </section>
    </main>
  );
}
