import React, { useRef, useState, useEffect, useCallback } from "react";

export default function Widget_Signature({ onSave, onCancel, initialSignature, width = 500, height = 200 }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [undoStack, setUndoStack] = useState([]);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (initialSignature) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHasDrawn(true);
      };
      img.src = initialSignature;
    }
  }, [initialSignature]);

  const getCoords = useCallback((e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if (e.touches && e.touches.length > 0) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const saveSnapshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setUndoStack((prev) => [...prev, canvas.toDataURL()]);
  }, []);

  const startDrawing = useCallback(
    (e) => {
      e.preventDefault();
      saveSnapshot();
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const { x, y } = getCoords(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
      setIsDrawing(true);
    },
    [getCoords, saveSnapshot]
  );

  const draw = useCallback(
    (e) => {
      if (!isDrawing) return;
      e.preventDefault();
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const { x, y } = getCoords(e);
      ctx.lineTo(x, y);
      ctx.stroke();
      setHasDrawn(true);
    },
    [isDrawing, getCoords]
  );

  const stopDrawing = useCallback((e) => {
    if (e) e.preventDefault();
    setIsDrawing(false);
  }, []);

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    saveSnapshot();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    setHasDrawn(false);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const lastSnapshot = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = lastSnapshot;
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    onSave(dataUrl);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-white border-2 border-gray-300 dark:border-gray-600 overflow-hidden rounded-lg">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="cursor-crosshair touch-none w-full"
          style={{ maxWidth: `${width}px` }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      <p className="dark:text-gray-400 text-center text-gray-500 text-xs">Draw your signature above using mouse or touch</p>
      <div className="flex items-center justify-between">
        <div className="ui-flex-items-gap-2">
          <button type="button" onClick={handleUndo} disabled={undoStack.length === 0} className="bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-gray-200 px-1 py-1.5 rounded text-gray-700 text-sm">
            Undo
          </button>
          <button type="button" onClick={handleClear} className="bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300 hover:bg-gray-200 px-1 py-1.5 rounded text-gray-700 text-sm">
            Clear
          </button>
        </div>
        <div className="ui-flex-items-gap-2">
          {onCancel && (
            <button type="button" onClick={onCancel} className="bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300 hover:bg-gray-200 px-1 py-1.5 rounded text-gray-700 text-sm">
              Cancel
            </button>
          )}
          <button type="button" onClick={handleSave} disabled={!hasDrawn} className="bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50 hover:bg-primary-700 px-1 py-1.5 rounded text-sm text-white">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
