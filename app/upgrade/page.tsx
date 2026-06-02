import { LogOut, MessageCircle } from "lucide-react";
import { signOut } from "@/lib/actions";

const whatsappHref = `https://wa.me/972524780853?text=${encodeURIComponent("היי רון, אני רוצה לשדרג את המנוי שלי ל-GoldenFlow")}`;

const benefits = [
  "המשך ניהול לידים ומשימות",
  "גישה למסלול המכירה",
  "מעקב יומי אחרי פעולות וסגירות",
  "מערכת שעוזרת לך לדעת למי לפנות ומתי",
];

export default function UpgradePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-8">
      <section className="panel w-full p-6 text-center sm:p-8">
        <p className="text-sm font-bold text-gold-soft">GoldenFlow</p>
        <h1 className="mt-4 text-3xl font-black leading-tight text-white sm:text-5xl">הניסיון שלך הסתיים</h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-zinc-300">
          כדי להמשיך להשתמש ב-GoldenFlow, אפשר לשדרג את המנוי ולהפעיל את החשבון שלך.
        </p>

        <div className="mx-auto mt-7 grid max-w-2xl gap-3 text-right sm:grid-cols-2">
          {benefits.map((benefit) => (
            <div key={benefit} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-zinc-200">
              {benefit}
            </div>
          ))}
        </div>

        <a className="button-primary mx-auto mt-8 w-full gap-2 sm:w-auto" href={whatsappHref} target="_blank" rel="noreferrer">
          <MessageCircle className="h-4 w-4" />
          לשדרוג דרך וואטסאפ
        </a>

        <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-zinc-400">
          עדיין לא בטוח? שלח לי הודעה ואעזור לך להבין אם המערכת מתאימה לך.
        </p>

        <form action={signOut} className="mx-auto mt-6 max-w-sm border-t border-white/10 pt-5">
          <p className="text-sm text-zinc-400">רוצה להתחבר עם משתמש אחר?</p>
          <button type="submit" className="button-secondary mt-3 w-full gap-2">
            <LogOut className="h-4 w-4" />
            התנתקות
          </button>
        </form>
      </section>
    </main>
  );
}
