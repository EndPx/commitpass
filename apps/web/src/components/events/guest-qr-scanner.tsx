"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { IScannerControls } from "@zxing/browser";
import { Camera, ImagePlus, QrCode } from "lucide-react";
import { EditorDialog } from "./editor-dialog";

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
  const video = useRef<HTMLVideoElement>(null),
    controls = useRef<IScannerControls | null>(null),
    mounted = useRef(true),
    starting = useRef(false);
  const [active, setActive] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [link, setLink] = useState("");
  function stop() {
    controls.current?.stop();
    controls.current = null;
    const stream = video.current?.srcObject;
    if (typeof MediaStream !== "undefined" && stream instanceof MediaStream)
      stream.getTracks().forEach((track) => track.stop());
    if (video.current) video.current.srcObject = null;
    if (mounted.current) setActive(false);
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stop();
    };
  }, []);
  function accept(text: string) {
    const wallet = reservationWallet(text, vault);
    stop();
    onGuest(wallet);
    onClose();
  }
  async function camera() {
    if (starting.current || active) return;
    starting.current = true;
    setBusy(true);
    setError("");
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      if (!mounted.current) return;
      const scanner = await new BrowserQRCodeReader().decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } }, audio: false },
        video.current!,
        (result, _error, scannerControls) => {
          if (!result || !mounted.current) return;
          try {
            const wallet = reservationWallet(result.getText(), vault);
            scannerControls.stop();
            stop();
            onGuest(wallet);
            onClose();
          } catch (value) {
            setError(
              value instanceof Error
                ? value.message
                : "Could not read this pass.",
            );
          }
        },
      );
      if (!mounted.current) scanner.stop();
      else {
        controls.current = scanner;
        setActive(true);
      }
    } catch {
      if (mounted.current) {
        stop();
        setError(
          "Camera unavailable. Allow camera access, upload a QR image, or paste the reservation link.",
        );
      }
    } finally {
      starting.current = false;
      if (mounted.current) setBusy(false);
    }
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
    setBusy(true);
    setError("");
    const url = URL.createObjectURL(file);
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const result = await new BrowserQRCodeReader().decodeFromImageUrl(url);
      if (mounted.current) accept(result.getText());
    } catch (value) {
      if (mounted.current)
        setError(
          value instanceof Error &&
            /pass|event|wallet|website|CommitPass/.test(value.message)
            ? value.message
            : "No reservation QR found in this image.",
        );
    } finally {
      URL.revokeObjectURL(url);
      if (mounted.current) setBusy(false);
    }
  }
  function submit(form: FormEvent) {
    form.preventDefault();
    setError("");
    try {
      accept(link.trim());
    } catch (value) {
      setError(
        value instanceof Error ? value.message : "Invalid reservation link.",
      );
    }
  }
  return (
    <EditorDialog
      title="Scan guest QR"
      description="Find a reservation, then confirm the guest’s attendance in the table."
      icon={<QrCode size={24} />}
      onClose={onClose}
    >
      <div className="guest-camera-frame">
        <video ref={video} muted playsInline aria-label="QR camera preview" />
        {!active && (
          <span>
            <QrCode size={48} />
            Camera preview
          </span>
        )}
      </div>
      <div className="guest-scan-actions">
        <button
          className="button"
          onClick={active ? stop : camera}
          disabled={busy}
        >
          <Camera size={16} />
          {busy ? "Preparing…" : active ? "Stop camera" : "Start camera"}
        </button>
        <label className="button">
          <ImagePlus size={16} />
          Upload QR
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            onChange={(event) => {
              void image(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
      </div>
      <form className="guest-scan-manual" onSubmit={submit}>
        <label htmlFor="guest-reservation-link">
          Or paste a reservation link
        </label>
        <input
          id="guest-reservation-link"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://…/manage?guest=0x…"
          required
        />
        <button className="button" disabled={busy || !link.trim()}>
          Find guest
        </button>
      </form>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </EditorDialog>
  );
}
