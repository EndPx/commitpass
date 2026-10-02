"use client";
import { useEffect, useRef, type ComponentProps } from "react";
import { Scanner, useDevices } from "@yudiel/react-qr-scanner";

export default function GuestCamera({
  deviceId,
  onDeviceChange,
  onScan,
  onError,
  onReady,
}: {
  deviceId: string;
  onDeviceChange: (id: string) => void;
  onScan: ComponentProps<typeof Scanner>["onScan"];
  onError: (error: unknown) => void;
  onReady: () => void;
}) {
  const devices = useDevices();
  const root = useRef<HTMLDivElement>(null);
  const ready = useRef(onReady);
  ready.current = onReady;
  useEffect(() => {
    const video = root.current?.querySelector("video");
    if (!video) return;
    const playing = () => ready.current();
    video.addEventListener("playing", playing);
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) playing();
    return () => video.removeEventListener("playing", playing);
  }, [deviceId]);
  return (
    <>
      <div className="guest-live-scanner" ref={root}>
        <Scanner
          key={deviceId || "rear-camera"}
          onScan={onScan}
          onError={onError}
          formats={["qr_code"]}
          scanDelay={350}
          allowMultiple={false}
          sound={false}
          constraints={{
            facingMode: deviceId ? undefined : { ideal: "environment" },
            deviceId: deviceId ? { exact: deviceId } : undefined,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          }}
          components={{ finder: true, torch: true, zoom: true }}
          styles={{
            container: { width: "100%", height: "100%", borderRadius: "14px" },
            video: { objectFit: "cover" },
          }}
        />
      </div>
      {devices.length > 1 && (
        <label className="guest-camera-device">
          Camera
          <select
            aria-label="Choose QR camera"
            value={deviceId}
            onChange={(event) => onDeviceChange(event.target.value)}
          >
            <option value="">Automatic / rear camera</option>
            {devices.map((device, index) => (
              <option value={device.deviceId} key={device.deviceId}>
                {device.label || `Camera ${index + 1}`}
              </option>
            ))}
          </select>
        </label>
      )}
    </>
  );
}
