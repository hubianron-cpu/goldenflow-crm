import { BadgeDollarSign, Crown, LogOut } from "lucide-react";
import { NavigationLinks } from "@/components/nav-link";
import { signOut } from "@/lib/actions";

export function AppShell({
  badges,
  children,
  userEmail,
}: {
  badges?: {
    leads?: number;
    tasks?: number;
  };
  children: React.ReactNode;
  userEmail: string;
}) {
  return (
    <div className="relative min-h-screen max-w-full overflow-x-clip px-3 py-4 sm:px-5 lg:px-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_85%_0%,rgba(201,162,39,0.16),transparent_34rem)]" />
      <div className="relative mx-auto grid w-full max-w-[1440px] min-w-0 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="relative h-fit w-full max-w-full overflow-hidden rounded-[28px] border border-gold/15 bg-black/55 p-5 shadow-[0_28px_90px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl lg:sticky lg:top-6 lg:min-h-[calc(100vh-3rem)]">
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-gold/55 to-transparent" />
          <div className="pointer-events-none absolute -right-12 top-8 h-40 w-40 rounded-full bg-gold/10 blur-3xl" />

          <div className="relative mb-6 overflow-visible rounded-[24px] border border-gold/25 bg-[radial-gradient(circle_at_top_right,rgba(201,162,39,0.28),rgba(12,10,5,0.95)_52%,rgba(4,4,4,0.98))] p-4 text-white shadow-[0_22px_60px_rgba(0,0,0,0.32),0_0_38px_rgba(201,162,39,0.14)]">
            <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" />
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gold text-black shadow-[0_0_28px_rgba(201,162,39,0.34)]">
                <BadgeDollarSign className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1 overflow-visible">
                <div className="flex items-start gap-2">
                  <p className="whitespace-normal break-words text-[13px] font-black leading-5 tracking-tight text-white [overflow:visible] [text-overflow:unset] sm:text-sm">
                    מרכז השליטה של העסק שלך
                  </p>
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gold/25 bg-black/30 text-gold-soft">
                    <Crown className="h-3.5 w-3.5" />
                  </span>
                </div>
                <p className="mt-1 break-all text-xs leading-5 text-zinc-400">{userEmail}</p>
                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-gold/20 bg-black/30 px-3 py-1 text-[11px] font-semibold text-gold-soft">
                  <span className="h-2 w-2 rounded-full bg-gold shadow-[0_0_12px_rgba(201,162,39,0.65)]" />
                  מחובר
                </div>
              </div>
            </div>
          </div>

          <div className="relative border-y border-white/[0.06] py-4">
            <NavigationLinks badges={{ "/leads": badges?.leads ?? 0, "/tasks": badges?.tasks ?? 0 }} />
          </div>

          <form action={signOut} className="relative mt-6">
            <button type="submit" className="button-danger w-full gap-2 bg-danger/5 font-semibold hover:bg-danger/10">
              <LogOut className="h-4 w-4 text-red-200 transition group-hover:text-red-100" />
              התנתקות
            </button>
          </form>
        </aside>

        <main className="mx-auto w-full max-w-[1180px] min-w-0 pb-24 lg:pb-8">{children}</main>
      </div>
    </div>
  );
}
