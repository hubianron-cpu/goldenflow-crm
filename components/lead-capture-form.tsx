"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { StatusMessage } from "@/components/status-message";

const initialForm = {
  name: "",
  phone: "",
  value: "",
  website: "",
};

function isValidPhone(value: string) {
  return /^[0-9+\-()\s]{7,20}$/.test(value);
}

export function LeadCaptureForm({ source }: { source: string }) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState(initialForm);
  const [isPending, startTransition] = useTransition();
  const normalizedSource = useMemo(() => source.trim() || "organic", [source]);

  function updateField(name: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function validate() {
    if (!form.name.trim()) {
      return "יש למלא שם.";
    }

    if (!form.phone.trim()) {
      return "יש למלא טלפון.";
    }

    if (!isValidPhone(form.phone.trim())) {
      return "מספר הטלפון אינו תקין.";
    }

    return "";
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const validationError = validate();

    if (validationError) {
      setError(validationError);
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/leads", {
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          source: normalizedSource,
          status: "ליד חדש",
          value: form.value ? Number(form.value) : 0,
          website: form.website.trim(),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(payload.error || "לא הצלחנו לשלוח את הפרטים. נסו שוב.");
        return;
      }

      setForm(initialForm);
      setSuccess("הליד התקבל! נחזור אליך בהקדם");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <StatusMessage error={error} success={success} />

      {success ? (
        <div className="rounded-lg border border-gold/30 bg-gold/10 p-4 text-sm text-gold-soft">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>הפרטים נקלטו במערכת.</span>
          </div>
        </div>
      ) : null}

      <label className="block text-sm text-zinc-300">
        שם מלא
        <input
          className="field mt-2"
          onChange={(event) => updateField("name", event.target.value)}
          placeholder="איך קוראים לך?"
          required
          value={form.name}
        />
      </label>

      <label className="block text-sm text-zinc-300">
        טלפון
        <input
          className="field mt-2"
          inputMode="tel"
          onChange={(event) => updateField("phone", event.target.value)}
          placeholder="050-0000000"
          required
          value={form.phone}
        />
      </label>

      <label className="block text-sm text-zinc-300">
        שווי משוער
        <input
          className="field mt-2"
          inputMode="numeric"
          min="0"
          onChange={(event) => updateField("value", event.target.value)}
          placeholder="אופציונלי"
          type="number"
          value={form.value}
        />
      </label>

      <label
        aria-hidden="true"
        className="absolute -left-[10000px] h-px w-px overflow-hidden"
      >
        Website
        <input
          autoComplete="off"
          name="website"
          onChange={(event) => updateField("website", event.target.value)}
          tabIndex={-1}
          value={form.website}
        />
      </label>

      <input name="source" type="hidden" value={normalizedSource} />

      <button className="button-primary w-full gap-2 disabled:cursor-not-allowed disabled:opacity-60" disabled={isPending} type="submit">
        <Send className="h-4 w-4" />
        שליחת פרטים
      </button>
    </form>
  );
}
