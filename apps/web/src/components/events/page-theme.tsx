"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  DEFAULT_EVENT_APPEARANCE,
  type EventAppearance,
} from "@commitpass/shared";
import { normalizeAppearance } from "@/lib/event-editor";

const ThemeContext = createContext<(value: EventAppearance) => void>(() => {});
function mix(a: string, b: string, amount: number) {
  const channel = (color: string, offset: number) =>
    parseInt(color.slice(offset, offset + 2), 16);
  return `#${[1, 3, 5]
    .map((offset) =>
      Math.round(
        channel(a, offset) * amount + channel(b, offset) * (1 - amount),
      )
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}
function readableText(color: string) {
  const c = [1, 3, 5]
    .map((offset) => parseInt(color.slice(offset, offset + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]! > 0.179
    ? "#181818"
    : "#ffffff";
}
export function themeVariables(raw: EventAppearance): CSSProperties {
  const appearance = normalizeAppearance(raw);
  const dark = appearance.mode === "dark";
  const canvas = dark ? mix(appearance.color, "#18181b", 0.1) : "#faf9f6";
  const accent = dark
    ? mix(appearance.color, "#ffffff", 0.4)
    : readableText(appearance.color) === "#181818"
      ? mix(appearance.color, "#252622", 0.33)
      : appearance.color;
  return {
    "--canvas": canvas,
    "--ink": dark ? "#f6f5f2" : "#252622",
    "--muted": dark ? "#b9b7bd" : "#686963",
    "--line": dark ? "#ffffff20" : "#25262216",
    "--white": dark ? "#29272d" : "#ffffff",
    "--accent": accent,
    "--accent-soft": mix(appearance.color, canvas, 0.15),
    "--green": dark ? "#a6d8ad" : "#315c45",
    "--green-soft": dark ? "#234633" : "#e5eee4",
    "--editor-panel": dark ? "#ffffff09" : "#25262205",
    "--editor-input": dark ? "#ffffff0c" : "#25262206",
    "--theme-color": appearance.color,
    "--theme-glow": `${appearance.color}${dark ? "30" : "19"}`,
    "--theme-sky": mix("#91bbdc", canvas, dark ? 0.06 : 0.16),
    "--theme-wash": mix(appearance.color, canvas, dark ? 0.24 : 0.14),
    "--theme-mist": mix(appearance.color, canvas, dark ? 0.12 : 0.06),
    "--theme-primary": dark ? accent : appearance.color,
    "--theme-primary-ink": readableText(dark ? accent : appearance.color),
    "--header-surface": dark ? "rgb(28 26 30 / 60%)" : "rgb(250 249 246 / 55%)",
    "--event-heading-font":
      appearance.font === "serif"
        ? "var(--font-serif), Georgia, serif"
        : appearance.font === "mono"
          ? "ui-monospace, monospace"
          : "var(--font-sans), sans-serif",
    colorScheme: appearance.mode,
  } as CSSProperties;
}
export function PageThemeProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearance] = useState(DEFAULT_EVENT_APPEARANCE);
  const apply = useCallback(
    (value: EventAppearance) => setAppearance(normalizeAppearance(value)),
    [],
  );
  return (
    <ThemeContext.Provider value={apply}>
      <div
        className={`platform-surface theme-${appearance.style}`}
        data-mode={appearance.mode}
        style={themeVariables(appearance)}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}
export function usePageAppearance(appearance?: EventAppearance) {
  const apply = useContext(ThemeContext);
  useEffect(() => {
    apply(appearance ?? DEFAULT_EVENT_APPEARANCE);
    return () => apply(DEFAULT_EVENT_APPEARANCE);
  }, [appearance, apply]);
}
