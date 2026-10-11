import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CropArea } from '../types/converter';
import {
  Crop,
  RotateCcw,
  X,
  Check,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react';

interface CropModalProps {
  isOpen: boolean;
  file: File;
  currentCrop?: CropArea | null;
  onApplyCrop: (crop: CropArea | null) => void;
  onClose: () => void;
}

type DragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | null;

export const CropModal: React.FC<CropModalProps> = ({
  isOpen,
  file,
  currentCrop,
  onApplyCrop,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);
  const [rotation, setRotation] = useState<number>(0); // 0, 90, 180, 270
  const [zoom, setZoom] = useState<number>(1); // 1 to 3
  const [cropRect, setCropRect] = useState<CropArea>({ x: 0, y: 0, w: 100, h: 100 });
  const [aspectPreset, setAspectPreset] = useState<'free' | '1:1' | '4:5' | '16:9' | '9:16'>('free');

  // Drag interaction state
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [dragStartCoords, setDragStartCoords] = useState<{ x: number; y: number } | null>(null);
  const [initialCropAtDrag, setInitialCropAtDrag] = useState<CropArea | null>(null);

  // Load image
  useEffect(() => {
    if (!isOpen || !file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImageObj(img);
      setRotation(0);
      setZoom(1);

      const nw = img.naturalWidth || 600;
      const nh = img.naturalHeight || 600;

      if (currentCrop) {
        setCropRect(currentCrop);
      } else {
        // Default crop: centered 85%
        const w = Math.round(nw * 0.85);
        const h = Math.round(nh * 0.85);
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

  // Handle aspect ratio preset changes
  useEffect(() => {
    if (!imageObj) return;
    const nw = imageObj.naturalWidth;
    const nh = imageObj.naturalHeight;

    if (aspectPreset === 'free') return;

    let targetRatio = 1;
    if (aspectPreset === '1:1') targetRatio = 1;
    if (aspectPreset === '4:5') targetRatio = 4 / 5;
    if (aspectPreset === '16:9') targetRatio = 16 / 9;
    if (aspectPreset === '9:16') targetRatio = 9 / 16;

    let w = cropRect.w;
    let h = Math.round(w / targetRatio);

    if (h > nh) {
      h = Math.round(nh * 0.9);
      w = Math.round(h * targetRatio);
    }
    if (w > nw) {
      w = Math.round(nw * 0.9);
      h = Math.round(w / targetRatio);
    }

    const x = Math.max(0, Math.min(nw - w, cropRect.x));
    const y = Math.max(0, Math.min(nh - h, cropRect.y));

    setCropRect({ x, y, w, h });
  }, [aspectPreset, imageObj]);

  // Draw crop frame and handles onto canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageObj) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cw = canvas.width;
    const ch = canvas.height;

    ctx.clearRect(0, 0, cw, ch);

    // Save context for rotation/zoom
    ctx.save();
    ctx.drawImage(imageObj, 0, 0, cw, ch);
    ctx.restore();

    const { x, y, w, h } = cropRect;

    // Dark exterior mask
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(0, 0, cw, y);
    ctx.fillRect(0, y + h, cw, ch - (y + h));
    ctx.fillRect(0, y, x, h);
    ctx.fillRect(x + w, y, cw - (x + w), h);

    // Main crop boundary line
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2, Math.round(cw / 400));
    ctx.strokeRect(x, y, w, h);

    // Subtle rule of thirds lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
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

    // Native Mobile Corner Handles (Thick L-shapes)
    const handleLen = Math.max(16, Math.min(36, Math.round(Math.min(w, h) * 0.15)));
    const handleThick = Math.max(4, Math.round(cw / 150));

    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 4;

    // Top-Left
    ctx.fillRect(x - handleThick / 2, y - handleThick / 2, handleLen, handleThick);
    ctx.fillRect(x - handleThick / 2, y - handleThick / 2, handleThick, handleLen);

    // Top-Right
    ctx.fillRect(x + w - handleLen + handleThick / 2, y - handleThick / 2, handleLen, handleThick);
    ctx.fillRect(x + w - handleThick / 2, y - handleThick / 2, handleThick, handleLen);

    // Bottom-Left
    ctx.fillRect(x - handleThick / 2, y + h - handleThick / 2, handleLen, handleThick);
    ctx.fillRect(x - handleThick / 2, y + h - handleLen + handleThick / 2, handleThick, handleLen);

    // Bottom-Right
    ctx.fillRect(x + w - handleLen + handleThick / 2, y + h - handleThick / 2, handleLen, handleThick);
    ctx.fillRect(x + w - handleThick / 2, y + h - handleLen + handleThick / 2, handleThick, handleLen);

    // Mid edge indicators
    const midThick = handleThick;
    const midLen = Math.round(handleLen * 0.8);
    // Top Mid
    ctx.fillRect(x + (w - midLen) / 2, y - midThick / 2, midLen, midThick);
    // Bottom Mid
    ctx.fillRect(x + (w - midLen) / 2, y + h - midThick / 2, midLen, midThick);
    // Left Mid
    ctx.fillRect(x - midThick / 2, y + (h - midLen) / 2, midThick, midLen);
    // Right Mid
    ctx.fillRect(x + w - midThick / 2, y + (h - midLen) / 2, midThick, midLen);

    ctx.shadowBlur = 0;
  }, [imageObj, cropRect]);

  // Canvas size sync
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

  // Touch & Pointer Coordinates
  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  // Determine which handle or region was touched
  const getHitHandle = (px: number, py: number): DragMode => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    // Generous touch threshold (40px on screen for mobile fingers)
    const touchRadius = 40 * scale;

    const { x, y, w, h } = cropRect;

    // Corner hits
    if (Math.hypot(px - x, py - y) <= touchRadius) return 'nw';
    if (Math.hypot(px - (x + w), py - y) <= touchRadius) return 'ne';
    if (Math.hypot(px - x, py - (y + h)) <= touchRadius) return 'sw';
    if (Math.hypot(px - (x + w), py - (y + h)) <= touchRadius) return 'se';

    // Edge hits
    if (Math.abs(py - y) <= touchRadius && px >= x && px <= x + w) return 'n';
    if (Math.abs(py - (y + h)) <= touchRadius && px >= x && px <= x + w) return 's';
    if (Math.abs(px - x) <= touchRadius && py >= y && py <= y + h) return 'w';
    if (Math.abs(px - (x + w)) <= touchRadius && py >= y && py <= y + h) return 'e';

    // Inside box -> Pan / Move
    if (px >= x && px <= x + w && py >= y && py <= y + h) return 'move';

    // Outside -> Don't delete, default to moving closest edge
    return 'move';
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);

    const coords = getCanvasCoords(e);
    const mode = getHitHandle(coords.x, coords.y);

    setDragMode(mode);
    setDragStartCoords(coords);
    setInitialCropAtDrag({ ...cropRect });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragMode || !dragStartCoords || !initialCropAtDrag || !canvasRef.current) return;
    const currentCoords = getCanvasCoords(e);
    const dx = currentCoords.x - dragStartCoords.x;
    const dy = currentCoords.y - dragStartCoords.y;

    const maxW = canvasRef.current.width;
    const maxH = canvasRef.current.height;

    let { x, y, w, h } = initialCropAtDrag;

    if (dragMode === 'move') {
      // Panning crop box without changing dimensions
      x = Math.max(0, Math.min(maxW - w, x + dx));
      y = Math.max(0, Math.min(maxH - h, y + dy));
    } else {
      // Resizing via corner or edge
      let newX = x;
      let newY = y;
      let newW = w;
      let newH = h;

      if (dragMode === 'nw') {
        newX = Math.max(0, Math.min(x + w - 30, x + dx));
        newY = Math.max(0, Math.min(y + h - 30, y + dy));
        newW = x + w - newX;
        newH = y + h - newY;
      } else if (dragMode === 'ne') {
        newY = Math.max(0, Math.min(y + h - 30, y + dy));
        newW = Math.max(30, Math.min(maxW - x, w + dx));
        newH = y + h - newY;
      } else if (dragMode === 'sw') {
        newX = Math.max(0, Math.min(x + w - 30, x + dx));
        newW = x + w - newX;
        newH = Math.max(30, Math.min(maxH - y, h + dy));
      } else if (dragMode === 'se') {
        newW = Math.max(30, Math.min(maxW - x, w + dx));
        newH = Math.max(30, Math.min(maxH - y, h + dy));
      } else if (dragMode === 'n') {
        newY = Math.max(0, Math.min(y + h - 30, y + dy));
        newH = y + h - newY;
      } else if (dragMode === 's') {
        newH = Math.max(30, Math.min(maxH - y, h + dy));
      } else if (dragMode === 'w') {
        newX = Math.max(0, Math.min(x + w - 30, x + dx));
        newW = x + w - newX;
      } else if (dragMode === 'e') {
        newW = Math.max(30, Math.min(maxW - x, w + dx));
      }

      // Aspect ratio lock
      if (aspectPreset !== 'free') {
        let ratio = 1;
        if (aspectPreset === '1:1') ratio = 1;
        if (aspectPreset === '4:5') ratio = 4 / 5;
        if (aspectPreset === '16:9') ratio = 16 / 9;
        if (aspectPreset === '9:16') ratio = 9 / 16;

        newH = Math.round(newW / ratio);
        if (newY + newH > maxH) {
          newH = maxH - newY;
          newW = Math.round(newH * ratio);
        }
      }

      x = newX;
      y = newY;
      w = newW;
      h = newH;
    }

    setCropRect({
      x: Math.round(x),
      y: Math.round(y),
      w: Math.round(Math.max(20, w)),
      h: Math.round(Math.max(20, h)),
    });
  };

  const handlePointerUp = () => {
    setDragMode(null);
    setDragStartCoords(null);
    setInitialCropAtDrag(null);
  };

  // Reset to full image
  const handleReset = () => {
    if (!imageObj) return;
    const nw = imageObj.naturalWidth;
    const nh = imageObj.naturalHeight;
    setAspectPreset('free');
    setZoom(1);
    setCropRect({
      x: Math.round(nw * 0.05),
      y: Math.round(nh * 0.05),
      w: Math.round(nw * 0.9),
      h: Math.round(nh * 0.9),
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl flex flex-col max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 dark:bg-rose-500/20 text-rose-500 flex items-center justify-center font-bold">
              <Crop className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base">
                Crop & Frame Image
              </h3>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 hidden xs:block">
                Drag inside to move box · Drag corners to resize
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Aspect presets row (Scrollable on small mobile) */}
        <div className="flex items-center gap-1.5 py-2.5 overflow-x-auto shrink-0 scrollbar-none">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1">
            Ratio:
          </span>
          {(['free', '1:1', '4:5', '16:9', '9:16'] as const).map((preset) => (
            <button
              key={preset}
              onClick={() => setAspectPreset(preset)}
              className={`px-3 py-1 text-xs font-bold rounded-xl uppercase transition-all shrink-0 cursor-pointer ${
                aspectPreset === preset
                  ? 'bg-rose-500 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {preset === 'free' ? 'Free' : preset}
            </button>
          ))}
        </div>

        {/* Interactive Canvas Workspace */}
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden flex items-center justify-center p-2 bg-slate-950/40 dark:bg-slate-950/80 rounded-2xl my-2 border border-slate-200/50 dark:border-slate-800/80 relative min-h-[220px]"
        >
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="max-h-[50vh] max-w-full rounded-lg cursor-move touch-none shadow-xl select-none"
            style={{
              transform: `scale(${zoom})`,
              transition: dragMode ? 'none' : 'transform 0.15s ease-out',
            }}
          />

          {/* Quick Dimensions Badge */}
          <div className="absolute bottom-3 left-3 text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-white border border-white/10 pointer-events-none">
            {cropRect.w} × {cropRect.h} px
          </div>
        </div>

        {/* Zoom Slider Bar */}
        <div className="flex items-center justify-between gap-3 px-2 py-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <ZoomOut className="w-3.5 h-3.5" />
            <span className="text-[11px] font-semibold hidden xs:inline">Zoom:</span>
          </div>

          <input
            type="range"
            min={1}
            max={2.5}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="flex-1 accent-rose-500 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
          />

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300 w-9 text-right">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom(1)}
              title="Reset Zoom"
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
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
              className="px-5 py-2 text-xs font-bold bg-rose-500 hover:bg-rose-600 text-white rounded-xl shadow-md shadow-rose-500/20 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
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
