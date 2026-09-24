import Link from "next/link";
import { getCurrentUserSubscription } from "@/lib/subscriptions";

function getTrialStatusText(access: Awaited<ReturnType<typeof getCurrentUserSubscription>>["access"]) {
  if (access.accessUntil) {
    return access.hasAccess
      ? `החידוש בוטל. הגישה למערכת זמינה עד ${new Intl.DateTimeFormat("he-IL", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jerusalem" }).format(new Date(access.accessUntil))}`
      : "תקופת הגישה ששולמה הסתיימה";
  }
  if (access.isActive) {
    return "המנוי שלך פעיל";
  }

  if (access.isTrial && access.daysRemaining > 1) {
    return `נשארו לך ${access.daysRemaining} ימים לניסיון`;
  }

  if (access.isTrial && access.daysRemaining === 1) {
    return "נשאר לך יום אחד לניסיון";
  }

  return "הניסיון הסתיים — אפשר לשדרג את המנוי כדי להמשיך להשתמש במערכת";
}

export async function TrialStatusCard() {
  const { access } = await getCurrentUserSubscription();
  const needsUpgrade = !access.hasAccess;

  return (
    <section className="panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <p className="text-sm font-bold leading-7 text-white">{getTrialStatusText(access)}</p>
      {needsUpgrade ? (
        <Link className="button-primary w-full sm:w-auto" href="/upgrade">
          לשדרוג המנוי
        </Link>
      ) : null}
    </section>
  );
}
