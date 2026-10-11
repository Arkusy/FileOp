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

type AspectPreset = 'free' | '1:1' | '4:5' | '16:9' | '9:16';
type DragHandle =
  | 'move'
  | 'nw'
  | 'ne'
  | 'sw'
  | 'se'
  | 'n'
  | 's'
  | 'e'
  | 'w'
  | null;

export const CropModal: React.FC<CropModalProps> = ({
  isOpen,
  file,
  currentCrop,
  onApplyCrop,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const [imageUrl, setImageUrl] = useState<string>('');
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number }>({ w: 800, h: 600 });
  const [displayedRect, setDisplayedRect] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  }>({ left: 0, top: 0, width: 0, height: 0 });

  // Crop box in natural image pixel coordinates:
  const [cropBox, setCropBox] = useState<CropArea>({ x: 0, y: 0, w: 100, h: 100 });
  const [aspectPreset, setAspectPreset] = useState<AspectPreset>('free');
  const [rotationDegrees, setRotationDegrees] = useState<number>(0); // 0, 90, 180, 270

  // Pointer drag state
  const [activeHandle, setActiveHandle] = useState<DragHandle>(null);
  const [dragStartPoint, setDragStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [initialCropAtDrag, setInitialCropAtDrag] = useState<CropArea | null>(null);

  // Two-finger pinch state for mobile
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchInitialCropRef = useRef<CropArea | null>(null);

  // Load image blob
  useEffect(() => {
    if (!isOpen || !file) return;
    const url = URL.createObjectURL(file);
    setImageUrl(url);

    const img = new Image();
    img.onload = () => {
      const nw = img.naturalWidth || 800;
      const nh = img.naturalHeight || 600;
      setNaturalSize({ w: nw, h: nh });
      setRotationDegrees(0);
      setAspectPreset('free');

      if (currentCrop) {
        setCropBox(currentCrop);
      } else {
        // Initial crop: center 85% with nice margins
        const w = Math.round(nw * 0.85);
        const h = Math.round(nh * 0.85);
        setCropBox({
          x: Math.round((nw - w) / 2),
          y: Math.round((nh - h) / 2),
          w,
          h,
        });
      }
    };
    img.src = url;

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [isOpen, file, currentCrop]);

  // Measure rendered image bounds within container
  const updateDisplayedBounds = useCallback(() => {
    if (!imageRef.current || !containerRef.current) return;
    const imgEl = imageRef.current;
    const containerEl = containerRef.current;

    const imgRect = imgEl.getBoundingClientRect();
    const contRect = containerEl.getBoundingClientRect();

    setDisplayedRect({
      left: imgRect.left - contRect.left,
      top: imgRect.top - contRect.top,
      width: imgRect.width,
      height: imgRect.height,
    });
  }, []);

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('resize', updateDisplayedBounds);
      const timer = setTimeout(updateDisplayedBounds, 100);
      return () => {
        window.removeEventListener('resize', updateDisplayedBounds);
        clearTimeout(timer);
      };
    }
  }, [isOpen, updateDisplayedBounds, rotationDegrees]);

  // Handle aspect ratio presets
  const handleSelectAspect = (preset: AspectPreset) => {
    setAspectPreset(preset);
    if (preset === 'free') return;

    let targetRatio = 1;
    if (preset === '1:1') targetRatio = 1;
    if (preset === '4:5') targetRatio = 4 / 5;
    if (preset === '16:9') targetRatio = 16 / 9;
    if (preset === '9:16') targetRatio = 9 / 16;

    const nw = naturalSize.w;
    const nh = naturalSize.h;

    let w = cropBox.w;
    let h = Math.round(w / targetRatio);

    if (h > nh) {
      h = Math.round(nh * 0.85);
      w = Math.round(h * targetRatio);
    }
    if (w > nw) {
      w = Math.round(nw * 0.85);
      h = Math.round(w / targetRatio);
    }

    const x = Math.max(0, Math.min(nw - w, Math.round((nw - w) / 2)));
    const y = Math.max(0, Math.min(nh - h, Math.round((nh - h) / 2)));

    setCropBox({ x, y, w, h });
  };

  // Convert natural crop box coordinates to displayed container coordinates
  const scaleToDisplay = useCallback(
    (val: number, axis: 'x' | 'y') => {
      if (axis === 'x') {
        const factor = displayedRect.width / (naturalSize.w || 1);
        return displayedRect.left + val * factor;
      } else {
        const factor = displayedRect.height / (naturalSize.h || 1);
        return displayedRect.top + val * factor;
      }
    },
    [displayedRect, naturalSize]
  );

  const displayBox = {
    left: scaleToDisplay(cropBox.x, 'x'),
    top: scaleToDisplay(cropBox.y, 'y'),
    width: (cropBox.w / (naturalSize.w || 1)) * displayedRect.width,
    height: (cropBox.h / (naturalSize.h || 1)) * displayedRect.height,
  };

  // Start drag interaction on handle or move region
  const handlePointerDown = (handle: DragHandle, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();

    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    setActiveHandle(handle);
    setDragStartPoint({ x: e.clientX, y: e.clientY });
    setInitialCropAtDrag({ ...cropBox });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activeHandle || !dragStartPoint || !initialCropAtDrag || displayedRect.width === 0) return;

    // Convert screen pixel delta to natural image pixel delta
    const scaleFactorX = naturalSize.w / displayedRect.width;
    const scaleFactorY = naturalSize.h / displayedRect.height;

    const dx = (e.clientX - dragStartPoint.x) * scaleFactorX;
    const dy = (e.clientY - dragStartPoint.y) * scaleFactorY;

    const maxW = naturalSize.w;
    const maxH = naturalSize.h;
    const minSize = 25; // Minimum 25px

    let { x, y, w, h } = initialCropAtDrag;

    if (activeHandle === 'move') {
      // Move crop box inside image boundaries without resizing
      x = Math.max(0, Math.min(maxW - w, Math.round(x + dx)));
      y = Math.max(0, Math.min(maxH - h, Math.round(y + dy)));
    } else {
      let newX = x;
      let newY = y;
      let newW = w;
      let newH = h;

      if (activeHandle === 'nw') {
        newX = Math.max(0, Math.min(x + w - minSize, Math.round(x + dx)));
        newY = Math.max(0, Math.min(y + h - minSize, Math.round(y + dy)));
        newW = x + w - newX;
        newH = y + h - newY;
      } else if (activeHandle === 'ne') {
        newY = Math.max(0, Math.min(y + h - minSize, Math.round(y + dy)));
        newW = Math.max(minSize, Math.min(maxW - x, Math.round(w + dx)));
        newH = y + h - newY;
      } else if (activeHandle === 'sw') {
        newX = Math.max(0, Math.min(x + w - minSize, Math.round(x + dx)));
        newW = x + w - newX;
        newH = Math.max(minSize, Math.min(maxH - y, Math.round(h + dy)));
      } else if (activeHandle === 'se') {
        newW = Math.max(minSize, Math.min(maxW - x, Math.round(w + dx)));
        newH = Math.max(minSize, Math.min(maxH - y, Math.round(h + dy)));
      } else if (activeHandle === 'n') {
        newY = Math.max(0, Math.min(y + h - minSize, Math.round(y + dy)));
        newH = y + h - newY;
      } else if (activeHandle === 's') {
        newH = Math.max(minSize, Math.min(maxH - y, Math.round(h + dy)));
      } else if (activeHandle === 'w') {
        newX = Math.max(0, Math.min(x + w - minSize, Math.round(x + dx)));
        newW = x + w - newX;
      } else if (activeHandle === 'e') {
        newW = Math.max(minSize, Math.min(maxW - x, Math.round(w + dx)));
      }

      // Aspect ratio constraints if selected
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

    setCropBox({
      x: Math.round(x),
      y: Math.round(y),
      w: Math.round(Math.max(minSize, w)),
      h: Math.round(Math.max(minSize, h)),
    });
  };

  const handlePointerUp = () => {
    setActiveHandle(null);
    setDragStartPoint(null);
    setInitialCropAtDrag(null);
  };

  // Two finger pinch-to-resize crop area for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      pinchStartDistRef.current = dist;
      pinchInitialCropRef.current = { ...cropBox };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDistRef.current && pinchInitialCropRef.current) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const ratio = dist / pinchStartDistRef.current;

      const init = pinchInitialCropRef.current;
      const nw = naturalSize.w;
      const nh = naturalSize.h;

      const newW = Math.max(50, Math.min(nw, Math.round(init.w * ratio)));
      const newH = Math.max(50, Math.min(nh, Math.round(init.h * ratio)));
      const newX = Math.max(0, Math.min(nw - newW, Math.round(init.x - (newW - init.w) / 2)));
      const newY = Math.max(0, Math.min(nh - newH, Math.round(init.y - (newH - init.h) / 2)));

      setCropBox({ x: newX, y: newY, w: newW, h: newH });
    }
  };

  const handleTouchEnd = () => {
    pinchStartDistRef.current = null;
    pinchInitialCropRef.current = null;
  };

  // Reset to full image
  const handleReset = () => {
    setAspectPreset('free');
    setRotationDegrees(0);
    const nw = naturalSize.w;
    const nh = naturalSize.h;
    setCropBox({
      x: 0,
      y: 0,
      w: nw,
      h: nh,
    });
  };

  // Rotate 90 degrees clockwise
  const handleRotate90 = () => {
    setRotationDegrees((r) => (r + 90) % 360);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150 select-none">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-4 sm:p-5 shadow-2xl flex flex-col max-h-[96vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-500 flex items-center justify-center font-bold">
              <Crop className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base">
                Crop & Adjust Frame
              </h3>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">
                Drag corners to resize · Drag inside to pan · Pinch to zoom
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Aspect Ratio Row & Quick Rotate */}
        <div className="flex items-center justify-between gap-2 py-2 shrink-0 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none">
            {(['free', '1:1', '4:5', '16:9', '9:16'] as const).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handleSelectAspect(preset)}
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

          <button
            type="button"
            onClick={handleRotate90}
            title="Rotate 90° Clockwise"
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors shrink-0 cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Rotate</span>
          </button>
        </div>

        {/* Image Workspace with Interactive Cropping Box */}
        <div
          ref={containerRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="flex-1 overflow-hidden flex items-center justify-center p-2 bg-slate-950/70 rounded-2xl my-2 border border-slate-200/40 dark:border-slate-800 relative min-h-[240px] max-h-[55vh]"
        >
          {imageUrl && (
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Crop Source"
              onLoad={updateDisplayedBounds}
              className="max-h-[50vh] max-w-full object-contain pointer-events-none rounded-lg shadow-lg select-none"
              style={{
                transform: `rotate(${rotationDegrees}deg)`,
                transition: 'transform 0.2s ease-out',
              }}
            />
          )}

          {/* Dimmed exterior overlay */}
          {displayedRect.width > 0 && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `linear-gradient(rgba(0,0,0,0.65), rgba(0,0,0,0.65))`,
                clipPath: `polygon(
                  0% 0%, 0% 100%, 
                  ${displayBox.left}px 100%, 
                  ${displayBox.left}px ${displayBox.top}px, 
                  ${displayBox.left + displayBox.width}px ${displayBox.top}px, 
                  ${displayBox.left + displayBox.width}px ${displayBox.top + displayBox.height}px, 
                  ${displayBox.left}px ${displayBox.top + displayBox.height}px, 
                  ${displayBox.left}px 100%, 
                  100% 100%, 100% 0%
                )`,
              }}
            />
          )}

          {/* Active Crop Box with Native Handles */}
          {displayedRect.width > 0 && (
            <div
              onPointerDown={(e) => handlePointerDown('move', e)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="absolute border-2 border-white shadow-2xl cursor-move touch-none"
              style={{
                left: `${displayBox.left}px`,
                top: `${displayBox.top}px`,
                width: `${displayBox.width}px`,
                height: `${displayBox.height}px`,
              }}
            >
              {/* Subtle Rule of Thirds Grid */}
              <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3">
                <div className="border-r border-b border-white/30" />
                <div className="border-r border-b border-white/30" />
                <div className="border-b border-white/30" />
                <div className="border-r border-b border-white/30" />
                <div className="border-r border-b border-white/30" />
                <div className="border-b border-white/30" />
                <div className="border-r border-white/30" />
                <div className="border-r border-white/30" />
                <div />
              </div>

              {/* Four Mobile L-shaped Corner Handles with 48px touch targets */}
              {/* TOP-LEFT */}
              <div
                onPointerDown={(e) => handlePointerDown('nw', e)}
                className="absolute -top-3 -left-3 w-10 h-10 flex items-start justify-start cursor-nwse-resize touch-none z-20 group"
              >
                <div className="w-5 h-5 border-t-4 border-l-4 border-white shadow-md group-hover:scale-110 transition-transform" />
              </div>

              {/* TOP-RIGHT */}
              <div
                onPointerDown={(e) => handlePointerDown('ne', e)}
                className="absolute -top-3 -right-3 w-10 h-10 flex items-start justify-end cursor-nesw-resize touch-none z-20 group"
              >
                <div className="w-5 h-5 border-t-4 border-r-4 border-white shadow-md group-hover:scale-110 transition-transform" />
              </div>

              {/* BOTTOM-LEFT */}
              <div
                onPointerDown={(e) => handlePointerDown('sw', e)}
                className="absolute -bottom-3 -left-3 w-10 h-10 flex items-end justify-start cursor-nesw-resize touch-none z-20 group"
              >
                <div className="w-5 h-5 border-b-4 border-l-4 border-white shadow-md group-hover:scale-110 transition-transform" />
              </div>

              {/* BOTTOM-RIGHT */}
              <div
                onPointerDown={(e) => handlePointerDown('se', e)}
                className="absolute -bottom-3 -right-3 w-10 h-10 flex items-end justify-end cursor-nwse-resize touch-none z-20 group"
              >
                <div className="w-5 h-5 border-b-4 border-r-4 border-white shadow-md group-hover:scale-110 transition-transform" />
              </div>

              {/* Four Edge Handles */}
              {/* TOP */}
              <div
                onPointerDown={(e) => handlePointerDown('n', e)}
                className="absolute -top-3 left-1/2 -translate-x-1/2 w-12 h-6 flex items-center justify-center cursor-ns-resize touch-none z-10"
              >
                <div className="w-8 h-1.5 bg-white rounded-full shadow-md" />
              </div>

              {/* BOTTOM */}
              <div
                onPointerDown={(e) => handlePointerDown('s', e)}
                className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-12 h-6 flex items-center justify-center cursor-ns-resize touch-none z-10"
              >
                <div className="w-8 h-1.5 bg-white rounded-full shadow-md" />
              </div>

              {/* LEFT */}
              <div
                onPointerDown={(e) => handlePointerDown('w', e)}
                className="absolute top-1/2 -translate-y-1/2 -left-3 w-6 h-12 flex items-center justify-center cursor-ew-resize touch-none z-10"
              >
                <div className="w-1.5 h-8 bg-white rounded-full shadow-md" />
              </div>

              {/* RIGHT */}
              <div
                onPointerDown={(e) => handlePointerDown('e', e)}
                className="absolute top-1/2 -translate-y-1/2 -right-3 w-6 h-12 flex items-center justify-center cursor-ew-resize touch-none z-10"
              >
                <div className="w-1.5 h-8 bg-white rounded-full shadow-md" />
              </div>

              {/* Dimension tag inside crop box */}
              <div className="absolute top-2 left-2 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-xs text-white border border-white/20 pointer-events-none">
                {cropBox.w} × {cropBox.h} px
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 shrink-0">
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
                onApplyCrop(cropBox);
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
