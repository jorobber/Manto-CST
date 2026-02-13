"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("theme");
    const isDark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem("theme", next ? "dark" : "light");
  };

  return (
    <button
      onClick={toggle}
      className="tap-target glass rounded-2xl px-3 py-2 text-sm text-text shadow-soft transition-all duration-200 ease-ios active:scale-[0.97]"
      type="button"
      aria-label="Cambiar tema"
    >
      <span className="inline-flex items-center gap-2">
        {dark ? <Sun size={16} /> : <Moon size={16} />}
        {dark ? "Light" : "Dark"}
      </span>
    </button>
  );
}
