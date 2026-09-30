"use client";
import { Settings } from "lucide-react";
import { EditorDialog } from "./editor-dialog";
import { usePreferences } from "./preferences";

export function AccountSettings({ onClose }: { onClose: () => void }) {
  const { preferences, detectedZone, saveError, update } = usePreferences();
  const zones = Array.from(
    new Set([
      "UTC",
      detectedZone,
      ...(preferences.timezone === "auto" ? [] : [preferences.timezone]),
      ...Intl.supportedValuesOf("timeZone"),
    ]),
  ).sort();
  return (
    <EditorDialog
      title="Settings"
      icon={<Settings size={24} />}
      onClose={onClose}
    >
      <div className="account-settings-fields">
        <label>
          Timezone & location
          <select
            value={preferences.timezone}
            onChange={(event) => update({ timezone: event.target.value })}
          >
            <option value="auto">
              Automatic · {detectedZone.replaceAll("_", " ")}
            </option>
            {zones.map((zone) => (
              <option key={zone} value={zone}>
                {zone.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
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
