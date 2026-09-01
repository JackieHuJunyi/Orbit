export const RUNE_APPEARANCE_STORAGE_KEY = "rune-appearance-theme-v1";

export const RUNE_APPEARANCE_THEMES = [
  {
    id: "ultramarine",
    english: "Ultramarine",
    chinese: "超凡蓝",
    color: "#0a72ea",
    soft: "#e4f1ff",
    finish: ["#cde4ff", "#88bdf2"],
  },
  {
    id: "starlight",
    english: "Starlight",
    chinese: "星光白",
    color: "#8d8576",
    soft: "#f4f2ef",
    finish: ["#f6f2ec", "#cec4b4"],
  },
  {
    id: "mist-blue",
    english: "Mist Blue",
    chinese: "雾蓝",
    color: "#416b87",
    soft: "#e9f1f5",
    finish: ["#dceaf1", "#91aeba"],
  },
  {
    id: "sage",
    english: "Sage",
    chinese: "鼠尾草绿",
    color: "#526b51",
    soft: "#edf2eb",
    finish: ["#dfe9d9", "#91a48b"],
  },
  {
    id: "lavender",
    english: "Lavender",
    chinese: "薰衣草",
    color: "#695784",
    soft: "#f0edf5",
    finish: ["#e7def0", "#a494b8"],
  },
  {
    id: "sky-blue",
    english: "Sky Blue",
    chinese: "天蓝",
    color: "#3f708b",
    soft: "#e8f3f7",
    finish: ["#d7edf4", "#82b2c2"],
  },
  {
    id: "light-gold",
    english: "Light Gold",
    chinese: "浅金",
    color: "#745e32",
    soft: "#f6f1e7",
    finish: ["#f2e7ce", "#c6ad78"],
  },
  {
    id: "deep-blue",
    english: "Deep Blue",
    chinese: "深蓝",
    color: "#1f456d",
    soft: "#e8eef5",
    finish: ["#304f70", "#142f4e"],
  },
  {
    id: "cosmic-orange",
    english: "Cosmic Orange",
    chinese: "宇宙橙",
    color: "#a84b24",
    soft: "#f9ece5",
    finish: ["#e08a58", "#b95027"],
  },
  {
    id: "rose-pearl",
    english: "Rose Pearl",
    chinese: "玫瑰珍珠",
    color: "#c94f66",
    soft: "#f7e7eb",
    finish: ["#e5a7b2", "#b65164"],
  },
  {
    id: "silver",
    english: "Silver",
    chinese: "银色",
    color: "#575d65",
    soft: "#eef0f2",
    finish: ["#f1f2f3", "#a9adb2"],
  },
  {
    id: "space-black",
    english: "Space Black",
    chinese: "太空黑",
    color: "#91c8e9",
    soft: "#1b3445",
    finish: ["#405564", "#0b0e11"],
  },
] as const;

export type RuneAppearanceTheme = (typeof RUNE_APPEARANCE_THEMES)[number]["id"];

export function normalizeRuneAppearanceTheme(value: unknown): RuneAppearanceTheme | null {
  return RUNE_APPEARANCE_THEMES.some((theme) => theme.id === value) ? (value as RuneAppearanceTheme) : null;
}
