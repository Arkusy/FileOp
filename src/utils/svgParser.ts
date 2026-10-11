import { SvgMetadata } from '../types/converter';

export function parseSvgString(rawSvg: string): {
  isValid: boolean;
  doc?: Document;
  element?: SVGSVGElement;
  metadata?: SvgMetadata;
  error?: string;
} {
  const trimmed = rawSvg.trim();
  if (!trimmed) {
    return { isValid: false, error: 'SVG code is empty' };
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(trimmed, 'image/svg+xml');
    const parserError = doc.querySelector('parsererror');

    if (parserError) {
      return { isValid: false, error: 'Invalid SVG syntax: ' + parserError.textContent?.slice(0, 80) };
    }

    const svgElement = doc.documentElement as unknown as SVGSVGElement;
    if (!svgElement || svgElement.nodeName.toLowerCase() !== 'svg') {
      return { isValid: false, error: 'Root element must be <svg>' };
    }

    // Determine dimensions
    let w = parseFloat(svgElement.getAttribute('width') || '0');
    let h = parseFloat(svgElement.getAttribute('height') || '0');
    const viewBoxAttr = svgElement.getAttribute('viewBox');

    if (viewBoxAttr) {
      const parts = viewBoxAttr.split(/[\s,]+/).map(Number).filter((n) => !isNaN(n));
      if (parts.length === 4) {
        if (!w || isNaN(w)) w = parts[2];
        if (!h || isNaN(h)) h = parts[3];
      }
    }

    // Fallbacks if neither viewBox nor width/height provided
    if (!w || isNaN(w)) w = 300;
    if (!h || isNaN(h)) h = 300;

    // Round to whole pixels
    w = Math.max(16, Math.round(w));
    h = Math.max(16, Math.round(h));

    // Calculate estimated sizes
    const calcKb = (width: number, height: number, format: 'png' | 'jpg' | 'webp' = 'png'): number => {
      const pixels = width * height;
      let ratio = 0.08; // vector graphics compress well
      if (format === 'jpg') ratio = 0.12;
      if (format === 'webp') ratio = 0.06;
      const bytes = Math.max(1024, Math.round(pixels * ratio));
      return Math.round(bytes / 1024);
    };

    const metadata: SvgMetadata = {
      width: w,
      height: h,
      viewBox: viewBoxAttr || `0 0 ${w} ${h}`,
      estimatedSizes: {
        '1x': {
          width: w,
          height: h,
          kb: calcKb(w, h),
        },
        '2x': {
          width: w * 2,
          height: h * 2,
          kb: calcKb(w * 2, h * 2),
        },
        '4x': {
          width: w * 4,
          height: h * 4,
          kb: calcKb(w * 4, h * 4),
        },
      },
    };

    return {
      isValid: true,
      doc,
      element: svgElement,
      metadata,
    };
  } catch (err: unknown) {
    return {
      isValid: false,
      error: err instanceof Error ? err.message : 'Failed to parse SVG',
    };
  }
}

export function formatKb(kb: number): string {
  if (kb >= 1024) {
    return `${(kb / 1024).toFixed(1)} MB`;
  }
  return `${kb} KB`;
}

export const SAMPLE_SVGS = [
  {
    name: 'Shield Check',
    code: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4f46e5" />
      <stop offset="100%" stop-color="#06b6d4" />
    </linearGradient>
  </defs>
  <path d="M50 8 L85 24 V52 C85 72 50 92 50 92 C50 92 15 72 15 52 V24 Z" fill="url(#g)" />
  <path d="M34 50 L45 61 L66 38" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />
</svg>`,
  },
  {
    name: 'Rocket Launch',
    code: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <defs>
    <linearGradient id="rg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f43f5e" />
      <stop offset="100%" stop-color="#fb923c" />
    </linearGradient>
  </defs>
  <circle cx="60" cy="60" r="54" fill="#0f172a" />
  <path d="M60 22 C72 34 76 56 70 70 L50 70 C44 56 48 34 60 22 Z" fill="url(#rg)" />
  <circle cx="60" cy="46" r="6" fill="#ffffff" />
  <path d="M48 66 L34 78 L46 80 Z" fill="#e11d48" />
  <path d="M72 66 L86 78 L74 80 Z" fill="#e11d48" />
  <polygon points="54,74 66,74 60,94" fill="#facc15" />
</svg>`,
  },
  {
    name: 'Sparkle Star',
    code: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <defs>
    <linearGradient id="sg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#eab308" />
      <stop offset="100%" stop-color="#f97316" />
    </linearGradient>
  </defs>
  <path d="M50 5 Q50 40 15 50 Q50 50 50 95 Q50 60 85 50 Q50 50 50 5 Z" fill="url(#sg)" />
  <circle cx="78" cy="22" r="5" fill="#fde047" />
  <circle cx="22" cy="78" r="4" fill="#fde047" />
</svg>`,
  },
];
