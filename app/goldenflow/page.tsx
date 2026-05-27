import type { Metadata } from "next";
import {
  ArrowLeft,
  BadgeCheck,
  BellRing,
  CalendarCheck,
  Check,
  CheckCircle2,
  ClipboardList,
  Columns3,
  FileText,
  Flame,
  Flag,
  Gauge,
  HandCoins,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  WalletCards,
  X,
} from "lucide-react";

const whatsappUrl =
  "https://wa.me/972524780853?text=%D7%94%D7%99%D7%99%20%D7%A8%D7%95%D7%9F,%20%D7%90%D7%A0%D7%99%20%D7%A8%D7%95%D7%A6%D7%94%20%D7%9C%D7%A4%D7%AA%D7%95%D7%97%20%D7%9E%D7%A0%D7%95%D7%99%20%D7%9C-GoldenFlow%20CRM";

export const metadata: Metadata = {
  title: "GoldenFlow CRM | מערכת CRM פשוטה לבעלי עסקים",
  description:
    "מערכת לניהול לידים, משימות, פולואפים ושלבי מכירה במקום אחד - עם מיקוד יומי לפעולה הבאה.",
};

const audienceCards = [
  {
    title: "מאמנים אישיים",
    text: "ניהול מתעניינים מאינסטגרם, וואטסאפ, שיחות היכרות ותהליכי ליווי.",
  },
  {
    title: "יועצים עסקיים",
    text: "מעקב אחרי שיחות אבחון, הצעות מחיר, פולואפים ולידים חמים.",
  },
  {
    title: "מטפלים",
    text: "ניהול פניות, שיחות היכרות וחזרה למתעניינים בזמן.",
  },
  {
    title: "נותני שירות",
    text: "כל פנייה, משימה ופולואפ במקום אחד ברור.",
  },
  {
    title: "עסקים שמקבלים לידים מאינסטגרם, פייסבוק או וואטסאפ",
    text: "סדר ברור לכל מי שפנה, שאל, התעניין או ביקש פרטים.",
  },
  {
    title: "עסקים קטנים שרוצים CRM פשוט",
    text: "מערכת קלה לניהול יומיומי בלי עומס טכני.",
  },
];

const painCards = [
  "ליד כתב לך - ולא חזרת בזמן",
  "מתעניין ביקש פרטים, אבל לא היה תהליך להחזיר אותו לשיחה",
  "פולואפ אחרי שיחת מכירה נשכח",
  "לא ברור מי חם ומי תקוע",
  "אין תמונה ברורה של הכסף שנמצא בתהליך המכירה",
  "הכול מפוזר בין וואטסאפ, פתקים והראש",
];

const beforeItems = [
  "לידים מפוזרים בוואטסאפ",
  "פולואפים בלי סדר",
  "משימות נשכחות",
  "קשה לדעת למי לחזור קודם",
  "אין תמונה ברורה של תהליך המכירה",
  "הרבה עומס בראש",
];

const afterItems = [
  "כל ליד נמצא במקום אחד",
  "ברור מה צריך לקדם היום",
  "כל משימה מקבלת מקום",
  "רואים את תהליך המכירה",
  "מזהים את הליד הכי חם",
  "עובדים עם יותר שקט ושליטה",
];

const solutionItems = [
  "מי דורש פעולה היום",
  "למי כדאי להתקשר קודם",
  "מי מחכה לפולואפ",
  "מי תקוע יותר מדי זמן",
  "כמה כסף פוטנציאלי נמצא בתהליך המכירה",
  "איפה נמצאת ההזדמנות החמה להיום",
];

const features = [
  {
    icon: Users,
    title: "ניהול לידים",
    text: "שמירה של כל ליד עם שם, טלפון, סטטוס, שווי פוטנציאלי והערות.",
  },
  {
    icon: Columns3,
    title: "שלבי מכירה ברורים",
    text: "לראות מי חדש, מי לא ענה, מי קבע שיחה, מי קיבל הצעה ומי קרוב לסגירה.",
  },
  {
    icon: ClipboardList,
    title: "ניהול משימות",
    text: "משימות יומיות לחזרה ללידים, שליחת הודעות וביצוע פולואפים.",
  },
  {
    icon: HandCoins,
    title: "תצוגת כסף בתהליך המכירה",
    text: "מבט מהיר על שווי הלידים והעסקאות לפי שלבי המכירה.",
  },
  {
    icon: Target,
    title: "Daily Closing Mode",
    text: "מצב עבודה יומי שמרכז למי להתקשר, למי לשלוח הודעה, מי צריך פולואפ ואיזה ליד יכול לקדם אותך ליעד היומי.",
  },
  {
    icon: Flag,
    title: "יעד יומי ומיקוד לפעולה",
    text: "להבין בכל יום למי כדאי לפנות קודם, במקום לבזבז זמן על ניחושים.",
  },
  {
    icon: FileText,
    title: "תיעוד והערות לכל ליד",
    text: "לדעת מה דיברתם, מה הובטח ומה הצעד הבא.",
  },
  {
    icon: Gauge,
    title: "מערכת פשוטה וקלה",
    text: "בלי CRM כבד, בלי הדרכות אינסופיות ובלי להסתבך.",
  },
];

const previewCards = [
  {
    title: "ניהול לידים",
    icon: Users,
    rows: ["שם ליד: דניאל כהן", "סטטוס: נקבעה שיחה", "שווי פוטנציאלי: ₪4,500", "הערה: ביקש פרטים על ליווי", "פעולה הבאה: פולואפ היום"],
  },
  {
    title: "משימות להיום",
    icon: CalendarCheck,
    rows: ["לחזור לליד חם", "לשלוח הצעת מחיר", "לבצע פולואפ", "לבדוק שיחה שלא נענתה"],
  },
  {
    title: "תהליך מכירה",
    icon: WalletCards,
    rows: ["ליד חדש", "נקבעה שיחה", "ניתנה הצעת מחיר", "קרוב לסגירה"],
  },
];

const workflowSteps = [
  "ליד חדש",
  "צריך חזרה",
  "שיחה נקבעה",
  "הצעה נשלחה",
  "קרוב לסגירה",
];

const clarityItems = [
  { type: "no", text: "GoldenFlow CRM לא מביאה לידים חדשים." },
  { type: "no", text: "GoldenFlow CRM לא מחליפה אותך בשיחות מכירה." },
  { type: "no", text: "GoldenFlow CRM לא מחוברת כרגע אוטומטית לפייסבוק או וואטסאפ." },
  { type: "yes", text: "GoldenFlow CRM כן עוזרת לנהל טוב יותר את הלידים שכבר נכנסים." },
  { type: "yes", text: "GoldenFlow CRM כן עוזרת לתעדף פולואפים, משימות ושלבי מכירה." },
  { type: "yes", text: "GoldenFlow CRM כן נותנת תמונת מצב ברורה יותר על המכירות." },
];

const includedItems = [
  "גישה מלאה למערכת",
  "ניהול לידים",
  "ניהול משימות",
  "שלבי מכירה",
  "תצוגת כסף בתהליך המכירה",
  "Daily Closing Mode",
  "מיקוד יומי לפעולה",
  "תמיכה בסיסית בוואטסאפ",
];

const steps = [
  {
    title: "שולחים הודעה בוואטסאפ",
    text: "כותבים שרוצים להצטרף ל-GoldenFlow CRM.",
  },
  {
    title: "פותחים לך משתמש",
    text: "מקבלים גישה אישית למערכת.",
  },
  {
    title: "מכניסים את הלידים הראשונים",
    text: "אפשר להתחיל לעבוד כבר מהיום הראשון.",
  },
  {
    title: "מתחילים לעבוד מסודר",
    text: "כל ליד, משימה ופולואפ נמצאים במקום אחד.",
  },
];

const faqs = [
  {
    question: "האם צריך ידע טכני כדי להשתמש במערכת?",
    answer:
      "לא. המערכת נבנתה כדי להיות פשוטה וברורה גם למי שלא אוהב מערכות מורכבות.",
  },
  {
    question: "למי המערכת הכי מתאימה?",
    answer:
      "למאמנים, יועצים, מטפלים ונותני שירות שמקבלים לידים ורוצים לנהל אותם בצורה מסודרת.",
  },
  {
    question: "האם זה מחליף אקסל?",
    answer:
      "כן. במקום לנהל לידים באקסל, פתקים או וואטסאפ בלבד, המערכת מרכזת את תהליך המכירה במקום אחד.",
  },
  {
    question: "האם אפשר לבטל?",
    answer:
      "כן. אין התחייבות ארוכה. המטרה היא להמשיך רק אם המערכת עושה סדר אמיתי בעסק.",
  },
  {
    question: "האם יש חיבור אוטומטי לפייסבוק או וואטסאפ?",
    answer:
      "בשלב הזה המערכת מתמקדת בניהול ידני, פשוט וברור של לידים ומשימות. חיבורים ואוטומציות יכולים להתווסף בהמשך.",
  },
  {
    question: "האם GoldenFlow מביאה לי לידים?",
    answer:
      "לא. המערכת לא מביאה לידים חדשים. היא עוזרת לנהל טוב יותר את הלידים שכבר נכנסים, לבצע פולואפים בזמן ולצמצם פספוסים.",
  },
  {
    question: "האם המחיר יעלה בעתיד?",
    answer:
      "כן. המחיר צפוי לעלות אחרי תקופת ההשקה. מי שמצטרף במחיר ההשקה שומר את המחיר כל עוד המנוי נשאר פעיל.",
  },
  {
    question: "האם אפשר להשתמש בזה גם אם יש מעט לידים?",
    answer:
      "כן. דווקא כשיש מעט לידים, חשוב לנהל כל ליד בצורה מסודרת ולא לפספס הזדמנויות.",
  },
];

function CtaButton({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-6 py-3 text-sm font-black text-black shadow-[0_18px_50px_rgba(212,175,55,0.26)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#B8942E] hover:shadow-[0_22px_60px_rgba(212,175,55,0.34)] active:scale-[0.98] ${className}`}
    >
      <MessageCircle className="h-5 w-5" />
      {children}
    </a>
  );
}

function SectionTitle({
  eyebrow,
  title,
  text,
}: {
  eyebrow?: string;
  title: string;
  text?: string;
}) {
  return (
    <div className="mx-auto mb-10 max-w-3xl text-right">
      {eyebrow ? (
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-[#D4AF37]">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-[1.7rem] font-black leading-tight text-white sm:text-4xl">{title}</h2>
      {text ? <p className="mt-4 text-base leading-8 text-[#B8B8B8] sm:text-lg">{text}</p> : null}
    </div>
  );
}

function HighlightBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-[#D4AF37]/25 bg-gradient-to-l from-[#D4AF37]/15 to-white/[0.03] p-5 text-right sm:p-6">
      <p className="text-lg font-black leading-8 text-white sm:text-2xl sm:leading-9">{children}</p>
    </div>
  );
}

function DashboardPreview() {
  const statCards = [
    { label: "למי להתקשר היום", value: "4", badge: "עדיפות" },
    { label: "לידים חמים", value: "7", badge: "לטיפול" },
    { label: "פולואפים דחופים", value: "5", badge: "היום" },
    { label: "כסף בתהליך", value: "₪42K", badge: "פתוח" },
  ];

  return (
    <div className="relative mx-auto w-full max-w-xl overflow-hidden rounded-[24px] border border-white/[0.12] bg-[#0B0B0B]/95 p-3 shadow-[0_30px_100px_rgba(0,0,0,0.52),0_0_90px_rgba(212,175,55,0.18)] sm:rounded-[28px] sm:p-5">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:34px_34px] opacity-20" />
      <div className="relative mb-4 flex items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div className="flex items-center gap-3">
          <div className="hidden h-10 w-10 rounded-2xl border border-white/[0.10] bg-white/[0.04] sm:block" />
          <div>
            <p className="text-xs text-[#B8B8B8]">GoldenFlow CRM</p>
            <h3 className="mt-1 text-lg font-black text-white sm:text-xl">מה מקדמים היום?</h3>
          </div>
        </div>
        <div className="rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3 py-1 text-xs font-bold text-[#D4AF37]">
          Daily focus
        </div>
      </div>

      <div className="relative grid grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:gap-3">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-white/[0.10] bg-white/[0.04] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-[#D4AF37]/25 sm:p-4"
          >
            <p className="text-xs leading-5 text-[#B8B8B8]">{card.label}</p>
            <div className="mt-3 flex items-end justify-between gap-2">
              <strong className="text-lg font-black text-[#D4AF37] min-[380px]:text-xl sm:text-2xl">{card.value}</strong>
              <span className="rounded-full bg-white/[0.07] px-2 py-1 text-[11px] text-white">
                {card.badge}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="relative mt-4 grid gap-3 min-[430px]:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/[0.07] p-3 shadow-[0_0_34px_rgba(212,175,55,0.08)] sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm font-bold text-white">
              <Flame className="h-4 w-4 text-[#D4AF37]" />
              הפעולה הבאה שלך
            </span>
            <span className="rounded-full bg-[#D4AF37] px-2 py-1 text-[11px] font-black text-black">
              חם
            </span>
          </div>
          <p className="text-sm leading-6 text-[#B8B8B8]">
            להתקשר לדניאל - הצעת מחיר נשלחה. שווי פוטנציאלי: ₪1,200.
          </p>
          <div className="mt-4 h-2 rounded-full bg-white/[0.08]">
            <div className="h-2 w-[72%] rounded-full bg-[#D4AF37] shadow-[0_0_18px_rgba(212,175,55,0.45)]" />
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.10] bg-white/[0.035] p-3 sm:p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
            <WalletCards className="h-4 w-4 text-[#D4AF37]" />
            יעד יומי
          </p>
          <div className="space-y-3 text-xs text-[#B8B8B8]">
            <div className="flex justify-between gap-3">
              <span>שיחות מכירה</span>
              <strong className="text-white">3 לביצוע</strong>
            </div>
            <div className="flex justify-between gap-3">
              <span>פולואפים</span>
              <strong className="text-white">2 דחופים</strong>
            </div>
            <div className="flex justify-between gap-3">
              <span>הצעה פתוחה</span>
              <strong className="text-white">1</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="relative mt-3 rounded-2xl border border-white/[0.10] bg-black/25 p-3 max-[360px]:hidden">
        <div className="mb-3 flex items-center justify-between text-xs">
          <span className="font-bold text-white">תהליך מכירה</span>
          <span className="rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-2 py-1 text-[#D4AF37]">
            הצעה נשלחה
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {["חדש", "שיחה", "הצעה", "סגירה"].map((stage, index) => (
            <div key={stage} className="h-2 rounded-full bg-white/[0.08]">
              <div
                className={`h-2 rounded-full ${index < 3 ? "bg-[#D4AF37]" : "bg-white/[0.14]"}`}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RealityPreviewSection() {
  return (
      <section className="bg-[#0B0B0B] px-4 py-16 min-[390px]:px-5 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionTitle
          title="איך זה נראה בפועל?"
          text="במקום לחפש הודעות, פתקים ואקסלים - נכנסים למערכת ורואים את מה שצריך לקדם היום."
        />
        <div className="grid gap-4 lg:grid-cols-6">
          {previewCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className="rounded-2xl border border-white/[0.12] bg-[#050505] p-4 text-right shadow-[0_18px_60px_rgba(0,0,0,0.22)] transition duration-200 hover:-translate-y-1 hover:border-[#D4AF37]/30 sm:p-5 lg:col-span-2 first:lg:col-span-3 last:lg:col-span-3"
              >
                <div className="mb-5 flex items-center justify-between gap-3">
                  <h3 className="text-lg font-black text-white">{card.title}</h3>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 text-[#D4AF37]">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <div className="space-y-3">
                  {card.rows.map((row) => (
                    <div
                      key={row}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-2.5 sm:py-3"
                    >
                      <span className="text-sm font-semibold leading-6 text-[#F5F5F5]">{row}</span>
                      <span className="h-2 w-2 shrink-0 rounded-full bg-[#D4AF37]" aria-hidden="true" />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          <div className="rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/[0.06] p-4 text-right shadow-[0_18px_70px_rgba(212,175,55,0.08)] sm:p-5 lg:col-span-3">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h3 className="text-lg font-black text-white">יעד יומי</h3>
              <span className="rounded-full bg-[#D4AF37] px-3 py-1 text-xs font-black text-black">
                68%
              </span>
            </div>
            <p className="text-sm leading-7 text-[#B8B8B8]">
              3 שיחות מכירה, 2 פולואפים דחופים והצעת מחיר אחת שמחכה לסגירה.
            </p>
            <div className="mt-5 h-3 rounded-full bg-white/[0.10]">
              <div className="h-3 w-[68%] rounded-full bg-[#D4AF37] shadow-[0_0_22px_rgba(212,175,55,0.35)]" />
            </div>
          </div>
          <div className="rounded-2xl border border-white/[0.12] bg-[#050505] p-4 text-right shadow-[0_18px_60px_rgba(0,0,0,0.22)] sm:p-5 lg:col-span-3">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h3 className="text-lg font-black text-white">לידים שדורשים טיפול</h3>
              <span className="rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-3 py-1 text-xs font-bold text-[#D4AF37]">
                5 היום
              </span>
            </div>
            <div className="space-y-3">
              {["לא קיבל מענה", "מחכה להצעה", "תקוע 4 ימים"].map((status) => (
                <div
                  key={status}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-3"
                >
                  <span className="text-sm font-semibold text-white">{status}</span>
                  <span className="rounded-full bg-white/[0.07] px-2 py-1 text-[11px] text-[#B8B8B8]">
                    צריך חזרה
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function WorkflowVisual() {
  return (
    <div className="mx-auto mt-8 max-w-7xl rounded-3xl border border-white/[0.10] bg-[#050505] p-4 shadow-[0_22px_80px_rgba(0,0,0,0.28)] sm:mt-10 sm:p-5">
      <div className="mb-4 flex flex-col items-start gap-3 min-[430px]:flex-row min-[430px]:items-center min-[430px]:justify-between">
        <p className="text-sm font-black text-white">זרימת מכירה מסודרת</p>
        <span className="rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-3 py-1 text-xs font-bold text-[#D4AF37]">
          השלב הפעיל: הצעה נשלחה
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-5">
        {workflowSteps.map((step, index) => (
          <div
            key={step}
            className={`relative rounded-2xl border p-3 text-right transition duration-200 hover:-translate-y-0.5 sm:p-4 ${
              index === 3
                ? "border-[#D4AF37]/35 bg-[#D4AF37]/[0.08] shadow-[0_0_30px_rgba(212,175,55,0.12)]"
                : "border-white/[0.10] bg-white/[0.035]"
            }`}
          >
            <div className="mb-3 flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  index === 3 ? "bg-[#D4AF37]" : "bg-white/[0.24]"
                }`}
              />
              <span className="text-xs font-bold text-[#B8B8B8]">שלב {index + 1}</span>
            </div>
            <p className="text-sm font-black text-white">{step}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function GoldenFlowPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#050505] pb-28 text-white md:pb-0" dir="rtl">
      <section className="relative px-4 pb-12 pt-7 min-[390px]:px-5 sm:px-6 lg:px-8 lg:pb-24 lg:pt-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_5%,rgba(212,175,55,0.19),transparent_32rem),radial-gradient(circle_at_10%_18%,rgba(255,255,255,0.08),transparent_22rem)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:44px_44px] opacity-20 [mask-image:linear-gradient(to_bottom,black,transparent_80%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-l from-transparent via-[#D4AF37]/35 to-transparent" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1fr_0.92fr] lg:gap-12">
          <div className="max-w-3xl text-right">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-2 text-xs font-bold text-[#D4AF37] sm:text-sm">
              <Sparkles className="h-4 w-4" />
              מחיר השקה למשתמשים הראשונים
            </div>
            <h1 className="text-[2.12rem] font-black leading-[1.1] text-white min-[390px]:text-[2.35rem] sm:text-5xl lg:text-6xl">
              הלידים שלך לא נעלמים.
              <span className="mt-2 block text-[#D4AF37]">הם פשוט צריכים ניהול נכון.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[#B8B8B8] min-[390px]:leading-8 sm:text-xl sm:leading-9">
              GoldenFlow מרכזת לך לידים, משימות ופולואפים במקום אחד - ומראה לך בכל
              יום למי לפנות כדי להתקרב ליעד המכירות שלך.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <CtaButton className="w-full sm:w-auto">פתיחת מנוי בוואטסאפ</CtaButton>
              <a
                href="#fit"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/[0.14] bg-white/[0.04] px-6 py-3 text-sm font-bold text-white transition duration-200 hover:-translate-y-0.5 hover:border-[#D4AF37]/40 hover:bg-white/[0.08]"
              >
                למי זה מתאים?
                <ArrowLeft className="h-4 w-4" />
              </a>
            </div>
          </div>
          <DashboardPreview />
        </div>
      </section>

      <section className="border-y border-white/[0.10] bg-[#0B0B0B] px-4 py-8 min-[390px]:px-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="mb-5 text-center text-sm font-bold text-[#D4AF37]">
            נבנה במיוחד לבעלי עסקים שרוצים לנהל את העסק שלהם בצורה נוחה וקלה לתפעול
            בעזרת מערכת חכמה שעוזרת לך להבין למי צריך לפנות קודם
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            {["בלי אקסלים מבולגנים", "בלי לשכוח פולואפים", "בלי לאבד כסף בין הודעות וואטסאפ"].map(
              (item) => (
                <div
                  key={item}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-white/[0.10] bg-white/[0.035] px-4 py-4 text-center text-sm font-bold text-white"
                >
                  <CheckCircle2 className="h-5 w-5 text-[#D4AF37]" />
                  {item}
                </div>
              ),
            )}
          </div>
        </div>
      </section>

      <section id="fit" className="px-4 py-14 min-[390px]:px-5 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionTitle
            title="למי GoldenFlow CRM מתאים?"
            text="אם יש לך מתעניינים, שיחות מכירה, הודעות וואטסאפ, משימות ופולואפים - המערכת הזאת נבנתה כדי לעשות סדר יומי."
          />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {audienceCards.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-white/[0.12] bg-[#0B0B0B] p-4 text-right shadow-[0_18px_60px_rgba(0,0,0,0.22)] sm:p-5"
              >
                <BadgeCheck className="mb-4 h-6 w-6 text-[#D4AF37]" />
                <h3 className="text-base font-black leading-7 text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-7 text-[#B8B8B8]">{item.text}</p>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-8 max-w-3xl rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/[0.06] p-5 text-right text-lg font-bold leading-8 text-white">
            מתאים במיוחד לעסק קטן שרוצה לעבוד מסודר כמו עסק גדול - בלי להסתבך.
          </p>
        </div>
      </section>

      <section className="bg-[#0B0B0B] px-4 py-14 min-[390px]:px-5 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionTitle
            title="הבעיה היא לא שאין לידים. הבעיה היא שהם נופלים בין הכיסאות."
            text="וואטסאפ טוב לשיחות, אבל לא לניהול מכירות. בלי מקום אחד ללידים, משימות ופולואפים - דברים מתפספסים."
          />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {painCards.map((item) => (
              <div key={item} className="rounded-2xl border border-white/[0.10] bg-[#050505] p-4 sm:p-5">
                <BellRing className="mb-4 h-6 w-6 text-[#D4AF37]" />
                <p className="text-base font-semibold leading-7 text-[#F5F5F5]">{item}</p>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <HighlightBlock>כל ליד שלא מנוהל נכון - יכול להיות כסף שנשאר על הרצפה.</HighlightBlock>
          </div>
        </div>
      </section>

      <section className="px-4 py-14 min-[390px]:px-5 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionTitle title="לפני GoldenFlow מול אחרי GoldenFlow" />
          <div className="grid overflow-hidden rounded-3xl border border-white/[0.12] bg-[#0B0B0B] md:grid-cols-2">
            <ComparisonColumn title="לפני" items={beforeItems} tone="before" />
            <ComparisonColumn title="אחרי" items={afterItems} tone="after" />
          </div>
        </div>
      </section>

      <section className="bg-[#0B0B0B] px-4 py-14 min-[390px]:px-5 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <SectionTitle
              title="מרכז שליטה אחד ללידים, משימות והפעולה הבאה"
              text="GoldenFlow CRM עוזרת להבין מאיפה להתחיל היום ומה הפעולה הבאה שכדאי לקדם."
            />
            <p className="text-right text-base leading-8 text-[#B8B8B8] sm:text-lg sm:leading-9">
              במקום לפתוח וואטסאפ, אקסלים ופתקים - נכנסים ל-GoldenFlow ורואים:
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {solutionItems.map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-2xl border border-white/[0.10] bg-[#050505] p-4 text-right"
              >
                <Check className="mt-1 h-5 w-5 shrink-0 text-[#D4AF37]" />
                <span className="text-sm font-semibold leading-7 text-white">{item}</span>
              </div>
            ))}
          </div>
        </div>
        <WorkflowVisual />
        <div className="mx-auto mt-8 max-w-7xl">
          <HighlightBlock>
            פחות עומס בראש, יותר בהירות לגבי הפעולה הבאה.
          </HighlightBlock>
        </div>
      </section>

      <section className="px-4 py-14 min-[390px]:px-5 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionTitle title="מה יש בתוך GoldenFlow CRM?" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="rounded-2xl border border-white/[0.12] bg-[#0B0B0B] p-4 text-right transition duration-200 hover:-translate-y-1 hover:border-[#D4AF37]/35 sm:p-5"
                >
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 text-[#D4AF37]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-black text-white">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[#B8B8B8]">{feature.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <RealityPreviewSection />

      <section className="px-4 py-12 min-[390px]:px-5 sm:px-6 sm:py-16 lg:px-8">
        <div className="mx-auto max-w-5xl rounded-[28px] border border-[#D4AF37]/25 bg-gradient-to-br from-[#D4AF37]/14 to-[#0B0B0B] p-6 text-center sm:p-10">
          <p className="text-2xl font-black leading-9 text-white sm:text-4xl sm:leading-tight">
            לפעמים לא צריך עוד לידים.
            <span className="block text-[#D4AF37]">צריך להפסיק לפספס את אלה שכבר הגיעו.</span>
          </p>
        </div>
      </section>

      <section className="bg-[#0B0B0B] px-4 py-14 min-[390px]:px-5 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionTitle
            title="מה GoldenFlow CRM עושה - ומה היא לא עושה?"
            text="כדי שהכול יהיה ברור מההתחלה: המערכת לא נועדה להחליף אותך ולא מבטיחה להביא לידים חדשים."
          />
          <div className="grid gap-4 md:grid-cols-2">
            {clarityItems.map((item) => (
              <div
                key={item.text}
                className="flex items-start gap-3 rounded-2xl border border-white/[0.10] bg-[#050505] p-5 text-right"
              >
                {item.type === "yes" ? (
                  <Check className="mt-1 h-5 w-5 shrink-0 text-[#D4AF37]" />
                ) : (
                  <X className="mt-1 h-5 w-5 shrink-0 text-[#B8B8B8]" />
                )}
                <span className="text-base font-semibold leading-7 text-white">{item.text}</span>
              </div>
            ))}
          </div>
          <p className="mt-8 rounded-3xl border border-[#D4AF37]/20 bg-[#D4AF37]/[0.06] p-6 text-right text-xl font-black leading-9 text-white">
            המטרה פשוטה: פחות בלגן, יותר שליטה, ויותר מיקוד בלידים שכבר הגיעו.
          </p>
        </div>
      </section>

      <section className="px-4 py-14 min-[390px]:px-5 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <SectionTitle eyebrow="מחיר השקה" title="מחיר השקה למשתמשים הראשונים" />
          <div className="rounded-[24px] border border-[#D4AF37]/30 bg-[#0B0B0B] p-5 text-right shadow-[0_34px_100px_rgba(0,0,0,0.42),0_0_70px_rgba(212,175,55,0.13)] sm:rounded-[28px] sm:p-8">
            <div className="flex flex-col gap-4 border-b border-white/[0.10] pb-7 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-bold text-[#D4AF37]">GoldenFlow CRM</p>
                <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">חבילת השקה</h2>
              </div>
              <div className="text-right sm:text-left">
                <p className="text-5xl font-black leading-none text-[#D4AF37] sm:text-6xl">97 ש&quot;ח</p>
                <p className="mt-1 text-sm font-bold text-[#B8B8B8]">לחודש</p>
              </div>
            </div>
            <p className="mt-6 rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/[0.06] p-4 text-sm font-bold leading-7 text-white min-[390px]:text-base min-[390px]:leading-8">
              המחיר נשאר קבוע למצטרפים בתקופת ההשקה כל עוד המנוי פעיל.
            </p>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {includedItems.map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm font-bold text-white">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-[#D4AF37]" />
                  {item}
                </div>
              ))}
            </div>
            <CtaButton className="mt-8 w-full">אני רוצה לפתוח מנוי</CtaButton>
            <p className="mt-4 text-center text-sm leading-6 text-[#B8B8B8]">
              ללא התחייבות ארוכה. מתחילים פשוט ובודקים אם זה עושה לך סדר.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-[#0B0B0B] px-4 py-14 min-[390px]:px-5 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionTitle title="מה קורה אחרי שמצטרפים?" />
          <div className="grid gap-4 md:grid-cols-4">
            {steps.map((step, index) => (
              <div
                key={step.title}
                className="rounded-2xl border border-white/[0.10] bg-[#050505] p-5 text-right"
              >
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-[#D4AF37] text-lg font-black text-black">
                  {index + 1}
                </div>
                <h3 className="text-lg font-black text-white">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#B8B8B8]">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-14 min-[390px]:px-5 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-5xl rounded-[24px] border border-[#D4AF37]/25 bg-gradient-to-br from-[#D4AF37]/12 to-[#0B0B0B] p-5 text-right sm:rounded-[28px] sm:p-10">
          <TrendingUp className="mb-5 h-9 w-9 text-[#D4AF37]" />
          <h2 className="text-[1.7rem] font-black leading-tight text-white sm:text-4xl">
            אם כבר יש לידים - אין סיבה שהם יתפספסו
          </h2>
          <p className="mt-5 text-lg leading-9 text-[#B8B8B8]">
            GoldenFlow CRM לא מביאה לידים חדשים. היא עוזרת לתעדף את הלידים שכבר
            הגיעו ולזכור מה צריך לקדם היום.
          </p>
          <p className="mt-5 text-lg font-black leading-8 text-white sm:text-xl sm:leading-9">
            לפעמים ההבדל בין יום מכירות מבולגן ליום מכירות ממוקד הוא פשוט לדעת למי
            לפנות קודם.
          </p>
        </div>
      </section>

      <section className="bg-[#0B0B0B] px-4 py-14 min-[390px]:px-5 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <SectionTitle title="שאלות נפוצות" />
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <details
                key={faq.question}
                open={index === 0}
                className="group rounded-2xl border border-white/[0.10] bg-[#050505] p-4 text-right sm:p-5"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-black leading-7 text-white sm:text-lg [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0">{faq.question}</span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.12] text-[#D4AF37] transition group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-4 text-base leading-8 text-[#B8B8B8]">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-44 pt-14 min-[390px]:px-5 sm:px-6 sm:pt-20 lg:px-8 lg:pb-24">
        <div className="mx-auto max-w-5xl rounded-[32px] border border-[#D4AF37]/30 bg-[#0B0B0B] p-7 text-center shadow-[0_34px_100px_rgba(0,0,0,0.46),0_0_80px_rgba(212,175,55,0.14)] sm:p-12">
          <ShieldCheck className="mx-auto mb-6 h-11 w-11 text-[#D4AF37]" />
          <h2 className="text-2xl font-black leading-tight text-white sm:text-5xl">
            הליד הבא שלך לא אמור להיעלם בוואטסאפ
          </h2>
          <p className="mx-auto mt-5 max-w-3xl text-base leading-8 text-[#B8B8B8] sm:text-lg sm:leading-9">
            GoldenFlow CRM עוזרת לפתוח כל יום עם סדר ברור: מי דורש טיפול, למי צריך
            לחזור, ומה הפעולה הבאה שיכולה לקרב אותך ליעד המכירות שלך.
          </p>
          <CtaButton className="mt-8 w-full sm:w-auto sm:px-10">פתיחת מנוי בוואטסאפ</CtaButton>
          <p className="mt-4 text-sm text-[#B8B8B8]">שלחו הודעה עכשיו ונפתח גישה למערכת.</p>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/[0.10] bg-[#050505]/92 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur md:hidden">
        <CtaButton className="w-full">פתיחת מנוי בוואטסאפ</CtaButton>
      </div>
    </main>
  );
}

function ComparisonColumn({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "before" | "after";
}) {
  return (
    <div
      className={`p-6 text-right sm:p-8 ${
        tone === "after"
          ? "border-t border-[#D4AF37]/20 bg-[#D4AF37]/[0.06] md:border-r md:border-t-0"
          : "bg-[#050505]"
      }`}
    >
      <h3 className={`mb-6 text-2xl font-black ${tone === "after" ? "text-[#D4AF37]" : "text-white"}`}>
        {title}
      </h3>
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-3">
            {tone === "after" ? (
              <Check className="mt-1 h-5 w-5 shrink-0 text-[#D4AF37]" />
            ) : (
              <X className="mt-1 h-5 w-5 shrink-0 text-[#B8B8B8]" />
            )}
            <span className="text-base font-semibold leading-7 text-white">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
