"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { browserZone, validZone } from "@/lib/event-editor";

type Preferences = {
  timezone: string;
  mode: "light" | "dark" | "system";
  background: "soft" | "plain";
};
const defaults: Preferences = {
  timezone: "auto",
  mode: "light",
  background: "soft",
};
const storageKey = "commitpass:display-preferences";
function parsePreferences(raw: unknown): Preferences {
  const value =
    raw && typeof raw === "object" ? (raw as Partial<Preferences>) : {};
  return {
    timezone:
      typeof value.timezone === "string" &&
      (value.timezone === "auto" || validZone(value.timezone))
        ? value.timezone
        : "auto",
    mode:
      value.mode === "dark" || value.mode === "system" ? value.mode : "light",
    background: value.background === "plain" ? "plain" : "soft",
  };
}
const PreferencesContext = createContext({
  preferences: defaults,
  timezone: "UTC",
  detectedZone: "UTC",
  mode: "light" as "light" | "dark",
  saveError: "",
  update: (_value: Partial<Preferences>) => {},
});
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(defaults);
  const [detectedZone, setDetectedZone] = useState("UTC");
  const [systemDark, setSystemDark] = useState(false);
  const [saveError, setSaveError] = useState("");
  useEffect(() => {
    setDetectedZone(browserZone());
    try {
      setPreferences(
        parsePreferences(
          JSON.parse(localStorage.getItem(storageKey) ?? "null"),
        ),
      );
    } catch {
      /* Browser defaults remain available when storage is unavailable. */
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateMode = () => setSystemDark(media.matches);
    const sync = (event: StorageEvent) => {
      if (event.key !== storageKey) return;
      try {
        setPreferences(parsePreferences(JSON.parse(event.newValue ?? "null")));
      } catch {
        setPreferences(defaults);
      }
    };
    updateMode();
    media.addEventListener("change", updateMode);
    window.addEventListener("storage", sync);
    return () => {
      media.removeEventListener("change", updateMode);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const update = (value: Partial<Preferences>) => {
    const next = parsePreferences({ ...preferences, ...value });
    setPreferences(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setSaveError("");
    } catch {
      setSaveError("Settings could not be saved in this browser.");
    }
  };
  return (
    <PreferencesContext.Provider
      value={{
        preferences,
        detectedZone,
        timezone:
          preferences.timezone === "auto" ? detectedZone : preferences.timezone,
        mode:
          preferences.mode === "system"
            ? systemDark
              ? "dark"
              : "light"
            : preferences.mode,
        saveError,
        update,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}
export const usePreferences = () => useContext(PreferencesContext);
