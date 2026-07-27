"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  ChevronDown,
  Link2,
  RefreshCcw,
  Save,
  Search,
  Unlink,
  X,
} from "lucide-react";
import { StatusMessage } from "@/components/status-message";
import {
  ATTRIBUTION_NOTES_MAX_LENGTH,
  type ContentAttributionOption,
  type LeadContentAttribution,
} from "@/lib/business-center/content-attribution";
import { CONTENT_TYPE_LABELS } from "@/lib/business-center/content";

type AttributionResponse = {
  attribution: LeadContentAttribution | null;
  leadSource: string;
  options: ContentAttributionOption[];
};

type LeadContentAttributionProps = {
  leadId: string;
  leadSource: string;
};

class AttributionApiError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "AttributionApiError";
    this.code = code;
  }
}

async function getJson<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | (T & { code?: string; error?: string })
    | null;

  if (!response.ok) {
    throw new AttributionApiError(
      payload?.error || "לא הצלחנו להשלים את פעולת השיוך.",
      payload?.code,
    );
  }

  return payload as T;
}

function formatDate(value: string | null) {
  if (!value) {
    return "ללא תאריך פרסום";
  }

  return new Intl.DateTimeFormat("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00.000Z`));
}

function getStatusLabel(status: ContentAttributionOption["status"]) {
  if (status === "archived") {
    return "בארכיון";
  }

  if (status === "draft") {
    return "טיוטה קיימת";
  }

  return "פורסם";
}

function mergeCurrentOption(
  options: ContentAttributionOption[],
  current: ContentAttributionOption | null,
) {
  if (!current || options.some((option) => option.id === current.id)) {
    return options;
  }

  return [current, ...options];
}

async function fetchLeadAttribution(
  leadId: string,
  searchValue: string,
  signal?: AbortSignal,
) {
  const searchParams = new URLSearchParams();
  if (searchValue.trim()) {
    searchParams.set("search", searchValue.trim());
  }
  const query = searchParams.toString();
  const response = await fetch(
    `/api/leads/${encodeURIComponent(leadId)}/content-attribution${query ? `?${query}` : ""}`,
    {
      cache: "no-store",
      signal,
    },
  );
  return getJson<AttributionResponse>(response);
}

export function LeadContentAttribution({
  leadId,
  leadSource,
}: LeadContentAttributionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [missingTable, setMissingTable] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const [attribution, setAttribution] = useState<LeadContentAttribution | null>(null);
  const [options, setOptions] = useState<ContentAttributionOption[]>([]);
  const [searchResultCount, setSearchResultCount] = useState(0);
  const [selectedContentId, setSelectedContentId] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [resolvedLeadSource, setResolvedLeadSource] = useState(leadSource);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const saveInFlightRef = useRef(false);
  const lastSearchRef = useRef<string | null>(null);
  const searchRequestRef = useRef(0);
  const removeDialogRef = useRef<HTMLDivElement>(null);
  const removeTriggerRef = useRef<HTMLButtonElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const removeDialogTitleId = useId();
  const removeDialogDescriptionId = useId();

  async function loadInitial() {
    if (loading) {
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const payload = await fetchLeadAttribution(leadId, "");
      setAttribution(payload.attribution);
      setSelectedContentId(payload.attribution?.content_item_id ?? "");
      setNotes(payload.attribution?.attribution_notes ?? "");
      setResolvedLeadSource(payload.leadSource);
      setOptions(
        mergeCurrentOption(
          payload.options,
          payload.attribution?.content_item ?? null,
        ),
      );
      setSearchResultCount(payload.options.length);
      setMissingTable(false);
      setLoaded(true);
      lastSearchRef.current = "";
    } catch (loadError) {
      const isMissing =
        loadError instanceof AttributionApiError &&
        loadError.code === "CONTENT_ATTRIBUTION_NOT_INSTALLED";
      setMissingTable(isMissing);
      setError(
        isMissing
          ? ""
          : loadError instanceof Error
            ? loadError.message
            : "לא הצלחנו לטעון את שיוך התוכן.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (
      !isOpen ||
      !loaded ||
      missingTable ||
      search.trim() === lastSearchRef.current
    ) {
      return;
    }

    const controller = new AbortController();
    const requestId = ++searchRequestRef.current;
    const timeout = window.setTimeout(() => {
      setSearching(true);
      void fetchLeadAttribution(leadId, search, controller.signal)
        .then((payload) => {
          if (
            controller.signal.aborted ||
            requestId !== searchRequestRef.current
          ) {
            return;
          }

          setOptions((current) => {
            const selectedOption =
              current.find((option) => option.id === selectedContentId) ?? null;
            return mergeCurrentOption(
              mergeCurrentOption(
                payload.options,
                attribution?.content_item ?? null,
              ),
              selectedOption,
            );
          });
          setSearchResultCount(payload.options.length);
          setError("");
          lastSearchRef.current = search.trim();
        })
        .catch((loadError: unknown) => {
          if (
            requestId !== searchRequestRef.current ||
            (loadError instanceof DOMException &&
              loadError.name === "AbortError")
          ) {
            return;
          }
          setError(
            loadError instanceof Error
              ? loadError.message
              : "לא הצלחנו לחפש בספריית התוכן.",
          );
        })
        .finally(() => {
          if (requestId === searchRequestRef.current) {
            setSearching(false);
          }
        });
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [
    attribution?.content_item,
    isOpen,
    leadId,
    loaded,
    missingTable,
    search,
    selectedContentId,
  ]);

  useEffect(() => {
    if (!removeDialogOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => {
      removeDialogRef.current
        ?.querySelector<HTMLElement>("[data-autofocus]")
        ?.focus();
    });

    function restoreFocus() {
      window.requestAnimationFrame(() => removeTriggerRef.current?.focus());
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) {
        setRemoveDialogOpen(false);
        setRemoveError("");
        restoreFocus();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const dialog = removeDialogRef.current;
      if (!dialog) {
        return;
      }

      const focusableElements = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
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

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [removeDialogOpen, saving]);

  function closeRemoveDialog() {
    if (saving) {
      return;
    }

    setRemoveDialogOpen(false);
    setRemoveError("");
    window.requestAnimationFrame(() => removeTriggerRef.current?.focus());
  }

  async function saveAttribution(contentItemId: string) {
    if (!contentItemId) {
      setError("יש לבחור תוכן לפני השמירה.");
      return;
    }

    if (saveInFlightRef.current) {
      return;
    }

    saveInFlightRef.current = true;
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/leads/${encodeURIComponent(leadId)}/content-attribution`,
        {
          body: JSON.stringify({
            attribution_notes: notes,
            content_item_id: contentItemId,
          }),
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        },
      );
      const payload = await getJson<{ attribution: LeadContentAttribution }>(
        response,
      );
      setAttribution(payload.attribution);
      setSelectedContentId(payload.attribution.content_item_id ?? "");
      setNotes(payload.attribution.attribution_notes ?? "");
      setOptions((current) =>
        mergeCurrentOption(current, payload.attribution.content_item),
      );
      setSuccess("מקור התוכן נשמר בהצלחה.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "לא הצלחנו לשמור את שיוך התוכן.",
      );
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  }

  async function removeAttribution() {
    if (saveInFlightRef.current) {
      return;
    }

    saveInFlightRef.current = true;
    setSaving(true);
    setRemoveError("");
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/leads/${encodeURIComponent(leadId)}/content-attribution`,
        {
          method: "DELETE",
        },
      );
      await getJson<{ removed: boolean }>(response);
      setAttribution(null);
      setSelectedContentId("");
      setNotes("");
      setRemoveDialogOpen(false);
      setSuccess(
        "שיוך התוכן הוסר. הליד והתוכן נשארו ללא שינוי.",
      );
      window.requestAnimationFrame(() => summaryRef.current?.focus());
    } catch (removeFailure) {
      setRemoveError(
        removeFailure instanceof Error
          ? removeFailure.message
          : "לא הצלחנו להסיר את שיוך התוכן.",
      );
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  }

  return (
    <>
      <details
        className="group min-w-0 rounded-xl border border-white/10 bg-black/20"
        onToggle={(event) => {
          const open = event.currentTarget.open;
          setIsOpen(open);
          if (open && !loaded && !loading) {
            void loadInitial();
          }
        }}
      >
        <summary
          className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-bold text-zinc-300 [&::-webkit-details-marker]:hidden"
          ref={summaryRef}
        >
          <span className="inline-flex min-w-0 items-center gap-2">
            <Link2 className="h-4 w-4 shrink-0 text-gold-soft" />
            מקור ותוכן
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500 transition group-open:rotate-180" />
        </summary>

        <div className="border-t border-white/[0.07] p-3">
          <p className="text-xs text-zinc-500">
            מקור הליד:{" "}
            <span className="font-bold text-zinc-300">
              {resolvedLeadSource.trim() || "לא ידוע"}
            </span>
          </p>

          {loading ? (
            <p className="mt-3 text-xs text-zinc-400">טוען שיוך תוכן...</p>
          ) : missingTable ? (
            <div className="mt-3 rounded-lg border border-gold/20 bg-gold/[0.06] p-3 text-xs leading-5 text-zinc-300">
              <p>שיוך תוכן ללידים עדיין לא הופעל במסד הנתונים.</p>
              <button
                className="mt-2 inline-flex items-center gap-1.5 font-bold text-gold-soft"
                onClick={() => void loadInitial()}
                type="button"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                ניסיון חוזר
              </button>
            </div>
          ) : loaded ? (
            <div className="mt-3 space-y-3">
              <div aria-live="polite">
                <StatusMessage error={error} success={success} />
              </div>

              {attribution?.content_item ? (
                <div className="rounded-lg border border-gold/15 bg-gold/[0.04] p-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-zinc-200">
                      {attribution.content_item.title}
                    </span>
                    {attribution.content_item.status === "archived" ? (
                      <span className="rounded-full border border-gold/25 bg-gold/10 px-2 py-0.5 text-[10px] font-bold text-gold-soft">
                        בארכיון
                      </span>
                    ) : attribution.content_item.status === "draft" ? (
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold text-zinc-400">
                        טיוטה קיימת
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-zinc-500">
                    {attribution.content_item.platform} ·{" "}
                    {CONTENT_TYPE_LABELS[attribution.content_item.content_type]} ·{" "}
                    {formatDate(attribution.content_item.published_on)}
                  </p>
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-zinc-500">
                  לא שויך תוכן לליד הזה.
                </p>
              )}

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-zinc-400">
                  חיפוש תוכן
                </span>
                <div className="relative">
                  <Search className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-zinc-500" />
                  <input
                    className="field py-2 pr-9 text-sm"
                    maxLength={100}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="חיפוש לפי כותרת, נושא או קמפיין"
                    value={search}
                  />
                </div>
                {searching ? (
                  <span
                    aria-live="polite"
                    className="mt-1 block text-[11px] text-zinc-500"
                  >
                    מחפש בספריית התוכן...
                  </span>
                ) : search.trim() && searchResultCount === 0 ? (
                  <span
                    aria-live="polite"
                    className="mt-1 block text-[11px] text-zinc-500"
                  >
                    לא נמצאו תכנים מתאימים לחיפוש.
                  </span>
                ) : null}
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-zinc-400">
                  התוכן שהביא את הליד
                </span>
                <select
                  className="field py-2 text-sm"
                  onChange={(event) => setSelectedContentId(event.target.value)}
                  value={selectedContentId}
                >
                  <option value="">בחרו תוכן לשיוך</option>
                  {options.map((option) => (
                    <option
                      disabled={option.status === "draft"}
                      key={option.id}
                      value={option.id}
                    >
                      {option.title} · {option.platform} ·{" "}
                      {CONTENT_TYPE_LABELS[option.content_type]} ·{" "}
                      {formatDate(option.published_on)} ·{" "}
                      {getStatusLabel(option.status)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-zinc-400">
                  הערת שיוך (אופציונלי)
                </span>
                <textarea
                  className="field min-h-20 resize-y py-2 text-sm"
                  maxLength={ATTRIBUTION_NOTES_MAX_LENGTH}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="הערה קצרה על מקור השיוך"
                  value={notes}
                />
                <span className="mt-1 block text-[11px] text-zinc-600">
                  {notes.length}/{ATTRIBUTION_NOTES_MAX_LENGTH}
                </span>
              </label>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  className="button-secondary min-h-10 flex-1 gap-2 px-3 py-2 text-xs"
                  disabled={saving || !selectedContentId}
                  onClick={() => void saveAttribution(selectedContentId)}
                  type="button"
                >
                  <Save className="h-3.5 w-3.5" />
                  {saving ? "שומר..." : "שמירת מקור ותוכן"}
                </button>
                {attribution?.content_item_id ? (
                  <button
                    className="button-secondary min-h-10 gap-2 border-danger/25 px-3 py-2 text-xs text-red-200"
                    disabled={saving}
                    onClick={() => {
                      setRemoveError("");
                      setRemoveDialogOpen(true);
                    }}
                    ref={removeTriggerRef}
                    type="button"
                  >
                    <Unlink className="h-3.5 w-3.5" />
                    הסרת שיוך בלבד
                  </button>
                ) : null}
              </div>
            </div>
          ) : error ? (
            <div className="mt-3 rounded-lg border border-danger/25 bg-danger/10 p-3 text-xs text-red-200">
              <p>{error}</p>
              <button
                className="mt-2 inline-flex items-center gap-1.5 font-bold"
                onClick={() => void loadInitial()}
                type="button"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                ניסיון חוזר
              </button>
            </div>
          ) : null}
        </div>
      </details>

      {removeDialogOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 px-3 py-4 backdrop-blur-sm sm:px-5"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) {
              closeRemoveDialog();
            }
          }}
        >
          <div
            aria-describedby={removeDialogDescriptionId}
            aria-labelledby={removeDialogTitleId}
            aria-modal="true"
            className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-gold/20 bg-zinc-950 p-5 shadow-[0_28px_90px_rgba(0,0,0,0.55)]"
            ref={removeDialogRef}
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3
                  className="text-lg font-black text-white"
                  id={removeDialogTitleId}
                >
                  להסיר את שיוך התוכן?
                </h3>
                <p
                  className="mt-2 text-sm leading-6 text-zinc-400"
                  id={removeDialogDescriptionId}
                >
                  הפעולה תמחק רק את רשומת השיוך. הליד והתוכן לא יימחקו.
                </p>
              </div>
              <button
                aria-label="סגירת אישור הסרת השיוך"
                className="button-secondary min-h-10 shrink-0 px-3 py-2"
                disabled={saving}
                onClick={closeRemoveDialog}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {removeError ? (
              <p
                aria-live="polite"
                className="mt-4 rounded-lg border border-danger/25 bg-danger/10 p-3 text-sm text-red-200"
              >
                {removeError}
              </p>
            ) : null}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row">
              <button
                className="button-secondary min-h-10 flex-1 px-4 py-2 text-sm"
                data-autofocus
                disabled={saving}
                onClick={closeRemoveDialog}
                type="button"
              >
                ביטול
              </button>
              <button
                className="button-secondary min-h-10 flex-1 border-danger/30 px-4 py-2 text-sm text-red-200"
                disabled={saving}
                onClick={() => void removeAttribution()}
                type="button"
              >
                <Unlink className="h-4 w-4" />
                {saving ? "מסיר שיוך..." : "הסרת השיוך בלבד"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
