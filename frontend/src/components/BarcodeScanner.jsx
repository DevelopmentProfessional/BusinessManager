import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';

export default function BarcodeScanner({ onDetected, onCancel }) {
  const videoRef = useRef(null);
  const codeReaderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const startScanner = async () => {
      try {
        codeReaderRef.current = new BrowserMultiFormatReader();
        const videoElement = videoRef.current;
        // First, request permission to access any video device. This helps enumeration return devices.
        try {
          mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
          if (videoElement) {
            videoElement.srcObject = mediaStreamRef.current;
          }
        } catch (permErr) {
          // If permission denied, surface a clear error and stop.
          throw new Error('Camera permission denied. Please allow camera access and try again.');
        }

        let devices = [];
        try {
          devices = await BrowserMultiFormatReader.listVideoInputDevices();
        } catch {
          devices = [];
        }

        // Prefer back camera when available
        const backCamera = devices.find(d => /back|rear|environment/i.test(d.label));
        const deviceId = backCamera?.deviceId || devices[0]?.deviceId;

        // If still no device ID, fallback to default camera by passing undefined
        await codeReaderRef.current.decodeFromVideoDevice(deviceId, videoElement, (result, err) => {
          if (!active) return;
          if (result) {
            const text = result.getText();
            onDetected?.(text);
          }
          // ignore err frames silently
        });
      } catch (e) {
        console.error('Scanner error', e);
        setError(e?.message || 'Failed to start camera');
      }
    };

    startScanner();
    return () => {
      active = false;
      try {
        codeReaderRef.current?.reset();
      } catch {}
      try {
        mediaStreamRef.current?.getTracks()?.forEach(t => t.stop());
      } catch {}
    };
  }, [onDetected, onCancel]);

  return (
    <div className="space-y-3">
      <div className="aspect-video bg-black rounded overflow-hidden">
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline autoPlay />
      </div>
      {error && (
        <div className="text-sm text-red-600">
          {error}
        </div>
      )}
      <div className="flex justify-end">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
