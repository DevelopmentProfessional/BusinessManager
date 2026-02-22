import React, { useEffect, useRef, useState } from 'react';

export default function Widget_Camera({ onCapture, onCancel }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => setReady(true);
        }
      } catch {
        setError('Camera access denied. Please allow camera permissions and try again.');
      }
    };
    start();
    return () => {
      active = false;
      streamRef.current?.getTracks()?.forEach(t => t.stop());
    };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !ready) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(blob => { if (blob) onCapture(blob); }, 'image/jpeg', 0.92);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#000', display: 'flex', flexDirection: 'column' }}>
      <video
        ref={videoRef}
        style={{ flex: 1, width: '100%', objectFit: 'cover' }}
        muted
        playsInline
        autoPlay
      />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {error && (
        <div style={{ position: 'absolute', top: '1rem', left: 0, right: 0, textAlign: 'center' }}>
          <span style={{ background: '#dc3545', color: '#fff', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.875rem' }}>
            {error}
          </span>
        </div>
      )}

      {/* Bottom controls */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.5rem 2rem', background: 'rgba(0,0,0,0.85)' }}>
        <button
          type="button"
          onClick={onCancel}
          style={{ color: '#fff', background: 'none', border: 'none', fontSize: '1rem', cursor: 'pointer', padding: '0.5rem', minWidth: '64px' }}
        >
          Cancel
        </button>

        {/* Shutter button */}
        <button
          type="button"
          onClick={capture}
          disabled={!ready}
          title="Capture photo"
          style={{
            width: '72px', height: '72px',
            borderRadius: '50%',
            border: '4px solid #fff',
            background: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: ready ? 'pointer' : 'not-allowed',
            opacity: ready ? 1 : 0.4,
            padding: 0,
            flexShrink: 0,
          }}
        >
          <div style={{ width: '54px', height: '54px', borderRadius: '50%', background: '#fff' }} />
        </button>

        <div style={{ minWidth: '64px' }} />
      </div>
    </div>
  );
}
