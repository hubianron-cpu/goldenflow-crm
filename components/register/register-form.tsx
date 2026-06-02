"use client";

import { FormEvent, useState, useTransition } from "react";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { StatusMessage } from "@/components/status-message";

const professionOptions = [
  "מאמן כושר",
  "יועץ תזונה",
  "יועץ עסקי",
  "מטפל",
  "יועץ",
  "אחר",
];

const initialForm = {
  business_name: "",
  email: "",
  full_name: "",
  password: "",
  phone: "",
  profession: "",
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function RegisterForm() {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();

  function updateField(name: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function validate() {
    if (!form.full_name.trim()) {
      return "יש להזין שם מלא.";
    }

    if (!isValidEmail(form.email.trim())) {
      return "יש להזין אימייל תקין.";
    }

    if (form.password.length < 6) {
      return "יש להזין סיסמה באורך 6 תווים לפחות.";
    }

    if (!form.business_name.trim()) {
      return "יש להזין שם עסק.";
    }

    if (!form.phone.trim()) {
      return "יש להזין טלפון.";
    }

    if (!form.profession) {
      return "יש לבחור תחום עיסוק.";
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
      const response = await fetch("/api/register", {
        body: JSON.stringify({
          business_name: form.business_name.trim(),
          email: form.email.trim().toLowerCase(),
          full_name: form.full_name.trim(),
          password: form.password,
          phone: form.phone.trim(),
          profession: form.profession,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(payload.error || "לא ניתן לפתוח חשבון ניסיון כרגע.");
        return;
      }

      setForm(initialForm);
      setSuccess("חשבון הניסיון נפתח בהצלחה. אפשר להתחבר ולהתחיל לעבוד עם GoldenFlow.");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <StatusMessage error={error} success={success} />

      <label className="block text-sm font-semibold text-zinc-200">
        שם מלא
        <input
          className="field mt-2"
          name="full_name"
          onChange={(event) => updateField("full_name", event.target.value)}
          required
          value={form.full_name}
        />
      </label>

      <label className="block text-sm font-semibold text-zinc-200">
        אימייל
        <input
          className="field mt-2"
          name="email"
          onChange={(event) => updateField("email", event.target.value)}
          required
          type="email"
          value={form.email}
        />
      </label>

      <label className="block text-sm font-semibold text-zinc-200">
        סיסמה
        <input
          className="field mt-2"
          minLength={6}
          name="password"
          onChange={(event) => updateField("password", event.target.value)}
          required
          type="password"
          value={form.password}
        />
      </label>

      <label className="block text-sm font-semibold text-zinc-200">
        שם העסק
        <input
          className="field mt-2"
          name="business_name"
          onChange={(event) => updateField("business_name", event.target.value)}
          required
          value={form.business_name}
        />
      </label>

      <label className="block text-sm font-semibold text-zinc-200">
        טלפון
        <input
          className="field mt-2"
          inputMode="tel"
          name="phone"
          onChange={(event) => updateField("phone", event.target.value)}
          required
          value={form.phone}
        />
      </label>

      <label className="block text-sm font-semibold text-zinc-200">
        תחום עיסוק
        <select
          className="field mt-2"
          name="profession"
          onChange={(event) => updateField("profession", event.target.value)}
          required
          value={form.profession}
        >
          <option value="">בחר תחום</option>
          {professionOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <button className="button-primary w-full gap-2" disabled={isPending} type="submit">
        <UserPlus className="h-4 w-4" />
        {isPending ? "פותח חשבון..." : "פתיחת חשבון ניסיון"}
      </button>

      <p className="text-center text-sm text-zinc-400">
        כבר יש לך חשבון?{" "}
        <Link className="font-bold text-gold-soft hover:text-gold" href="/login">
          התחברות
        </Link>
      </p>
    </form>
  );
}
