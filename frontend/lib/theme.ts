"use client";

const THEME_KEY = "theme";

export type ThemeMode = "light" | "dark";

export function getStoredTheme(): ThemeMode {
  return "dark";
}

export function applyTheme(theme: ThemeMode): void {
  document.documentElement.classList.add("dark");
  localStorage.setItem(THEME_KEY, "dark");
}
