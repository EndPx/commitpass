"use client";
import { useState } from "react";
import { Check, ImagePlus, Moon, Palette, Search, Sun } from "lucide-react";
import type { EventAppearance } from "@commitpass/shared";
import { coverTemplates, defaultCover } from "@/lib/event-editor";
import { coverImageUrl } from "@/lib/media";
import { EditorDialog, DialogActions } from "./editor-dialog";
import { CoverUpload } from "./cover-upload";
import { themeVariables } from "./page-theme";

export function CoverEditor({
  value,
  onConfirm,
  onClose,
}: {
  value: string;
  onConfirm: (url: string) => void;
  onClose: () => void;
}) {
  const [candidate, setCandidate] = useState(value || defaultCover);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [uploading, setUploading] = useState(false);
  const templates = coverTemplates.filter(
    (template) =>
      (category === "All" || template.category === category) &&
      `${template.name} ${template.category}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <EditorDialog
      title="Choose a cover"
      description="Pick a template or upload your own photo. A square image works best."
      icon={<ImagePlus size={24} />}
      wide
      busy={uploading}
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!uploading) onConfirm(candidate || defaultCover);
        }}
      >
        <div className="cover-picker-upload">
          <img
            src={coverImageUrl(candidate, 320)}
            alt="Selected cover preview"
          />
          <CoverUpload
            value={candidate}
            onChange={(url) => setCandidate(url || defaultCover)}
            onBusyChange={setUploading}
          />
        </div>
        <label className="editor-search">
          <Search size={16} />
          <input
            aria-label="Search cover templates"
            placeholder="Search templates"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="cover-categories">
          {[
            "All",
            ...new Set(coverTemplates.map((template) => template.category)),
          ].map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={category === name}
              className={category === name ? "selected" : ""}
              onClick={() => setCategory(name)}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="cover-template-grid">
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              aria-pressed={candidate === template.url}
              className={candidate === template.url ? "selected" : ""}
              onClick={() => setCandidate(template.url)}
            >
              <img
                src={coverImageUrl(template.url, 640)}
                alt={`${template.name} cover template`}
                loading="lazy"
              />
              <span>
                {template.name}
                {candidate === template.url && <Check size={16} />}
              </span>
              <small>{template.category}</small>
            </button>
          ))}
        </div>
        {!templates.length && (
          <p className="editor-help">
            No matching cover. Try another category.
          </p>
        )}
        <p className="editor-help">
          Original AI-generated covers. Uploaded photos are public.
        </p>
        <DialogActions
          onCancel={onClose}
          disabled={uploading}
          label="Use this cover"
        />
      </form>
    </EditorDialog>
  );
}

const styles = [
  { id: "minimal", name: "Minimal" },
  { id: "aurora", name: "Aurora" },
  { id: "confetti", name: "Confetti" },
  { id: "grid", name: "Grid" },
] as const;
export function ThemeEditor({
  value,
  onChange,
  onConfirm,
  onClose,
}: {
  value: EventAppearance;
  onChange: (value: EventAppearance) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const colors = [
    "#b9462d",
    "#ca356e",
    "#7951b0",
    "#385fd1",
    "#246b55",
    "#bf890c",
    "#e9792e",
    "#5e6267",
  ];
  return (
    <EditorDialog
      title="Make it yours"
      description="Choose the look of your event. Preview changes here, then confirm to keep them."
      icon={<Palette size={24} />}
      sheet
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm();
        }}
      >
        <div className="theme-presets">
          {styles.map((style) => (
            <button
              type="button"
              key={style.id}
              aria-pressed={value.style === style.id}
              className={value.style === style.id ? "selected" : ""}
              onClick={() => onChange({ ...value, style: style.id })}
            >
              <div
                className={`theme-preview theme-${style.id}`}
                style={themeVariables({ ...value, style: style.id })}
              >
                <span />
                <i />
                <i />
                <i />
              </div>
              <span>{style.name}</span>
            </button>
          ))}
        </div>
        <div className="theme-customizers">
          <fieldset>
            <legend>Color</legend>
            <div className="theme-swatches">
              {colors.map((color) => (
                <button
                  type="button"
                  key={color}
                  aria-label={`Use ${color}`}
                  aria-pressed={value.color === color}
                  className={value.color === color ? "selected" : ""}
                  style={{ backgroundColor: color }}
                  onClick={() => onChange({ ...value, color })}
                />
              ))}
              <label className="custom-color" title="Custom color">
                <input
                  type="color"
                  aria-label="Custom accent color"
                  value={value.color}
                  onChange={(event) =>
                    onChange({ ...value, color: event.target.value })
                  }
                />
                <span>Custom</span>
              </label>
            </div>
          </fieldset>
          <fieldset>
            <legend>Title font</legend>
            <div className="theme-fonts">
              {[
                { id: "sans", name: "Default" },
                { id: "serif", name: "Editorial" },
                { id: "mono", name: "Mono" },
              ].map((font) => (
                <button
                  key={font.id}
                  type="button"
                  className={value.font === font.id ? "selected" : ""}
                  aria-pressed={value.font === font.id}
                  onClick={() =>
                    onChange({
                      ...value,
                      font: font.id as EventAppearance["font"],
                    })
                  }
                >
                  <strong
                    style={{
                      fontFamily:
                        font.id === "serif"
                          ? "var(--font-serif)"
                          : font.id === "mono"
                            ? "monospace"
                            : "var(--font-sans)",
                    }}
                  >
                    Ag
                  </strong>
                  {font.name}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Appearance</legend>
            <div className="theme-modes">
              <button
                type="button"
                aria-pressed={value.mode === "light"}
                className={value.mode === "light" ? "selected" : ""}
                onClick={() => onChange({ ...value, mode: "light" })}
              >
                <Sun size={17} />
                Light
              </button>
              <button
                type="button"
                aria-pressed={value.mode === "dark"}
                className={value.mode === "dark" ? "selected" : ""}
                onClick={() => onChange({ ...value, mode: "dark" })}
              >
                <Moon size={17} />
                Dark
              </button>
            </div>
          </fieldset>
        </div>
        <DialogActions onCancel={onClose} label="Use this theme" />
      </form>
    </EditorDialog>
  );
}
