"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import {
  Camera,
  CheckCircle2,
  ImagePlus,
  LoaderCircle,
  QrCode,
  ScanLine,
} from "lucide-react";
import { EditorDialog } from "./editor-dialog";
const GuestCamera = dynamic(() => import("./guest-camera"), { ssr: false });
function reservationWallet(text: string, vault: string) {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error("Scan a CommitPass reservation QR or paste its link.");
  }
  const allowed = new Set([
    window.location.origin,
    "https://commitpass-event.vercel.app",
    "https://commitpass-kappa.vercel.app",
  ]);
  if (
    !allowed.has(url.origin) ||
    url.pathname.toLowerCase() !== `/events/${vault.toLowerCase()}/manage`
  )
    throw new Error("This pass belongs to another event or website.");
  const wallet = url.searchParams.get("guest");
  if (!wallet || !/^0x[\da-f]{40}$/i.test(wallet))
    throw new Error("This pass does not contain a valid guest wallet.");
  return wallet;
}

export function GuestQrScanner({
  vault,
  onGuest,
  onClose,
}: {
  vault: string;
  onGuest: (wallet: string) => void;
  onClose: () => void;
}) {
  const imageInput = useRef<HTMLInputElement>(null),
    mounted = useRef(true),
    captured = useRef(false);
  const [cameraOn, setCameraOn] = useState(false),
    [cameraReady, setCameraReady] = useState(false),
    [deviceId, setDeviceId] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [link, setLink] = useState(""),
    [found, setFound] = useState("");
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  function accept(text: string) {
    if (captured.current) return;
    captured.current = true;
    setCameraOn(false);
    setCameraReady(false);
    try {
      setFound(reservationWallet(text, vault));
      setError("");
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Could not read this reservation.",
      );
    }
  }
  function start() {
    captured.current = false;
    setFound("");
    setError("");
    setCameraReady(false);
    setCameraOn(true);
  }
  function stop() {
    setCameraOn(false);
    setCameraReady(false);
  }
  function cameraError(value: unknown) {
    stop();
    captured.current = false;
    const name =
      value instanceof DOMException
        ? value.name
        : value instanceof Error
          ? value.name
          : "";
    setError(
      name === "NotAllowedError"
        ? "Camera access was denied. Allow it in your browser, then try again."
        : name === "NotFoundError"
          ? "No camera found. Connect a camera or upload a QR image."
          : name === "NotReadableError"
            ? "The camera is busy in another app. Close it there and retry."
            : "The camera could not start. Try another camera, upload a QR image, or paste your reservation link.",
    );
  }
  async function image(file?: File) {
    if (!file || busy) return;
    if (
      !/^image\/(png|jpeg|webp)$/.test(file.type) ||
      file.size > 4 * 1024 * 1024
    ) {
      setError("Choose a JPG, PNG or WebP image under 4 MB.");
      return;
    }
    stop();
    captured.current = false;
    setFound("");
    setBusy(true);
    setError("");
    const url = URL.createObjectURL(file);
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const result = await new BrowserQRCodeReader().decodeFromImageUrl(url);
      if (mounted.current) accept(result.getText());
    } catch {
      if (mounted.current)
        setError(
          "No QR found in this image. Use a clear, complete picture of the reservation QR.",
        );
    } finally {
      URL.revokeObjectURL(url);
      if (mounted.current) setBusy(false);
    }
  }
  function submit(form: FormEvent) {
    form.preventDefault();
    captured.current = false;
    accept(link.trim());
  }
  return (
    <EditorDialog
      title="Scan guest QR"
      description="Center the reservation QR inside the frame. Hold it steady until it’s read."
      icon={<ScanLine size={24} />}
      onClose={onClose}
    >
      {found ? (
        <div className="guest-scan-result" role="status">
          <CheckCircle2 size={36} />
          <h3>Reservation QR read</h3>
          <p>Check the matching participant before confirming attendance.</p>
          <code>{found}</code>
          <button
            className="button button--dark"
            onClick={() => {
              onGuest(found);
              onClose();
            }}
          >
            View participant
          </button>
          <button className="auth-text-button" onClick={start}>
            Scan another QR
          </button>
        </div>
      ) : (
        <>
          <div
            className={`guest-camera-frame guest-camera-frame--focused${cameraOn ? " is-scanning" : ""}`}
          >
            {cameraOn && (
              <GuestCamera
                deviceId={deviceId}
                onDeviceChange={(id) => {
                  setDeviceId(id);
                  setCameraReady(false);
                }}
                onReady={() => setCameraReady(true)}
                onError={cameraError}
                onScan={(codes) => {
                  const first = codes[0];
                  if (first && !captured.current) accept(first.rawValue);
                }}
              />
            )}
            {!cameraOn && (
              <div className="guest-qr-idle">
                <div className="guest-qr-focus">
                  <i />
                  <i />
                  <i />
                  <i />
                  <QrCode size={56} />
                </div>
              </div>
            )}
            <div className="guest-camera-status" role="status">
              {busy ? (
                <>
                  <LoaderCircle size={15} />
                  Reading image…
                </>
              ) : cameraOn ? (
                cameraReady ? (
                  "Keep the QR inside the frame"
                ) : (
                  "Connecting camera…"
                )
              ) : (
                "Ready to scan"
              )}
            </div>
          </div>
          <p className="guest-qr-guide">
            Use good lighting. Move the QR closer until it fills the frame,
            keeping all four corners visible.
          </p>
          <div className="guest-scan-actions">
            <button
              type="button"
              className="button button--dark"
              onClick={cameraOn ? stop : start}
              disabled={busy}
            >
              <Camera size={16} />
              {cameraOn
                ? "Stop camera"
                : error
                  ? "Retry camera"
                  : "Start camera"}
            </button>
            <button
              className="button"
              type="button"
              disabled={busy}
              onClick={() => imageInput.current?.click()}
            >
              <ImagePlus size={16} />
              Upload QR
            </button>
            <input
              ref={imageInput}
              hidden
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={busy}
              onChange={(event) => {
                void image(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </div>
          <form className="guest-scan-manual" onSubmit={submit}>
            <label htmlFor="guest-reservation-link">
              Or paste a reservation link
            </label>
            <input
              id="guest-reservation-link"
              value={link}
              onChange={(event) => setLink(event.target.value)}
              placeholder="https://…/manage?guest=0x…"
              required
            />
            <button className="button" disabled={busy || !link.trim()}>
              Read reservation
            </button>
          </form>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </>
      )}
    </EditorDialog>
  );
}
