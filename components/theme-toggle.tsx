"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "dark" | "light";

const THEME_STORAGE_KEY = "goldenflow-theme";

function applyTheme(theme: Theme) {
  const themeClass = `theme-${theme}`;

  document.documentElement.classList.remove("theme-dark", "theme-light");
  document.documentElement.classList.add(themeClass);
  document.body.classList.remove("theme-dark", "theme-light");
  document.body.classList.add(themeClass);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const initialTheme: Theme = savedTheme === "light" ? "light" : "dark";

    setTheme(initialTheme);
    applyTheme(initialTheme);
  }, []);

  function toggleTheme() {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";

    setTheme(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
  }

  const isDark = theme === "dark";
  const label = isDark ? "מצב בהיר" : "מצב כהה";

  return (
    <button
      aria-label={label}
      aria-pressed={!isDark}
      className="theme-toggle"
      onClick={toggleTheme}
      title={label}
      type="button"
    >
      {isDark ? <Sun aria-hidden="true" className="h-4 w-4" /> : <Moon aria-hidden="true" className="h-4 w-4" />}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
