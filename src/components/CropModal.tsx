import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CropArea } from '../types/converter';
import { Crop, RotateCcw, X, Check } from 'lucide-react';

interface CropModalProps {
  isOpen: boolean;
  file: File;
  currentCrop?: CropArea | null;
  onApplyCrop: (crop: CropArea | null) => void;
  onClose: () => void;
}

export const CropModal: React.FC<CropModalProps> = ({
  isOpen,
  file,
  currentCrop,
  onApplyCrop,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);
  const [cropRect, setCropRect] = useState<CropArea | null>(currentCrop || null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [aspectPreset, setAspectPreset] = useState<'free' | '1:1' | '16:9' | '4:3'>('free');

  // Load image object
  useEffect(() => {
    if (!isOpen || !file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImageObj(img);
      if (currentCrop) {
        setCropRect(currentCrop);
      } else {
        // default 80% box in center
        const nw = img.naturalWidth;
        const nh = img.naturalHeight;
        const w = Math.round(nw * 0.8);
        const h = Math.round(nh * 0.8);
        setCropRect({
          x: Math.round((nw - w) / 2),
          y: Math.round((nh - h) / 2),
          w,
          h,
        });
      }
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [isOpen, file, currentCrop]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageObj) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imageObj, 0, 0, canvas.width, canvas.height);

    if (cropRect) {
      const { x, y, w, h } = cropRect;
      // Dim exterior
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(0, 0, canvas.width, y);
      ctx.fillRect(0, y + h, canvas.width, canvas.height - y - h);
      ctx.fillRect(0, y, x, h);
      ctx.fillRect(x + w, y, canvas.width - x - w, h);

      // Crop border
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = Math.max(2, Math.round(canvas.width / 300));
      ctx.strokeRect(x, y, w, h);

      // Rule of thirds lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + w / 3, y);
      ctx.lineTo(x + w / 3, y + h);
      ctx.moveTo(x + (2 * w) / 3, y);
      ctx.lineTo(x + (2 * w) / 3, y + h);
      ctx.moveTo(x, y + h / 3);
      ctx.lineTo(x + w, y + h / 3);
      ctx.moveTo(x, y + (2 * h) / 3);
      ctx.lineTo(x + w, y + (2 * h) / 3);
      ctx.stroke();
    }
  }, [imageObj, cropRect]);

  useEffect(() => {
    if (imageObj && canvasRef.current) {
      canvasRef.current.width = imageObj.naturalWidth;
      canvasRef.current.height = imageObj.naturalHeight;
      draw();
    }
  }, [imageObj, draw]);

  useEffect(() => {
    draw();
  }, [cropRect, draw]);

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: Math.min(canvas.width, Math.max(0, (e.clientX - rect.left) * scaleX)),
      y: Math.min(canvas.height, Math.max(0, (e.clientY - rect.top) * scaleY)),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    setDragStart(getCanvasCoords(e));
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragStart || !canvasRef.current) return;
    const p = getCanvasCoords(e);
    let x = Math.min(dragStart.x, p.x);
    let y = Math.min(dragStart.y, p.y);
    let w = Math.abs(p.x - dragStart.x);
    let h = Math.abs(p.y - dragStart.y);

    if (aspectPreset === '1:1') {
      const side = Math.min(w, h);
      w = side;
      h = side;
    } else if (aspectPreset === '16:9') {
      h = Math.round((w * 9) / 16);
    } else if (aspectPreset === '4:3') {
      h = Math.round((w * 3) / 4);
    }

    setCropRect({
      x: Math.round(x),
      y: Math.round(y),
      w: Math.round(Math.max(10, w)),
      h: Math.round(Math.max(10, h)),
    });
  };

  const handlePointerUp = () => {
    setDragStart(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Crop className="w-5 h-5 text-rose-500" />
            <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
              Crop Image
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Aspect presets */}
        <div className="flex items-center gap-1.5 py-3">
          <span className="text-xs font-semibold text-slate-500 mr-1">Aspect Ratio:</span>
          {(['free', '1:1', '16:9', '4:3'] as const).map((preset) => (
            <button
              key={preset}
              onClick={() => setAspectPreset(preset)}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg uppercase transition-all ${
                aspectPreset === preset
                  ? 'bg-rose-500 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>

        {/* Interactive Canvas */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-2 bg-slate-950/20 rounded-2xl my-2 border border-slate-100 dark:border-slate-800">
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="max-h-[50vh] max-w-full rounded-lg cursor-crosshair touch-none shadow-md"
          />
        </div>

        {/* Footer controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setCropRect(null)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset Crop</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onApplyCrop(cropRect);
                onClose();
              }}
              className="px-5 py-2 text-xs font-bold bg-rose-500 hover:bg-rose-600 text-white rounded-xl shadow-md shadow-rose-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Apply Crop</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
