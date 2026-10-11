import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Download,
  Sun,
  Moon,
  Grid,
} from 'lucide-react';

interface SvgFullscreenViewerProps {
  isOpen: boolean;
  svgHtml: string;
  metadata?: { width: number; height: number };
  onClose: () => void;
}

export const SvgFullscreenViewer: React.FC<SvgFullscreenViewerProps> = ({
  isOpen,
  svgHtml,
  metadata,
  onClose,
}) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [bgMode, setBgMode] = useState<'checkered' | 'dark' | 'light'>('checkered');

  // Touch tracking references
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pinchStartDistRef = useRef<number | null>(null);
  const initialScaleRef = useRef<number>(1);
  const lastTapRef = useRef<number>(0);

  // Reset viewport whenever opened
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen]);

  // Keyboard escape listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Zoom helpers
  const handleZoomIn = () => setScale((s) => Math.min(8, parseFloat((s + 0.35).toFixed(2))));
  const handleZoomOut = () => setScale((s) => Math.max(0.2, parseFloat((s - 0.35).toFixed(2))));
  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Touch Event Handlers for Native Mobile Pinch & Pan
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      // Single finger drag / pan
      const touch = e.touches[0];
      dragStartRef.current = { x: touch.clientX, y: touch.clientY };
      initialPosRef.current = { ...position };
      setIsDragging(true);

      // Double tap to quickly zoom in / reset
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        if (scale > 1.2) {
          setScale(1);
          setPosition({ x: 0, y: 0 });
        } else {
          setScale(2.5);
        }
      }
      lastTapRef.current = now;
    } else if (e.touches.length === 2) {
      // Two finger pinch to zoom
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      pinchStartDistRef.current = dist;
      initialScaleRef.current = scale;
      setIsDragging(false);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      const touch = e.touches[0];
      const dx = touch.clientX - dragStartRef.current.x;
      const dy = touch.clientY - dragStartRef.current.y;
      setPosition({
        x: initialPosRef.current.x + dx,
        y: initialPosRef.current.y + dy,
      });
    } else if (e.touches.length === 2 && pinchStartDistRef.current !== null) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const ratio = dist / pinchStartDistRef.current;
      const newScale = Math.min(8, Math.max(0.2, initialScaleRef.current * ratio));
      setScale(parseFloat(newScale.toFixed(2)));
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    pinchStartDistRef.current = null;
  };

  // Mouse wheel zoom for desktop
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    setScale((s) => Math.min(8, Math.max(0.2, parseFloat((s + delta).toFixed(2)))));
  };

  // Mouse drag pan
  const handleMouseDown = (e: React.MouseEvent) => {
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    initialPosRef.current = { ...position };
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPosition({
      x: initialPosRef.current.x + dx,
      y: initialPosRef.current.y + dy,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const getBackgroundClass = () => {
    if (bgMode === 'checkered') return 'bg-checkered-dark bg-slate-950';
    if (bgMode === 'light') return 'bg-white';
    return 'bg-slate-950';
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-md select-none touch-none animate-in fade-in duration-200">
      {/* Top Floating Control Bar */}
      <div className="flex items-center justify-between p-3 sm:p-4 border-b border-white/10 z-20 bg-slate-900/90 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold">
            <Maximize2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Full-Screen Vector Inspection</h3>
            <p className="text-[10px] text-slate-400">
              Pinch with two fingers or drag to inspect any detail
            </p>
          </div>
        </div>

        {/* Action Controls Group */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Background Toggle Buttons */}
          <div className="hidden xs:flex items-center bg-slate-800/90 rounded-2xl p-1 border border-white/10">
            <button
              type="button"
              onClick={() => setBgMode('checkered')}
              title="Transparent checkered background"
              className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                bgMode === 'checkered' ? 'bg-rose-500 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setBgMode('dark')}
              title="Dark background"
              className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                bgMode === 'dark' ? 'bg-rose-500 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setBgMode('light')}
              title="Light background"
              className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                bgMode === 'light' ? 'bg-rose-500 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sun className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Zoom Buttons */}
          <div className="flex items-center gap-1 bg-slate-800/90 rounded-2xl p-1 border border-white/10 shadow-lg">
            <button
              type="button"
              onClick={handleZoomOut}
              title="Zoom Out"
              className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-700/80 active:scale-95 transition-all cursor-pointer"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            <span className="text-xs font-mono font-bold text-white px-2 min-w-[44px] text-center">
              {Math.round(scale * 100)}%
            </span>

            <button
              type="button"
              onClick={handleZoomIn}
              title="Zoom In"
              className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-700/80 active:scale-95 transition-all cursor-pointer"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            {(scale !== 1 || position.x !== 0 || position.y !== 0) && (
              <button
                type="button"
                onClick={handleReset}
                title="Reset View"
                className="p-1.5 rounded-xl text-rose-400 hover:bg-rose-500/20 transition-all cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}

            <div className="w-px h-5 bg-white/10 mx-0.5" />

            <button
              type="button"
              onClick={onClose}
              title="Close Viewer"
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Interactive Canvas */}
      <div
        className={`flex-1 w-full h-full overflow-hidden flex items-center justify-center relative cursor-grab active:cursor-grabbing transition-colors duration-200 ${getBackgroundClass()}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="max-w-[90vw] max-h-[80vh] flex items-center justify-center transition-transform duration-75 origin-center pointer-events-none"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          }}
          dangerouslySetInnerHTML={{ __html: svgHtml }}
        />

        {/* Mobile touch tip badge */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/10 text-[11px] text-slate-300 flex items-center gap-2 pointer-events-none shadow-lg">
          <span>👆 Drag to pan</span>
          <span>•</span>
          <span>✌️ Pinch to zoom</span>
          <span>•</span>
          <span>Double-tap 2.5x</span>
        </div>

        {/* Dimensions badge */}
        {metadata && (
          <div className="absolute bottom-4 right-4 px-2.5 py-1 rounded-xl bg-slate-900/80 backdrop-blur-md border border-white/10 text-[11px] font-mono text-slate-300 pointer-events-none">
            {metadata.width} × {metadata.height} px
          </div>
        )}
      </div>
    </div>
  );
};
