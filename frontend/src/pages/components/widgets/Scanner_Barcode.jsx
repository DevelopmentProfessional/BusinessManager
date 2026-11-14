import React, { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { ErrorState, LoadingSpinner } from "../feedback";

export default function Scanner_Barcode({ onDetected, onCancel: _onCancel }) {
  const videoRef = useRef(null);
  const codeReaderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const startScanner = async () => {
      try {
        codeReaderRef.current = new BrowserMultiFormatReader();
        const videoElement = videoRef.current;
        // First, request permission to access any video device. This helps enumeration return devices.
        try {
          mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
          if (videoElement) {
            videoElement.srcObject = mediaStreamRef.current;
          }
        } catch (permErr) {
          // If permission denied, surface a clear error and stop.
          throw new Error("The phone says camera permissions denied, please allow camera access and try again.");
        }

        let devices = [];
        try {
          devices = await BrowserMultiFormatReader.listVideoInputDevices();
        } catch {
          devices = [];
        }

        // Prefer back camera when available
        const backCamera = devices.find((d) => /back|rear|environment/i.test(d.label));
        const deviceId = backCamera?.deviceId || devices[0]?.deviceId;

        // If still no device ID, fallback to default camera by passing undefined
        await codeReaderRef.current.decodeFromVideoDevice(deviceId, videoElement, (result, _err) => {
          if (!active) return;
          if (result) {
            const text = result.getText();
            onDetected?.(text);
          }
          // ignore err frames silently
        });
      } catch (e) {
        console.error("Scanner error", e);
        setError(e?.message || "Failed to start camera");
      }
    };

    startScanner();
    return () => {
      active = false;
      try {
        codeReaderRef.current?.reset();
      } catch {}
      try {
        mediaStreamRef.current?.getTracks()?.forEach((t) => t.stop());
      } catch {}
    };
  }, [onDetected]);

  return (
    <div className="space-y-3">
      <div className="aspect-video bg-black overflow-hidden position-relative rounded">
      <video ref={videoRef} onLoadedMetadata={() => setReady(true)} className="h-full object-cover w-full" muted playsInline autoPlay />
      {!error && !ready && <LoadingSpinner label="Starting scanner" className="position-absolute top-50 start-50 translate-middle" />}
      </div>
      {error && <ErrorState description={error} className="mt-2" />}
    </div>
  );
}
