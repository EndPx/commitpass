"use client";
import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { ImagePlus, LoaderCircle, X } from "lucide-react";
import { COVER_MIME_TYPES, MAX_COVER_BYTES } from "@/lib/media";
import { useAccount } from "./account-context";

export function CoverUpload({
  value,
  onChange,
  disabled = false,
  onBusyChange,
  children,
}: {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
  children?: ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const { authenticated, getAccessToken } = usePrivy();
  const { session } = useAccount();
  const path = usePathname();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [uploaded, setUploaded] = useState(false);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || uploading || disabled) return;
    setError("");
    setUploaded(false);
    if (!COVER_MIME_TYPES.includes(file.type)) {
      setError("Choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_COVER_BYTES || !file.size) {
      setError("Choose an image smaller than 4 MB.");
      return;
    }
    setUploading(true);
    onBusyChange?.(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Please sign in to upload a photo.");
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/media", {
        method: "POST",
        body: form,
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(80000),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Could not upload this photo.");
      if (
        typeof result.url !== "string" ||
        !result.url.startsWith("https://res.cloudinary.com/")
      )
        throw new Error("The uploaded photo URL was not valid.");
      onChange(result.url);
      setUploaded(true);
    } catch (error) {
      setError(
        error instanceof Error && error.name !== "TimeoutError"
          ? error.message
          : "The upload took too long. Please try again.",
      );
    } finally {
      setUploading(false);
      onBusyChange?.(false);
    }
  }

  return (
    <div
      className={`cover-uploader${children ? " cover-uploader--preview" : ""}`}
    >
      <input
        ref={input}
        className="sr-only"
        aria-label="Choose event cover photo"
        type="file"
        accept={COVER_MIME_TYPES.join(",")}
        onChange={upload}
        disabled={disabled || uploading || !session}
        tabIndex={-1}
      />
      <div className={children ? "cover-upload-preview" : undefined}>
        {children}
        <div className="cover-upload-actions">
          {authenticated ? (
            <button
              type="button"
              className="cover-upload-button"
              onClick={() => input.current?.click()}
              disabled={disabled || uploading || !session}
              title={value ? "Change cover photo" : "Upload cover photo"}
            >
              {uploading ? (
                <LoaderCircle size={16} className="upload-spinner" />
              ) : (
                <ImagePlus size={16} />
              )}
              <span className={children ? "sr-only" : undefined}>
                {uploading
                  ? "Uploading photo…"
                  : value
                    ? "Change photo"
                    : "Upload cover photo"}
              </span>
            </button>
          ) : (
            <Link
              className="cover-upload-button"
              href={`/signin?next=${encodeURIComponent(path)}`}
            >
              <ImagePlus size={16} />
              <span className={children ? "sr-only" : undefined}>
                Sign in to upload
              </span>
            </Link>
          )}
          {value && (
            <button
              type="button"
              className="cover-remove-button"
              aria-label="Remove cover from this event"
              disabled={disabled || uploading}
              onClick={() => {
                onChange("");
                setUploaded(false);
                setError("");
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>
      <p className="field-note">
        JPG, PNG, or WebP · up to 4 MB. Event covers are public.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {uploaded && (
        <p className="upload-success" role="status">
          Photo uploaded. Save your event to keep this cover.
        </p>
      )}
    </div>
  );
}
