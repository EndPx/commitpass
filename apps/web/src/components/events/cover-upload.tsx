"use client";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
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
  const request = useRef<XMLHttpRequest | null>(null);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const { authenticated, getAccessToken } = usePrivy();
  const { session } = useAccount();
  const path = usePathname();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [uploaded, setUploaded] = useState(false);
  const [phase, setPhase] = useState<"preparing" | "uploading" | "processing">(
    "preparing",
  );
  const [progress, setProgress] = useState<number | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current?.abort();
    };
  }, []);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) await uploadFile(file);
  }
  async function uploadFile(file: File) {
    if (inFlight.current || disabled || !session) return;
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
    inFlight.current = true;
    setUploading(true);
    setPhase("preparing");
    setProgress(null);
    onBusyChange?.(true);
    try {
      const token = await getAccessToken();
      if (!mounted.current) return;
      if (!token) throw new Error("Please sign in to upload a photo.");
      const form = new FormData();
      form.set("file", file);
      const result = await new Promise<{ url?: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        request.current = xhr;
        xhr.open("POST", "/api/media");
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.responseType = "json";
        xhr.timeout = 80000;
        xhr.upload.onprogress = (event) => {
          if (!mounted.current) return;
          setProgress(
            event.lengthComputable && event.total > 0
              ? Math.min(100, Math.round((event.loaded / event.total) * 100))
              : null,
          );
        };
        xhr.upload.onload = () => {
          if (mounted.current) setPhase("processing");
        };
        xhr.onload = () => {
          const response = xhr.response;
          if (xhr.status < 200 || xhr.status >= 300) {
            reject(
              new Error(
                typeof response?.error === "string"
                  ? response.error
                  : "Could not upload this photo. Please try again.",
              ),
            );
          } else {
            resolve(response ?? {});
          }
        };
        xhr.onerror = () =>
          reject(
            new Error(
              "The connection was interrupted. Please try uploading again.",
            ),
          );
        xhr.ontimeout = () =>
          reject(new Error("The upload took too long. Please try again."));
        xhr.onabort = () => reject(new Error("Photo upload was cancelled."));
        setPhase("uploading");
        setProgress(0);
        xhr.send(form);
      });
      if (!mounted.current) return;
      if (
        typeof result.url !== "string" ||
        !result.url.startsWith("https://res.cloudinary.com/")
      )
        throw new Error("The uploaded photo URL was not valid.");
      onChange(result.url);
      setUploaded(true);
    } catch (error) {
      if (!mounted.current) return;
      setError(
        error instanceof Error && error.name !== "TimeoutError"
          ? error.message
          : "The upload took too long. Please try again.",
      );
    } finally {
      request.current = null;
      inFlight.current = false;
      if (mounted.current) {
        setUploading(false);
        onBusyChange?.(false);
      }
    }
  }

  return (
    <div
      className={`cover-uploader${children ? " cover-uploader--preview" : ""}`}
      onDragOver={(event) => {
        if (!disabled && session) event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        const file = event.dataTransfer.files[0];
        if (file) void uploadFile(file);
      }}
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
      {uploading && (
        <div className="cover-upload-progress" aria-busy="true">
          <div className="cover-upload-progress-label">
            <span role="status">
              {phase === "preparing"
                ? "Preparing photo…"
                : phase === "processing"
                  ? "Processing photo…"
                  : "Uploading photo…"}
            </span>
            {phase === "uploading" && progress !== null && (
              <strong aria-hidden="true">{progress}%</strong>
            )}
          </div>
          <div
            className={`cover-upload-progress-track${phase !== "uploading" || progress === null ? " is-indeterminate" : ""}`}
            role="progressbar"
            aria-label={
              phase === "processing" ? "Processing photo" : "Photo upload"
            }
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={
              phase === "uploading" && progress !== null ? progress : undefined
            }
            aria-valuetext={
              phase === "processing"
                ? "Photo sent. Finishing processing."
                : phase === "preparing"
                  ? "Preparing photo"
                  : progress === null
                    ? "Uploading photo"
                    : `${progress}% uploaded`
            }
          >
            <span
              style={
                phase === "uploading" && progress !== null
                  ? { transform: `scaleX(${progress / 100})` }
                  : undefined
              }
            />
          </div>
          <p>
            {phase === "processing"
              ? "Photo sent. Just finishing up before it’s ready."
              : "Keep this window open while your photo uploads."}
          </p>
        </div>
      )}
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
