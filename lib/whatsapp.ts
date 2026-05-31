export type WhatsAppMessageType = "first_message" | "follow_up" | "meeting_reminder" | "next_offer";

type WhatsAppLead = {
  name?: string | null;
  phone?: string | null;
};

export const WHATSAPP_MESSAGE_OPTIONS: Array<{ label: string; type: WhatsAppMessageType }> = [
  { label: "הודעה ראשונה", type: "first_message" },
  { label: "פולואפ", type: "follow_up" },
  { label: "תזכורת", type: "meeting_reminder" },
  { label: "הצעת המשך", type: "next_offer" },
];

export function normalizePhoneNumber(phone: string | null | undefined) {
  const cleanPhone = phone?.replace(/[^\d]/g, "") ?? "";

  if (!cleanPhone) {
    return "";
  }

  return cleanPhone.startsWith("0") ? `972${cleanPhone.slice(1)}` : cleanPhone;
}

function getGreeting(name: string | null | undefined) {
  const cleanName = name?.trim();
  return cleanName ? `היי ${cleanName}` : "היי";
}

export function getWhatsAppMessage(type: WhatsAppMessageType, lead: WhatsAppLead) {
  const greeting = getGreeting(lead.name);

  if (type === "first_message") {
    return `${greeting}, כאן רון מ-GoldenFlow. ראיתי שהשארת פרטים ורציתי לבדוק מה הכי חשוב לך לסדר כרגע בעסק - לידים, פולואפים או סגירת עסקאות?`;
  }

  if (type === "follow_up") {
    return `${greeting}, רציתי לחזור אליך לגבי GoldenFlow. אם עדיין חשוב לך לעשות סדר בלידים, במשימות ובפולואפים - אשמח לבדוק איתך אם המערכת מתאימה לעסק שלך.`;
  }

  if (type === "meeting_reminder") {
    return `${greeting}, מזכיר לך שיש לנו שיחה לגבי GoldenFlow. נדבר על איך לעשות סדר בלידים, פולואפים וסגירת עסקאות בעסק שלך.`;
  }

  return `${greeting}, אחרי מה שדיברנו, אני חושב ש-GoldenFlow יכולה לעזור לך לעשות סדר בלידים, במשימות ובמעקב אחרי לקוחות. אפשר להתחיל במחיר השקה ולפתוח לך משתמש כבר היום.`;
}

export function buildWhatsAppUrl(phone: string | null | undefined, message: string) {
  const normalizedPhone = normalizePhoneNumber(phone);

  if (!normalizedPhone) {
    return "";
  }

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}
