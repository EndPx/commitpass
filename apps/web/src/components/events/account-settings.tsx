"use client";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Check, ChevronDown, Search, Settings } from "lucide-react";
import { utcOffset } from "@/lib/display-time";
import { EditorDialog } from "./editor-dialog";
import { usePreferences } from "./preferences";

export function AccountSettings({ onClose }: { onClose: () => void }) {
  const { preferences, saveError, update } = usePreferences();
  return (
    <EditorDialog
      title="Settings"
      icon={<Settings size={24} />}
      onClose={onClose}
    >
      <div className="account-settings-fields">
        <SettingsTimezone />
        <label>
          Appearance
          <select
            value={preferences.mode}
            onChange={(event) =>
              update({ mode: event.target.value as typeof preferences.mode })
            }
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </label>
        <label>
          Background
          <select
            value={preferences.background}
            onChange={(event) =>
              update({
                background: event.target.value as typeof preferences.background,
              })
            }
          >
            <option value="soft">Soft gradient</option>
            <option value="plain">Plain</option>
          </select>
        </label>
      </div>
      <p className="settings-note">
        Saved on this browser. Event pages keep their host’s theme.
      </p>
      {saveError && (
        <p className="form-error" role="alert">
          {saveError}
        </p>
      )}
    </EditorDialog>
  );
}

function SettingsTimezone() {
  const { preferences, detectedZone, update } = usePreferences();
  const id = useId();
  const menu = useRef<HTMLDetailsElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const options = useMemo(() => {
    const now = new Date();
    const zones = Array.from(
      new Set([
        "UTC",
        detectedZone,
        ...(preferences.timezone === "auto" ? [] : [preferences.timezone]),
        ...Intl.supportedValuesOf("timeZone"),
      ]),
    ).sort();
    return [
      {
        value: "auto",
        label: `Automatic · ${detectedZone.replaceAll("_", " ")} · ${utcOffset(now, detectedZone)}`,
      },
      ...zones.map((zone) => ({
        value: zone,
        label: `${zone.replaceAll("_", " ")} · ${utcOffset(now, zone)}`,
      })),
    ];
  }, [detectedZone, preferences.timezone]);
  const filtered = options.filter((option) =>
    option.label.toLowerCase().includes(query.toLowerCase()),
  );
  const selected = options.find(
    (option) => option.value === preferences.timezone,
  )!;
  const close = (focus = false) => {
    if (menu.current) menu.current.open = false;
    if (focus) menu.current?.querySelector("summary")?.focus();
  };
  useEffect(() => {
    if (!open) return;
    searchInput.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const move = (event: KeyboardEvent<HTMLButtonElement>) => {
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const buttons = Array.from(
      menu.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ??
        [],
    );
    const current = buttons.indexOf(event.currentTarget);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : (current + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) %
            buttons.length;
    buttons[next]?.focus();
  };
  return (
    <div className="settings-zone-field">
      <span id={`${id}-label`}>Timezone & location</span>
      <details
        className="settings-zone-menu"
        ref={menu}
        onToggle={(event) => {
          setOpen(event.currentTarget.open);
          if (!event.currentTarget.open) setQuery("");
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && menu.current?.open) {
            event.preventDefault();
            event.stopPropagation();
            close(true);
          }
        }}
      >
        <summary aria-labelledby={`${id}-label ${id}-value`}>
          <span id={`${id}-value`}>{selected.label}</span>
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        {open && (
          <div className="settings-zone-panel">
            <div className="settings-zone-search">
              <Search size={16} aria-hidden="true" />
              <input
                ref={searchInput}
                aria-label="Search timezones"
                value={query}
                placeholder="Search city or UTC offset"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    menu.current
                      ?.querySelector<HTMLButtonElement>('[role="option"]')
                      ?.focus();
                  }
                }}
              />
            </div>
            <div
              className="settings-zone-options"
              role="listbox"
              aria-labelledby={`${id}-label`}
            >
              {filtered.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === preferences.timezone}
                  tabIndex={
                    option.value === preferences.timezone ||
                    (!filtered.some(
                      (item) => item.value === preferences.timezone,
                    ) &&
                      index === 0)
                      ? 0
                      : -1
                  }
                  onKeyDown={move}
                  onClick={() => {
                    update({ timezone: option.value });
                    close(true);
                  }}
                >
                  <span>{option.label}</span>
                  {option.value === preferences.timezone && (
                    <Check size={16} aria-hidden="true" />
                  )}
                </button>
              ))}
              {!filtered.length && (
                <p className="settings-zone-empty" role="status">
                  No timezone found.
                </p>
              )}
            </div>
          </div>
        )}
      </details>
    </div>
  );
}
