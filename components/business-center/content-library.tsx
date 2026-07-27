"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Archive,
  ArrowRight,
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Filter,
  Pencil,
  Plus,
  RefreshCcw,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { StatusMessage } from "@/components/status-message";
import {
  CONTENT_PLATFORMS,
  CONTENT_PLATFORM_LABELS,
  CONTENT_SORTS,
  CONTENT_STATUSES,
  CONTENT_STATUS_LABELS,
  CONTENT_TYPES,
  CONTENT_TYPE_LABELS,
  validateContentInput,
  type ContentPlatform,
  type ContentSort,
  type ContentStatus,
  type ContentType,
} from "@/lib/business-center/content";
import type { Database } from "@/types/database";

type ContentItem = Omit<
  Database["public"]["Tables"]["business_center_content_items"]["Row"],
  "user_id"
> & {
  lead_attribution: {
    attributed_leads: number;
    current_won: number;
  } | null;
};

type ContentForm = {
  campaign_source: string;
  comments_count: string;
  content_type: ContentType;
  content_url: string;
  likes_count: string;
  notes: string;
  platform: ContentPlatform;
  profile_visits_count: string;
  promoted_product: string;
  published_on: string;
  saves_count: string;
  shares_count: string;
  status: ContentStatus;
  target_audience: string;
  title: string;
  topic: string;
  views_count: string;
};

type ContentFilters = {
  contentType: "" | ContentType;
  month: string;
  platform: "" | ContentPlatform;
  search: string;
  sort: ContentSort;
  status: "active" | "all" | ContentStatus;
};

type ContentListResponse = {
  filters: {
    contentType: ContentType | null;
    month: string | null;
    platform: ContentPlatform | null;
    search: string;
    sort: ContentSort;
    status: ContentFilters["status"];
  };
  items: ContentItem[];
  leadAttribution:
    | { available: true }
    | { available: false; reason: "load_failed" | "not_installed" };
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

const emptyForm: ContentForm = {
  campaign_source: "",
  comments_count: "",
  content_type: "Reel",
  content_url: "",
  likes_count: "",
  notes: "",
  platform: "Instagram",
  profile_visits_count: "",
  promoted_product: "",
  published_on: "",
  saves_count: "",
  shares_count: "",
  status: "draft",
  target_audience: "",
  title: "",
  topic: "",
  views_count: "",
};

const initialFilters: ContentFilters = {
  contentType: "",
  month: "",
  platform: "",
  search: "",
  sort: "newest",
  status: "active",
};

const metricDefinitions = [
  { field: "views_count", label: "צפיות" },
  { field: "likes_count", label: "לייקים" },
  { field: "comments_count", label: "תגובות" },
  { field: "saves_count", label: "שמירות" },
  { field: "shares_count", label: "שיתופים" },
  { field: "profile_visits_count", label: "כניסות לפרופיל" },
] as const;

class ContentApiError extends Error {
  code?: string;
  status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ContentApiError";
    this.code = code;
    this.status = status;
  }
}

async function getJson<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | (T & { code?: string; error?: string })
    | null;

  if (!response.ok) {
    throw new ContentApiError(
      payload?.error || "לא הצלחנו להשלים את הפעולה.",
      response.status,
      payload?.code,
    );
  }

  return payload as T;
}

async function fetchContentList(
  filters: ContentFilters,
  page: number,
  pageSize: number,
  signal?: AbortSignal,
) {
  const searchParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    sort: filters.sort,
    status: filters.status,
  });

  if (filters.search) {
    searchParams.set("search", filters.search);
  }
  if (filters.month) {
    searchParams.set("month", filters.month);
  }
  if (filters.platform) {
    searchParams.set("platform", filters.platform);
  }
  if (filters.contentType) {
    searchParams.set("contentType", filters.contentType);
  }

  const response = await fetch(`/api/business-center/content?${searchParams.toString()}`, {
    cache: "no-store",
    signal,
  });
  return getJson<ContentListResponse>(response);
}

function toForm(item: ContentItem): ContentForm {
  return {
    campaign_source: item.campaign_source ?? "",
    comments_count: item.comments_count === null ? "" : String(item.comments_count),
    content_type: item.content_type,
    content_url: item.content_url ?? "",
    likes_count: item.likes_count === null ? "" : String(item.likes_count),
    notes: item.notes ?? "",
    platform: item.platform,
    profile_visits_count:
      item.profile_visits_count === null ? "" : String(item.profile_visits_count),
    promoted_product: item.promoted_product ?? "",
    published_on: item.published_on ?? "",
    saves_count: item.saves_count === null ? "" : String(item.saves_count),
    shares_count: item.shares_count === null ? "" : String(item.shares_count),
    status: item.status,
    target_audience: item.target_audience ?? "",
    title: item.title,
    topic: item.topic ?? "",
    views_count: item.views_count === null ? "" : String(item.views_count),
  };
}

function formatDate(value: string | null) {
  if (!value) {
    return "לא פורסם";
  }

  return new Intl.DateTimeFormat("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00.000Z`));
}

function formatDateTime(value: string | null) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("he-IL", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Jerusalem",
    year: "numeric",
  }).format(new Date(value));
}

function formatMetric(value: number | null) {
  return value === null ? "לא הוזן" : new Intl.NumberFormat("he-IL").format(value);
}

function getJerusalemToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Jerusalem",
    year: "numeric",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getStatusClasses(status: ContentStatus) {
  if (status === "published") {
    return "border-success/25 bg-success/10 text-success";
  }
  if (status === "archived") {
    return "border-white/10 bg-white/[0.04] text-zinc-400";
  }
  return "border-gold/25 bg-gold/10 text-gold-soft";
}

function Field({
  children,
  className = "",
  hint,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  hint?: string;
  label: string;
}) {
  return (
    <label className={`block min-w-0 text-sm font-bold text-zinc-300 ${className}`}>
      {label}
      {children}
      {hint ? <span className="mt-1.5 block text-xs font-normal leading-5 text-zinc-500">{hint}</span> : null}
    </label>
  );
}

export function ContentLibrary() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState<ContentFilters>(initialFilters);
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [missingTable, setMissingTable] = useState(false);
  const [attributionAvailability, setAttributionAvailability] =
    useState<ContentListResponse["leadAttribution"]>({ available: true });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ContentForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const saveInFlightRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
  const {
    contentType: filterContentType,
    month: filterMonth,
    platform: filterPlatform,
    search: filterSearch,
    sort: filterSort,
    status: filterStatus,
  } = filters;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    void fetchContentList(
      {
        contentType: filterContentType,
        month: filterMonth,
        platform: filterPlatform,
        search: filterSearch,
        sort: filterSort,
        status: filterStatus,
      },
      page,
      pageSize,
      controller.signal,
    )
      .then((payload) => {
        setTotal(payload.total);
        setTotalPages(payload.totalPages);
        setAttributionAvailability(payload.leadAttribution);
        setMissingTable(false);
        if (page > payload.totalPages) {
          setPage(payload.totalPages);
          return;
        }
        setItems(payload.items);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === "AbortError") {
          return;
        }

        if (
          loadError instanceof ContentApiError &&
          loadError.code === "CONTENT_LIBRARY_NOT_INSTALLED"
        ) {
          setMissingTable(true);
          setItems([]);
          setTotal(0);
          setTotalPages(1);
          return;
        }

        setMissingTable(false);
        setError(loadError instanceof Error ? loadError.message : "לא הצלחנו לטעון את ספריית התוכן.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [
    filterContentType,
    filterMonth,
    filterPlatform,
    filterSearch,
    filterSort,
    filterStatus,
    page,
    pageSize,
  ]);

  useEffect(() => {
    if (!isFormOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) {
        setIsFormOpen(false);
        const elementToFocus = lastFocusedElementRef.current;
        lastFocusedElementRef.current = null;
        window.requestAnimationFrame(() => elementToFocus?.focus());
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const dialog = dialogRef.current;
      if (!dialog) {
        return;
      }

      const focusableElements = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0);
      if (focusableElements.length === 0) {
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (!dialog.contains(activeElement)) {
        event.preventDefault();
        firstElement.focus();
      } else if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [isFormOpen, saving]);

  async function reloadCurrentList() {
    setLoading(true);
    setError("");

    try {
      const payload = await fetchContentList(filters, page, pageSize);
      setTotal(payload.total);
      setTotalPages(payload.totalPages);
      setAttributionAvailability(payload.leadAttribution);
      setMissingTable(false);
      if (page > payload.totalPages) {
        setPage(payload.totalPages);
        return;
      }
      setItems(payload.items);
    } catch (loadError) {
      if (
        loadError instanceof ContentApiError &&
        loadError.code === "CONTENT_LIBRARY_NOT_INSTALLED"
      ) {
        setMissingTable(true);
        setItems([]);
        setTotal(0);
        setTotalPages(1);
        return;
      }
      setMissingTable(false);
      setError(loadError instanceof Error ? loadError.message : "לא הצלחנו לטעון את ספריית התוכן.");
    } finally {
      setLoading(false);
    }
  }

  function openCreateForm() {
    lastFocusedElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditingId(null);
    setForm({ ...emptyForm });
    setError("");
    setSuccess("");
    setIsFormOpen(true);
  }

  function openEditForm(item: ContentItem) {
    lastFocusedElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditingId(item.id);
    setForm(toForm(item));
    setError("");
    setSuccess("");
    setIsFormOpen(true);
  }

  function closeForm(force = false) {
    if (saving && !force) {
      return;
    }
    setIsFormOpen(false);
    setEditingId(null);
    setForm({ ...emptyForm });
    setError("");
    const elementToFocus = lastFocusedElementRef.current;
    lastFocusedElementRef.current = null;
    window.requestAnimationFrame(() => elementToFocus?.focus());
  }

  function updateForm<K extends keyof ContentForm>(field: K, value: ContentForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveContent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveInFlightRef.current) {
      return;
    }

    const validation = validateContentInput(form as unknown as Record<string, unknown>);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    saveInFlightRef.current = true;
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/business-center/content", {
        body: JSON.stringify(editingId ? { ...form, id: editingId } : form),
        headers: { "Content-Type": "application/json" },
        method: editingId ? "PATCH" : "POST",
      });
      await getJson<{ item: ContentItem }>(response);
      const wasEditing = Boolean(editingId);
      closeForm(true);
      setSuccess(wasEditing ? "התוכן עודכן בהצלחה." : "התוכן נוסף לספרייה.");

      if (!wasEditing && page !== 1) {
        setPage(1);
      } else {
        await reloadCurrentList();
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "לא הצלחנו לשמור את התוכן.");
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  }

  async function changeArchiveState(item: ContentItem) {
    const action = item.status === "archived" ? "restore" : "archive";
    setActiveActionId(item.id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/business-center/content", {
        body: JSON.stringify({ action, id: item.id }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      await getJson<{ item: ContentItem }>(response);
      setSuccess(action === "archive" ? "התוכן הועבר לארכיון." : "התוכן שוחזר כטיוטה.");

      if (items.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        await reloadCurrentList();
      }
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "לא הצלחנו לעדכן את התוכן.");
    } finally {
      setActiveActionId(null);
    }
  }

  function applySearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setFilters((current) => ({ ...current, search: searchInput.trim() }));
  }

  function resetFilters() {
    setPage(1);
    setSearchInput("");
    setFilters(initialFilters);
  }

  const hasFilters =
    filters.search ||
    filters.month ||
    filters.platform ||
    filters.contentType ||
    filters.status !== "active" ||
    filters.sort !== "newest";

  return (
    <div aria-busy={loading} className="min-w-0 space-y-6" dir="rtl">
      <section className="panel relative overflow-hidden p-5 sm:p-7">
        <div className="pointer-events-none absolute -left-20 top-0 h-56 w-56 rounded-full bg-gold/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <Link
              className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-zinc-400 hover:text-gold-soft"
              href="/business-center"
            >
              <ArrowRight className="h-4 w-4" />
              חזרה למרכז העסק
            </Link>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-gold-soft">
              CONTENT LIBRARY
            </p>
            <h1 className="mt-3 text-3xl font-black text-white sm:text-4xl">ספריית התוכן</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              כל התכנים, הקישורים והביצועים שלך במקום אחד — ללא העלאת קבצים.
            </p>
          </div>

          <button
            className="button-primary w-full gap-2 sm:w-auto"
            disabled={loading || missingTable}
            onClick={openCreateForm}
            type="button"
          >
            <Plus className="h-4 w-4" />
            הוספת תוכן
          </button>
        </div>
      </section>

      <div aria-live="polite">
        <StatusMessage error={error} success={success} />
      </div>

      {missingTable ? (
        <section className="panel p-7 text-center sm:p-10">
          <FileText className="mx-auto h-10 w-10 text-gold-soft" />
          <h2 className="mt-4 text-xl font-black text-white">
            ספריית התוכן עדיין לא הופעלה במסד הנתונים.
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-400">
            יש להפעיל את migration של ספריית התוכן ב־Supabase, ואז לנסות שוב.
          </p>
          <button className="button-secondary mt-5 gap-2" onClick={() => void reloadCurrentList()} type="button">
            <RefreshCcw className="h-4 w-4" />
            ניסיון חוזר
          </button>
        </section>
      ) : (
        <>
          <section className="panel p-5 sm:p-6" aria-labelledby="content-filters-title">
            <div className="mb-4 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-gold/20 bg-gold/10 text-gold-soft">
                <Filter className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-black text-white" id="content-filters-title">
                  חיפוש וסינון
                </h2>
                <p className="text-xs text-zinc-500">החיפוש והפילטרים מופעלים בצד השרת.</p>
              </div>
            </div>

            <form className="flex min-w-0 flex-col gap-3 sm:flex-row" onSubmit={applySearch}>
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-zinc-500" />
                <input
                  aria-label="חיפוש תכנים"
                  className="field pr-10"
                  maxLength={100}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="חיפוש לפי כותרת, נושא, מוצר או קמפיין"
                  value={searchInput}
                />
              </div>
              <button className="button-primary gap-2 sm:w-auto" type="submit">
                <Search className="h-4 w-4" />
                חיפוש
              </button>
            </form>

            <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <Field label="חודש פרסום">
                <input
                  className="field mt-2"
                  onChange={(event) => {
                    setPage(1);
                    setFilters((current) => ({ ...current, month: event.target.value }));
                  }}
                  type="month"
                  value={filters.month}
                />
              </Field>

              <Field label="פלטפורמה">
                <select
                  className="field mt-2"
                  onChange={(event) => {
                    setPage(1);
                    setFilters((current) => ({
                      ...current,
                      platform: event.target.value as ContentFilters["platform"],
                    }));
                  }}
                  value={filters.platform}
                >
                  <option value="">כל הפלטפורמות</option>
                  {CONTENT_PLATFORMS.map((platform) => (
                    <option key={platform} value={platform}>
                      {CONTENT_PLATFORM_LABELS[platform]}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="סוג תוכן">
                <select
                  className="field mt-2"
                  onChange={(event) => {
                    setPage(1);
                    setFilters((current) => ({
                      ...current,
                      contentType: event.target.value as ContentFilters["contentType"],
                    }));
                  }}
                  value={filters.contentType}
                >
                  <option value="">כל סוגי התוכן</option>
                  {CONTENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {CONTENT_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="סטטוס">
                <select
                  className="field mt-2"
                  onChange={(event) => {
                    setPage(1);
                    setFilters((current) => ({
                      ...current,
                      status: event.target.value as ContentFilters["status"],
                    }));
                  }}
                  value={filters.status}
                >
                  <option value="active">טיוטות ופורסמו</option>
                  {CONTENT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {CONTENT_STATUS_LABELS[status]}
                    </option>
                  ))}
                  <option value="all">הכול, כולל ארכיון</option>
                </select>
              </Field>

              <Field label="מיון">
                <select
                  className="field mt-2"
                  onChange={(event) => {
                    setPage(1);
                    setFilters((current) => ({
                      ...current,
                      sort: event.target.value as ContentSort,
                    }));
                  }}
                  value={filters.sort}
                >
                  {CONTENT_SORTS.map((sort) => (
                    <option key={sort} value={sort}>
                      {sort === "newest"
                        ? "החדש ביותר"
                        : sort === "oldest"
                          ? "הישן ביותר"
                          : "הכי הרבה צפיות"}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="רשומות בעמוד">
                <select
                  className="field mt-2"
                  onChange={(event) => {
                    setPage(1);
                    setPageSize(Number(event.target.value));
                  }}
                  value={pageSize}
                >
                  <option value="20">20</option>
                  <option value="50">50</option>
                </select>
              </Field>
            </div>

            {hasFilters ? (
              <button className="mt-4 text-xs font-bold text-zinc-400 hover:text-gold-soft" onClick={resetFilters} type="button">
                ניקוי חיפוש ופילטרים
              </button>
            ) : null}
          </section>

          {!attributionAvailability.available ? (
            <section className="rounded-2xl border border-gold/20 bg-gold/[0.05] p-4 text-sm text-zinc-300">
              {attributionAvailability.reason === "not_installed"
                ? "שיוך תוכן ללידים עדיין לא הופעל במסד הנתונים."
                : "לא הצלחנו לטעון כרגע את ספירות הלידים לתוכן."}
              {" "}ספריית התוכן ממשיכה לפעול כרגיל.
            </section>
          ) : null}

          {loading ? (
            <section className="panel p-8 text-center text-sm text-zinc-400">
              טוען את ספריית התוכן...
            </section>
          ) : error ? (
            <section className="panel p-8 text-center">
              <p className="font-bold text-zinc-300">לא הצלחנו לטעון את ספריית התוכן.</p>
              <button className="button-secondary mt-5 gap-2" onClick={() => void reloadCurrentList()} type="button">
                <RefreshCcw className="h-4 w-4" />
                ניסיון חוזר
              </button>
            </section>
          ) : items.length === 0 ? (
            <section className="panel p-8 text-center sm:p-12">
              <FileText className="mx-auto h-11 w-11 text-gold-soft" />
              <h2 className="mt-4 text-xl font-black text-white">
                {hasFilters ? "לא נמצאו תכנים מתאימים" : "עדיין לא נוספו תכנים"}
              </h2>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-zinc-400">
                {hasFilters
                  ? "נסו לשנות את החיפוש או לנקות את הפילטרים כדי לראות תכנים נוספים."
                  : "הוסף את התוכן הראשון כדי להתחיל לעקוב אחר הביצועים."}
              </p>
              {hasFilters ? (
                <button className="button-secondary mt-5" onClick={resetFilters} type="button">
                  ניקוי חיפוש ופילטרים
                </button>
              ) : (
                <button className="button-primary mt-5 gap-2" onClick={openCreateForm} type="button">
                  <Plus className="h-4 w-4" />
                  הוספת תוכן
                </button>
              )}
            </section>
          ) : (
            <section aria-labelledby="content-list-title">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-white" id="content-list-title">
                    התכנים שלך
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    {new Intl.NumberFormat("he-IL").format(total)} רשומות נמצאו
                  </p>
                </div>
                <p className="text-xs font-bold text-zinc-500">
                  עמוד {page} מתוך {totalPages}
                </p>
              </div>

              <div className="grid min-w-0 gap-4">
                {items.map((item) => (
                  <article className="card-default min-w-0 p-5 sm:p-6" key={item.id}>
                    <div className="flex min-w-0 flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-3 py-1 text-[11px] font-bold ${getStatusClasses(item.status)}`}>
                            {CONTENT_STATUS_LABELS[item.status]}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-[11px] font-bold text-zinc-400">
                            {CONTENT_PLATFORM_LABELS[item.platform]}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-[11px] font-bold text-zinc-400">
                            {CONTENT_TYPE_LABELS[item.content_type]}
                          </span>
                        </div>

                        <h3 className="mt-3 break-words text-xl font-black text-white">{item.title}</h3>
                        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-500">
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {formatDate(item.published_on)}
                          </span>
                          {item.topic ? <span>נושא: {item.topic}</span> : null}
                          {item.promoted_product ? <span>מוצר: {item.promoted_product}</span> : null}
                          {item.campaign_source ? <span>קמפיין: {item.campaign_source}</span> : null}
                        </div>

                        <div className="mt-5 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                          {metricDefinitions.map((metric) => (
                            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3" key={metric.field}>
                              <p className="text-[11px] font-bold text-zinc-500">{metric.label}</p>
                              <p className="mt-1 break-words text-sm font-black text-white">
                                {formatMetric(item[metric.field])}
                              </p>
                            </div>
                          ))}
                        </div>

                        <div className="mt-3 rounded-xl border border-gold/15 bg-gold/[0.035] p-3">
                          <p className="text-[11px] font-bold text-gold-soft">כל הזמנים</p>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <div className="rounded-lg border border-white/[0.07] bg-black/15 p-2.5">
                              <p className="text-[11px] font-bold text-zinc-500">לידים משויכים</p>
                              <p className="mt-1 text-sm font-black text-white">
                                {item.lead_attribution
                                  ? formatMetric(item.lead_attribution.attributed_leads)
                                  : "—"}
                              </p>
                            </div>
                            <div className="rounded-lg border border-white/[0.07] bg-black/15 p-2.5">
                              <p className="text-[11px] font-bold text-zinc-500">נסגרו בהצלחה כרגע</p>
                              <p className="mt-1 text-sm font-black text-white">
                                {item.lead_attribution
                                  ? formatMetric(item.lead_attribution.current_won)
                                  : "—"}
                              </p>
                            </div>
                          </div>
                        </div>

                        {item.metrics_updated_at ? (
                          <p className="mt-3 text-[11px] text-zinc-500">
                            ביצועים עודכנו: {formatDateTime(item.metrics_updated_at)}
                          </p>
                        ) : null}
                      </div>

                      <div className="grid shrink-0 gap-2 sm:grid-cols-3 xl:w-48 xl:grid-cols-1">
                        <button className="button-primary gap-2 px-4 py-2" onClick={() => openEditForm(item)} type="button">
                          <Pencil className="h-4 w-4" />
                          עריכה
                        </button>
                        {item.content_url ? (
                          <a
                            className="button-secondary gap-2 px-4 py-2"
                            href={item.content_url}
                            rel="noopener noreferrer"
                            target="_blank"
                          >
                            <ExternalLink className="h-4 w-4" />
                            פתיחת התוכן
                          </a>
                        ) : null}
                        <button
                          className={
                            item.status === "archived"
                              ? "button-secondary gap-2 px-4 py-2"
                              : "button-secondary gap-2 border-danger/25 px-4 py-2 text-red-200 hover:border-danger/40"
                          }
                          disabled={activeActionId === item.id}
                          onClick={() => void changeArchiveState(item)}
                          type="button"
                        >
                          {item.status === "archived" ? (
                            <>
                              <RotateCcw className="h-4 w-4" />
                              שחזור
                            </>
                          ) : (
                            <>
                              <Archive className="h-4 w-4" />
                              העברה לארכיון
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <nav aria-label="דפדוף בספריית התוכן" className="mt-5 flex items-center justify-center gap-3">
                <button
                  aria-label="העמוד הקודם"
                  className="button-secondary px-4 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  type="button"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <span className="text-sm font-bold text-zinc-400">
                  {page} / {totalPages}
                </span>
                <button
                  aria-label="העמוד הבא"
                  className="button-secondary px-4 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  type="button"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </nav>
            </section>
          )}
        </>
      )}

      {isFormOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 px-3 py-4 backdrop-blur-sm sm:px-5"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && !saving) {
              closeForm();
            }
          }}
        >
          <div
            aria-labelledby="content-form-title"
            aria-describedby="content-form-description"
            aria-modal="true"
            className="max-h-[calc(100dvh-2rem)] w-full max-w-4xl overflow-y-auto rounded-[28px] border border-gold/20 bg-zinc-950 p-5 shadow-[0_28px_90px_rgba(0,0,0,0.55)] sm:p-7"
            ref={dialogRef}
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-white" id="content-form-title">
                  {editingId ? "עריכת תוכן" : "הוספת תוכן"}
                </h2>
                <p className="mt-1 text-sm text-zinc-400" id="content-form-description">
                  נשמרים רק פרטים, ביצועים וקישור לתוכן המקורי.
                </p>
              </div>
              <button
                aria-label="סגירת הטופס"
                className="button-secondary min-h-10 px-3 py-2"
                disabled={saving}
                onClick={() => closeForm()}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form className="mt-6 space-y-6" onSubmit={saveContent}>
              <section aria-labelledby="content-basic-fields">
                <h3 className="text-sm font-black text-gold-soft" id="content-basic-fields">
                  פרטים בסיסיים
                </h3>
                <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
                  <Field className="sm:col-span-2" label="כותרת או הוק">
                    <input
                      autoFocus
                      className="field mt-2"
                      maxLength={200}
                      onChange={(event) => updateForm("title", event.target.value)}
                      placeholder="לדוגמה: 3 טעויות שמונעות מהעסק לצמוח"
                      required
                      value={form.title}
                    />
                  </Field>

                  <Field label="פלטפורמה">
                    <select
                      className="field mt-2"
                      onChange={(event) => updateForm("platform", event.target.value as ContentPlatform)}
                      value={form.platform}
                    >
                      {CONTENT_PLATFORMS.map((platform) => (
                        <option key={platform} value={platform}>
                          {CONTENT_PLATFORM_LABELS[platform]}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="סוג תוכן">
                    <select
                      className="field mt-2"
                      onChange={(event) => updateForm("content_type", event.target.value as ContentType)}
                      value={form.content_type}
                    >
                      {CONTENT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {CONTENT_TYPE_LABELS[type]}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="סטטוס">
                    <select
                      className="field mt-2"
                      onChange={(event) => updateForm("status", event.target.value as ContentStatus)}
                      value={form.status}
                    >
                      {CONTENT_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {CONTENT_STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="תאריך פרסום">
                    <input
                      className="field mt-2"
                      max={form.status === "published" ? getJerusalemToday() : undefined}
                      onChange={(event) => updateForm("published_on", event.target.value)}
                      type="date"
                      value={form.published_on}
                    />
                  </Field>

                  <Field
                    className="sm:col-span-2"
                    hint="קישור http או https בלבד. פרמטרים בקישור נשמרים כפי שהוזנו."
                    label="קישור לתוכן"
                  >
                    <input
                      className="field mt-2"
                      dir="ltr"
                      maxLength={2048}
                      onChange={(event) => updateForm("content_url", event.target.value)}
                      placeholder="https://..."
                      type="url"
                      value={form.content_url}
                    />
                  </Field>
                </div>
              </section>

              <section aria-labelledby="content-classification-fields">
                <h3 className="text-sm font-black text-gold-soft" id="content-classification-fields">
                  סיווג
                </h3>
                <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
                  <Field label="נושא">
                    <input
                      className="field mt-2"
                      maxLength={150}
                      onChange={(event) => updateForm("topic", event.target.value)}
                      value={form.topic}
                    />
                  </Field>
                  <Field label="קהל יעד">
                    <input
                      className="field mt-2"
                      maxLength={200}
                      onChange={(event) => updateForm("target_audience", event.target.value)}
                      value={form.target_audience}
                    />
                  </Field>
                  <Field label="מוצר מקודם">
                    <input
                      className="field mt-2"
                      maxLength={200}
                      onChange={(event) => updateForm("promoted_product", event.target.value)}
                      value={form.promoted_product}
                    />
                  </Field>
                  <Field label="קמפיין או מקור">
                    <input
                      className="field mt-2"
                      maxLength={200}
                      onChange={(event) => updateForm("campaign_source", event.target.value)}
                      value={form.campaign_source}
                    />
                  </Field>
                </div>
              </section>

              <details className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-black text-gold-soft">
                  <BarChart3 className="h-4 w-4" />
                  ביצועים (אופציונלי)
                </summary>
                <p className="mt-2 text-xs leading-5 text-zinc-500">
                  שדה ריק נשמר ללא נתון; הזנת 0 נשמרת כ־0.
                </p>
                <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {metricDefinitions.map((metric) => (
                    <Field key={metric.field} label={metric.label}>
                      <input
                        className="field mt-2"
                        inputMode="numeric"
                        min="0"
                        onChange={(event) => updateForm(metric.field, event.target.value)}
                        step="1"
                        type="number"
                        value={form[metric.field]}
                      />
                    </Field>
                  ))}
                </div>
              </details>

              <Field hint="עד 1,000 תווים." label="הערה">
                <textarea
                  className="field mt-2 min-h-28 resize-y"
                  maxLength={1000}
                  onChange={(event) => updateForm("notes", event.target.value)}
                  value={form.notes}
                />
              </Field>

              <div aria-live="polite">
                <StatusMessage error={error} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button className="button-primary" disabled={saving} type="submit">
                  {saving ? "שומר..." : editingId ? "שמירת שינויים" : "שמירת תוכן"}
                </button>
                <button className="button-secondary" disabled={saving} onClick={() => closeForm()} type="button">
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
