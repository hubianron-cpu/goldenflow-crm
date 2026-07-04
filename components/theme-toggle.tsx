"use client";

import { useEffect, useState } from "react";
import { Leaf } from "lucide-react";

type Theme = "dark" | "light" | "trainer";

const THEME_STORAGE_KEY = "goldenflow-theme";
const THEME_CLASSES = ["theme-dark", "theme-light", "theme-trainer"];
const THEMES: Array<{ label: string; value: Theme }> = [
  { label: "מצב בהיר", value: "light" },
  { label: "מצב כהה", value: "dark" },
  { label: "מצב טריינר - גרין מוד", value: "trainer" },
];

function normalizeTheme(value: string | null): Theme {
  return value === "light" || value === "trainer" ? value : "dark";
}

function applyTheme(theme: Theme) {
  const themeClass = `theme-${theme}`;

  document.documentElement.classList.remove(...THEME_CLASSES);
  document.documentElement.classList.add(themeClass);
  document.body.classList.remove(...THEME_CLASSES);
  document.body.classList.add(themeClass);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const initialTheme = normalizeTheme(savedTheme);

    setTheme(initialTheme);
    applyTheme(initialTheme);
  }, []);

  function changeTheme(nextTheme: Theme) {

    setTheme(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
  }

  return (
    <label className="theme-toggle" title="בחירת מצב תצוגה">
      <Leaf aria-hidden="true" className="h-4 w-4" />
      <select
        aria-label="בחירת מצב תצוגה"
        className="bg-transparent text-inherit outline-none"
        onChange={(event) => changeTheme(normalizeTheme(event.target.value))}
        value={theme}
      >
        {THEMES.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}
