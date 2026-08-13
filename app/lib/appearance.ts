export const RUNE_APPEARANCE_STORAGE_KEY = "rune-appearance-theme-v1";

export const RUNE_APPEARANCE_THEMES = [
  { id: "mist-blue", english: "Mist Blue", chinese: "雾蓝", color: "#466f92", soft: "#e8f0f6" },
  { id: "sage", english: "Sage", chinese: "鼠尾草绿", color: "#5f745b", soft: "#edf2ea" },
  { id: "lavender", english: "Lavender", chinese: "薰衣草", color: "#6f5b91", soft: "#f0ecf5" },
  { id: "deep-blue", english: "Deep Blue", chinese: "深蓝", color: "#234c78", soft: "#e8eef5" },
  { id: "cosmic-orange", english: "Cosmic Orange", chinese: "宇宙橙", color: "#b95027", soft: "#faece5" },
] as const;

export type RuneAppearanceTheme = (typeof RUNE_APPEARANCE_THEMES)[number]["id"];

export function normalizeRuneAppearanceTheme(value: unknown): RuneAppearanceTheme | null {
  return RUNE_APPEARANCE_THEMES.some((theme) => theme.id === value) ? value as RuneAppearanceTheme : null;
}
