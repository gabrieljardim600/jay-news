"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(next);
    localStorage.setItem("jnews-theme", next);
    setTheme(next);
  }

  return (
    <button
      onClick={toggle}
      title="Alternar tema"
      className="w-9 h-9 flex items-center justify-center rounded-md text-text-secondary hover:text-text hover:bg-surface transition-colors text-base"
    >
      {theme === "dark" ? "☀" : "🌙"}
    </button>
  );
}
