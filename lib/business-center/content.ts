export const CONTENT_PLATFORMS = [
  "Instagram",
  "TikTok",
  "YouTube",
  "Facebook",
  "LinkedIn",
  "Other",
] as const;

export const CONTENT_TYPES = [
  "Reel",
  "Post",
  "Carousel",
  "Story",
  "Video",
  "Live",
  "Other",
] as const;

export const CONTENT_STATUSES = ["draft", "published", "archived"] as const;
export const CONTENT_SORTS = ["newest", "oldest", "views"] as const;

export type ContentPlatform = (typeof CONTENT_PLATFORMS)[number];
export type ContentType = (typeof CONTENT_TYPES)[number];
export type ContentStatus = (typeof CONTENT_STATUSES)[number];
export type ContentSort = (typeof CONTENT_SORTS)[number];

export const CONTENT_PLATFORM_LABELS: Record<ContentPlatform, string> = {
  Facebook: "Facebook",
  Instagram: "Instagram",
  LinkedIn: "LinkedIn",
  Other: "אחר",
  TikTok: "TikTok",
  YouTube: "YouTube",
};

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  Carousel: "קרוסלה",
  Live: "שידור חי",
  Other: "אחר",
  Post: "פוסט",
  Reel: "Reel",
  Story: "סטורי",
  Video: "וידאו",
};

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  archived: "ארכיון",
  draft: "טיוטה",
  published: "פורסם",
};

export const CONTENT_METRIC_FIELDS = [
  "views_count",
  "likes_count",
  "comments_count",
  "saves_count",
  "shares_count",
  "profile_visits_count",
] as const;

export type ContentMetricField = (typeof CONTENT_METRIC_FIELDS)[number];

export type ContentInput = {
  campaign_source: string | null;
  comments_count: number | null;
  content_type: ContentType;
  content_url: string | null;
  likes_count: number | null;
  notes: string | null;
  platform: ContentPlatform;
  profile_visits_count: number | null;
  promoted_product: string | null;
  published_on: string | null;
  saves_count: number | null;
  shares_count: number | null;
  status: ContentStatus;
  target_audience: string | null;
  title: string;
  topic: string | null;
  views_count: number | null;
};

type ValidationResult =
  | { data: ContentInput; ok: true }
  | { error: string; ok: false };

type MetricValidationResult =
  | { ok: true; value: number | null }
  | { error: string; ok: false };

const datePattern = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const MAX_METRIC_VALUE = Number.MAX_SAFE_INTEGER;

function normalizeSingleLine(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function normalizeNotes(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n");
}

function isValidCalendarDate(value: string) {
  if (!datePattern.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function getJerusalemToday(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Jerusalem",
    year: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

function parseMetric(value: unknown, label: string): MetricValidationResult {
  if (value === null || value === undefined || value === "") {
    return { ok: true, value: null };
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return { ok: true, value: null };
    }

    if (!/^\d+$/.test(trimmed)) {
      return { error: `${label} חייב להיות מספר שלם שאינו שלילי.`, ok: false };
    }

    const parsed = Number(trimmed);
    if (!Number.isSafeInteger(parsed) || parsed > MAX_METRIC_VALUE) {
      return { error: `${label} גדול מדי.`, ok: false };
    }

    return { ok: true, value: parsed };
  }

  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > MAX_METRIC_VALUE
  ) {
    return { error: `${label} חייב להיות מספר שלם שאינו שלילי.`, ok: false };
  }

  return { ok: true, value };
}

export function validateContentInput(record: Record<string, unknown>): ValidationResult {
  const title = normalizeSingleLine(record.title);
  if (!title) {
    return { error: "יש להזין כותרת או הוק לתוכן.", ok: false };
  }
  if (title.length > 200) {
    return { error: "הכותרת יכולה להכיל עד 200 תווים.", ok: false };
  }

  if (!CONTENT_PLATFORMS.includes(record.platform as ContentPlatform)) {
    return { error: "יש לבחור פלטפורמה תקינה.", ok: false };
  }
  if (!CONTENT_TYPES.includes(record.content_type as ContentType)) {
    return { error: "יש לבחור סוג תוכן תקין.", ok: false };
  }
  if (!CONTENT_STATUSES.includes(record.status as ContentStatus)) {
    return { error: "יש לבחור סטטוס תוכן תקין.", ok: false };
  }

  const platform = record.platform as ContentPlatform;
  const contentType = record.content_type as ContentType;
  const status = record.status as ContentStatus;
  const publishedOn = normalizeSingleLine(record.published_on) || null;

  if (publishedOn && !isValidCalendarDate(publishedOn)) {
    return { error: "יש להזין תאריך פרסום תקין.", ok: false };
  }
  if (status === "published" && !publishedOn) {
    return { error: "תוכן שפורסם חייב לכלול תאריך פרסום.", ok: false };
  }
  if (status === "published" && publishedOn && publishedOn > getJerusalemToday()) {
    return { error: "לא ניתן לשמור תוכן שפורסם עם תאריך עתידי.", ok: false };
  }

  const contentUrl = normalizeSingleLine(record.content_url) || null;
  if (contentUrl) {
    if (contentUrl.length > 2048) {
      return { error: "הקישור לתוכן יכול להכיל עד 2,048 תווים.", ok: false };
    }

    try {
      const url = new URL(contentUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return { error: "הקישור לתוכן חייב להתחיל ב-http או https.", ok: false };
      }
    } catch {
      return { error: "יש להזין קישור תקין לתוכן.", ok: false };
    }
  }

  const topic = normalizeSingleLine(record.topic) || null;
  const targetAudience = normalizeSingleLine(record.target_audience) || null;
  const promotedProduct = normalizeSingleLine(record.promoted_product) || null;
  const campaignSource = normalizeSingleLine(record.campaign_source) || null;
  const notes = normalizeNotes(record.notes) || null;

  if (topic && topic.length > 150) {
    return { error: "הנושא יכול להכיל עד 150 תווים.", ok: false };
  }
  if (targetAudience && targetAudience.length > 200) {
    return { error: "קהל היעד יכול להכיל עד 200 תווים.", ok: false };
  }
  if (promotedProduct && promotedProduct.length > 200) {
    return { error: "המוצר המקודם יכול להכיל עד 200 תווים.", ok: false };
  }
  if (campaignSource && campaignSource.length > 200) {
    return { error: "הקמפיין או המקור יכולים להכיל עד 200 תווים.", ok: false };
  }
  if (notes && notes.length > 1000) {
    return { error: "ההערה יכולה להכיל עד 1,000 תווים.", ok: false };
  }

  const metricEntries = [
    ["views_count", "צפיות"],
    ["likes_count", "לייקים"],
    ["comments_count", "תגובות"],
    ["saves_count", "שמירות"],
    ["shares_count", "שיתופים"],
    ["profile_visits_count", "כניסות לפרופיל"],
  ] as const;
  const metrics = {} as Record<ContentMetricField, number | null>;

  for (const [field, label] of metricEntries) {
    const parsed = parseMetric(record[field], label);
    if (!parsed.ok) {
      return { error: parsed.error, ok: false };
    }
    metrics[field] = parsed.value;
  }

  return {
    data: {
      campaign_source: campaignSource,
      comments_count: metrics.comments_count,
      content_type: contentType,
      content_url: contentUrl,
      likes_count: metrics.likes_count,
      notes,
      platform,
      profile_visits_count: metrics.profile_visits_count,
      promoted_product: promotedProduct,
      published_on: publishedOn,
      saves_count: metrics.saves_count,
      shares_count: metrics.shares_count,
      status,
      target_audience: targetAudience,
      title,
      topic,
      views_count: metrics.views_count,
    },
    ok: true,
  };
}

export function contentMetricsChanged(
  current: Record<ContentMetricField, number | null>,
  next: ContentInput,
) {
  return CONTENT_METRIC_FIELDS.some((field) => current[field] !== next[field]);
}
